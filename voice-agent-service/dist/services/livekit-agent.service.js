"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.LiveKitAgentOrchestrator = void 0;
const livekit_server_sdk_1 = require("livekit-server-sdk");
const events_1 = require("events");
const redis_1 = __importDefault(require("redis"));
const crypto_1 = __importDefault(require("crypto"));
const supabase_1 = require("./supabase");
const logger_1 = require("../utils/logger");
class LiveKitAgentOrchestrator extends events_1.EventEmitter {
    constructor() {
        super();
        this.workers = new Map();
        this.sessions = new Map();
        this.knowledgeCache = new Map();
        // Initialize LiveKit Room Service
        this.roomService = new livekit_server_sdk_1.RoomServiceClient(process.env.LIVEKIT_URL || '', process.env.LIVEKIT_API_KEY || '', process.env.LIVEKIT_API_SECRET || '');
        // Initialize Redis client
        this.redis = redis_1.default.createClient({
            url: process.env.REDIS_URL || 'redis://localhost:6379'
        });
        this.initializeRedis();
        this.startWorkerHeartbeatMonitoring();
    }
    async initializeRedis() {
        try {
            await this.redis.connect();
            logger_1.logger.info('Connected to Redis for worker coordination');
            // Subscribe to worker events
            await this.redis.subscribe('worker:heartbeat', (message) => {
                this.handleWorkerHeartbeat(JSON.parse(message));
            });
            await this.redis.subscribe('worker:status', (message) => {
                this.handleWorkerStatusChange(JSON.parse(message));
            });
        }
        catch (error) {
            logger_1.logger.error('Failed to connect to Redis:', error);
            throw error;
        }
    }
    /**
     * Create a new voice agent configuration
     */
    async createAgent(config) {
        try {
            logger_1.logger.info(`Creating voice agent: ${config.name} for company ${config.companyId}`);
            // Create agent in database using supabase service
            const agent = await supabase_1.supabase.createVoiceAgent({
                name: config.name,
                description: `Voice agent with LiveKit integration`,
                systemPrompt: config.instructions,
                voice: config.voice,
                model: config.model, // Type assertion for model compatibility
                phoneNumber: config.phoneNumber
            }, config.companyId, 'system');
            if (!agent) {
                throw new Error('Failed to create agent in database');
            }
            // Process knowledge base files if provided
            if (config.knowledgeBaseFiles.length > 0) {
                await this.processKnowledgeBaseFiles(agent.id, config.knowledgeBaseFiles, config.companyId);
            }
            // Store agent configuration in Redis for quick access
            await this.redis.hSet(`agent:${agent.id}`, {
                config: JSON.stringify(config),
                status: 'created',
                created_at: new Date().toISOString()
            });
            logger_1.logger.info(`Successfully created voice agent ${agent.id}`);
            return agent.id;
        }
        catch (error) {
            logger_1.logger.error('Error creating voice agent:', error);
            throw error;
        }
    }
    /**
     * Deploy agent to a LiveKit room
     */
    async deployAgentToRoom(agentId, roomName) {
        try {
            logger_1.logger.info(`Deploying agent ${agentId} to room ${roomName}`);
            // Get agent configuration
            const agentConfig = await this.getAgentConfig(agentId);
            if (!agentConfig) {
                throw new Error(`Agent configuration not found for ${agentId}`);
            }
            // Find available worker
            const worker = await this.findAvailableWorker(agentConfig.companyId);
            if (!worker) {
                throw new Error('No available workers for agent deployment');
            }
            // Ensure room exists
            const room = await this.ensureRoom(roomName, agentConfig.companyId);
            // Create agent session
            const sessionId = crypto_1.default.randomUUID();
            const session = {
                id: sessionId,
                agentId,
                roomName,
                companyId: agentConfig.companyId,
                workerId: worker.id,
                status: 'active',
                startedAt: new Date(),
                interactions: []
            };
            // Store session
            this.sessions.set(sessionId, session);
            // Update worker status
            await this.assignWorkerToSession(worker.id, sessionId);
            // Deploy agent worker (this would typically involve starting a LiveKit agent process)
            await this.startAgentWorker(agentConfig, session, room);
            logger_1.logger.info(`Successfully deployed agent ${agentId} to room ${roomName} with session ${sessionId}`);
            this.emit('agent:deployed', { agentId, roomName, sessionId });
            return session;
        }
        catch (error) {
            logger_1.logger.error('Error deploying agent to room:', error);
            throw error;
        }
    }
    /**
     * Stop an agent session
     */
    async stopAgentSession(sessionId) {
        try {
            const session = this.sessions.get(sessionId);
            if (!session) {
                throw new Error(`Session ${sessionId} not found`);
            }
            logger_1.logger.info(`Stopping agent session ${sessionId}`);
            // Update session status
            session.status = 'stopped';
            session.endedAt = new Date();
            // Free up the worker
            await this.releaseWorker(session.workerId);
            // Clean up session
            this.sessions.delete(sessionId);
            // Store session history in database (if needed)
            await this.archiveSession(session);
            logger_1.logger.info(`Successfully stopped agent session ${sessionId}`);
            this.emit('session:stopped', { sessionId, agentId: session.agentId });
        }
        catch (error) {
            logger_1.logger.error('Error stopping agent session:', error);
            throw error;
        }
    }
    /**
     * Process knowledge base files for RAG integration
     */
    async processKnowledgeBaseFiles(agentId, fileIds, companyId) {
        try {
            logger_1.logger.info(`Processing ${fileIds.length} knowledge base files for agent ${agentId}`);
            for (const fileId of fileIds) {
                // Get file information
                const file = await supabase_1.supabase.getFileById(fileId, companyId);
                if (!file) {
                    logger_1.logger.warn(`Knowledge base file ${fileId} not found`);
                    continue;
                }
                // Check if file is processed
                if (file.processingStatus !== 'processed') {
                    logger_1.logger.warn(`Knowledge base file ${fileId} not yet processed, status: ${file.processingStatus}`);
                    continue;
                }
                // Add file to agent
                await supabase_1.supabase.addFileToAgent(agentId, fileId, companyId, 'system');
                // Cache file content for quick retrieval
                this.knowledgeCache.set(`${agentId}:${fileId}`, {
                    fileId,
                    filename: file.filename,
                    content: file.contentPreview,
                    processedAt: file.updatedAt
                });
            }
            logger_1.logger.info(`Successfully processed knowledge base files for agent ${agentId}`);
        }
        catch (error) {
            logger_1.logger.error(`Error processing knowledge base files for agent ${agentId}:`, error);
            throw error;
        }
    }
    /**
     * Get agent configuration
     */
    async getAgentConfig(agentId) {
        try {
            const config = await this.redis.hGet(`agent:${agentId}`, 'config');
            return config ? JSON.parse(config) : null;
        }
        catch (error) {
            logger_1.logger.error(`Error getting agent config for ${agentId}:`, error);
            return null;
        }
    }
    /**
     * Find an available worker for the company
     */
    async findAvailableWorker(companyId) {
        const availableWorkers = Array.from(this.workers.values())
            .filter(worker => worker.status === 'available' && worker.currentLoad < worker.maxCapacity);
        if (availableWorkers.length === 0) {
            return null;
        }
        // Return worker with lowest load
        return availableWorkers.reduce((prev, current) => prev.currentLoad < current.currentLoad ? prev : current);
    }
    /**
     * Ensure LiveKit room exists
     */
    async ensureRoom(roomName, companyId) {
        try {
            // Check if room exists
            const rooms = await this.roomService.listRooms([roomName]);
            if (rooms.length > 0) {
                return rooms[0];
            }
            // Create room with company-specific metadata
            const room = await this.roomService.createRoom({
                name: roomName,
                metadata: JSON.stringify({
                    companyId,
                    createdAt: new Date().toISOString(),
                    type: 'voice-agent'
                })
            });
            logger_1.logger.info(`Created LiveKit room: ${roomName} for company ${companyId}`);
            return room;
        }
        catch (error) {
            logger_1.logger.error(`Error ensuring room ${roomName}:`, error);
            throw error;
        }
    }
    /**
     * Start agent worker process
     */
    async startAgentWorker(config, session, room) {
        try {
            logger_1.logger.info(`Starting agent worker for session ${session.id}`);
            // This is where you would start the actual LiveKit agent process
            // For now, we'll simulate this with a placeholder
            // Store worker information
            await this.redis.hSet(`session:${session.id}`, {
                agentId: session.agentId,
                roomName: session.roomName,
                workerId: session.workerId,
                status: 'active',
                startedAt: session.startedAt.toISOString()
            });
            // In a real implementation, you would:
            // 1. Spawn a LiveKit agent process
            // 2. Connect the agent to the room
            // 3. Set up speech recognition, LLM, and TTS pipelines
            // 4. Configure RAG integration with knowledge base
            logger_1.logger.info(`Agent worker started for session ${session.id}`);
        }
        catch (error) {
            logger_1.logger.error(`Error starting agent worker for session ${session.id}:`, error);
            throw error;
        }
    }
    /**
     * Handle worker heartbeat
     */
    handleWorkerHeartbeat(data) {
        const { workerId, status, load, capabilities } = data;
        if (this.workers.has(workerId)) {
            const worker = this.workers.get(workerId);
            worker.lastHeartbeat = new Date();
            worker.currentLoad = load;
            worker.status = status;
        }
        else {
            // Register new worker
            this.workers.set(workerId, {
                id: workerId,
                status,
                currentLoad: load,
                maxCapacity: data.maxCapacity || 10,
                lastHeartbeat: new Date(),
                capabilities: capabilities || []
            });
        }
    }
    /**
     * Handle worker status change
     */
    handleWorkerStatusChange(data) {
        const { workerId, status } = data;
        if (this.workers.has(workerId)) {
            const worker = this.workers.get(workerId);
            worker.status = status;
            logger_1.logger.info(`Worker ${workerId} status changed to ${status}`);
        }
    }
    /**
     * Start worker heartbeat monitoring
     */
    startWorkerHeartbeatMonitoring() {
        setInterval(() => {
            const now = new Date();
            const timeoutMs = 30000; // 30 seconds
            for (const [workerId, worker] of this.workers.entries()) {
                if (now.getTime() - worker.lastHeartbeat.getTime() > timeoutMs) {
                    logger_1.logger.warn(`Worker ${workerId} heartbeat timeout, marking as offline`);
                    worker.status = 'offline';
                }
            }
        }, 10000); // Check every 10 seconds
    }
    /**
     * Assign worker to session
     */
    async assignWorkerToSession(workerId, sessionId) {
        const worker = this.workers.get(workerId);
        if (worker) {
            worker.currentLoad += 1;
            if (worker.currentLoad >= worker.maxCapacity) {
                worker.status = 'busy';
            }
        }
        await this.redis.hSet(`worker:${workerId}`, 'currentSessions', JSON.stringify([sessionId]));
    }
    /**
     * Release worker from session
     */
    async releaseWorker(workerId) {
        const worker = this.workers.get(workerId);
        if (worker) {
            worker.currentLoad = Math.max(0, worker.currentLoad - 1);
            if (worker.currentLoad < worker.maxCapacity) {
                worker.status = 'available';
            }
        }
    }
    /**
     * Archive completed session
     */
    async archiveSession(session) {
        try {
            // Store session data for analytics and billing
            await this.redis.hSet(`session:archive:${session.id}`, {
                agentId: session.agentId,
                companyId: session.companyId,
                duration: session.endedAt ? session.endedAt.getTime() - session.startedAt.getTime() : 0,
                interactions: JSON.stringify(session.interactions),
                archivedAt: new Date().toISOString()
            });
            logger_1.logger.info(`Archived session ${session.id}`);
        }
        catch (error) {
            logger_1.logger.error(`Error archiving session ${session.id}:`, error);
        }
    }
    /**
     * Get active agent sessions
     */
    getActiveAgentSessions() {
        return Array.from(this.sessions.values()).filter(session => session.status === 'active');
    }
    /**
     * Get worker statistics
     */
    async getWorkerStats() {
        const workers = Array.from(this.workers.values());
        const activeSessions = this.getActiveAgentSessions();
        return {
            totalWorkers: workers.length,
            availableWorkers: workers.filter(w => w.status === 'available').length,
            busyWorkers: workers.filter(w => w.status === 'busy').length,
            totalSessions: activeSessions.length,
            averageLoad: workers.length > 0 ? workers.reduce((sum, w) => sum + w.currentLoad, 0) / workers.length : 0,
            regions: workers.reduce((acc, w) => {
                if (w.region) {
                    acc[w.region] = (acc[w.region] || 0) + 1;
                }
                return acc;
            }, {})
        };
    }
    /**
     * Cleanup and shutdown
     */
    async shutdown() {
        try {
            logger_1.logger.info('Shutting down LiveKit Agent Orchestrator');
            // Stop all active sessions
            for (const session of this.sessions.values()) {
                await this.stopAgentSession(session.id);
            }
            // Disconnect Redis
            await this.redis.disconnect();
            logger_1.logger.info('LiveKit Agent Orchestrator shutdown complete');
        }
        catch (error) {
            logger_1.logger.error('Error during shutdown:', error);
        }
    }
}
exports.LiveKitAgentOrchestrator = LiveKitAgentOrchestrator;
//# sourceMappingURL=livekit-agent.service.js.map