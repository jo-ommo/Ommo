import { FastifyInstance } from 'fastify';
import { Room, RoomServiceClient, DataPacket_Kind } from 'livekit-server-sdk';
import { WebSocket } from 'ws';
import { EventEmitter } from 'events';
import Redis from 'redis';
import crypto from 'crypto';
import { supabase } from './supabase';
import { VoiceAgent, KnowledgeBaseFile, AgentSession } from '../types';
import { logger } from '../utils/logger';

export interface LiveKitAgentConfig {
  agentId: string;
  companyId: string;
  name: string;
  instructions: string;
  voice: string;
  model: 'gpt-4o' | 'gpt-3.5-turbo' | 'gpt-4o-mini' | 'claude-3-sonnet' | 'claude-3-haiku';
  phoneNumber?: string;
  knowledgeBaseFiles: string[];
  settings: {
    interruptions_enabled: boolean;
    noise_suppression_enabled: boolean;
    voice_speed: number;
    voice_pitch: number;
    speech_timeout: number;
    silence_timeout: number;
  };
}

export interface LiveKitWorker {
  id: string;
  status: 'available' | 'busy' | 'offline';
  currentLoad: number;
  maxCapacity: number;
  lastHeartbeat: Date;
  capabilities: string[];
  region?: string;
}

export interface WorkerStats {
  totalWorkers: number;
  availableWorkers: number;
  busyWorkers: number;
  totalSessions: number;
  averageLoad: number;
  regions: Record<string, number>;
}

export class LiveKitAgentOrchestrator extends EventEmitter {
  private redis: Redis.RedisClientType;
  private roomService: RoomServiceClient;
  private workers: Map<string, LiveKitWorker> = new Map();
  private sessions: Map<string, AgentSession> = new Map();
  private knowledgeCache: Map<string, any> = new Map();

  constructor() {
    super();
    
    // Initialize LiveKit Room Service
    this.roomService = new RoomServiceClient(
      process.env.LIVEKIT_URL || '',
      process.env.LIVEKIT_API_KEY || '',
      process.env.LIVEKIT_API_SECRET || ''
    );

    // Initialize Redis client
    this.redis = Redis.createClient({
      url: process.env.REDIS_URL || 'redis://localhost:6379'
    });

    this.initializeRedis();
    this.startWorkerHeartbeatMonitoring();
  }

  private async initializeRedis(): Promise<void> {
    try {
      await this.redis.connect();
      logger.info('Connected to Redis for worker coordination');
      
      // Subscribe to worker events
      await this.redis.subscribe('worker:heartbeat', (message) => {
        this.handleWorkerHeartbeat(JSON.parse(message));
      });

      await this.redis.subscribe('worker:status', (message) => {
        this.handleWorkerStatusChange(JSON.parse(message));
      });

    } catch (error) {
      logger.error('Failed to connect to Redis:', error);
      throw error;
    }
  }

  /**
   * Create a new voice agent configuration
   */
  async createAgent(config: LiveKitAgentConfig): Promise<string> {
    try {
      logger.info(`Creating voice agent: ${config.name} for company ${config.companyId}`);

      // Create agent in database using supabase service
      const agent = await supabase.createVoiceAgent({
        name: config.name,
        description: `Voice agent with LiveKit integration - Phone: ${config.phoneNumber || 'N/A'}`,
        systemPrompt: config.instructions,
        voice: config.voice,
        model: config.model as any, // Type assertion for model compatibility
        metadata: { phoneNumber: config.phoneNumber } // Store phone number in metadata
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

      logger.info(`Successfully created voice agent ${agent.id}`);
      return agent.id;

    } catch (error) {
      logger.error('Error creating voice agent:', error);
      throw error;
    }
  }

  /**
   * Deploy agent to a LiveKit room
   */
  async deployAgentToRoom(agentId: string, roomName: string): Promise<AgentSession> {
    try {
      logger.info(`Deploying agent ${agentId} to room ${roomName}`);

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
      const sessionId = crypto.randomUUID();
      const session: AgentSession = {
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

      logger.info(`Successfully deployed agent ${agentId} to room ${roomName} with session ${sessionId}`);
      this.emit('agent:deployed', { agentId, roomName, sessionId });

      return session;

    } catch (error) {
      logger.error('Error deploying agent to room:', error);
      throw error;
    }
  }

  /**
   * Stop an agent session
   */
  async stopAgentSession(sessionId: string): Promise<void> {
    try {
      const session = this.sessions.get(sessionId);
      if (!session) {
        throw new Error(`Session ${sessionId} not found`);
      }

      logger.info(`Stopping agent session ${sessionId}`);

      // Update session status
      session.status = 'stopped';
      session.endedAt = new Date();

      // Free up the worker
      await this.releaseWorker(session.workerId);

      // Clean up session
      this.sessions.delete(sessionId);

      // Store session history in database (if needed)
      await this.archiveSession(session);

      logger.info(`Successfully stopped agent session ${sessionId}`);
      this.emit('session:stopped', { sessionId, agentId: session.agentId });

    } catch (error) {
      logger.error('Error stopping agent session:', error);
      throw error;
    }
  }

  /**
   * Process knowledge base files for RAG integration
   */
  private async processKnowledgeBaseFiles(agentId: string, fileIds: string[], companyId: string): Promise<void> {
    try {
      logger.info(`Processing ${fileIds.length} knowledge base files for agent ${agentId}`);

      for (const fileId of fileIds) {
        // Get file information
        const file = await supabase.getFileById(fileId, companyId);
        if (!file) {
          logger.warn(`Knowledge base file ${fileId} not found`);
          continue;
        }

        // Check if file is processed
        if (file.processingStatus !== 'processed') {
          logger.warn(`Knowledge base file ${fileId} not yet processed, status: ${file.processingStatus}`);
          continue;
        }

        // Add file to agent
        await supabase.addFileToAgent(agentId, fileId, companyId, 'system');
        
        // Cache file content for quick retrieval
        this.knowledgeCache.set(`${agentId}:${fileId}`, {
          fileId,
          filename: file.filename,
          content: file.contentPreview,
          processedAt: file.updatedAt
        });
      }

      logger.info(`Successfully processed knowledge base files for agent ${agentId}`);

    } catch (error) {
      logger.error(`Error processing knowledge base files for agent ${agentId}:`, error);
      throw error;
    }
  }

  /**
   * Get agent configuration
   */
  private async getAgentConfig(agentId: string): Promise<LiveKitAgentConfig | null> {
    try {
      const config = await this.redis.hGet(`agent:${agentId}`, 'config');
      return config ? JSON.parse(config) : null;
    } catch (error) {
      logger.error(`Error getting agent config for ${agentId}:`, error);
      return null;
    }
  }

  /**
   * Find an available worker for the company
   */
  private async findAvailableWorker(companyId: string): Promise<LiveKitWorker | null> {
    const availableWorkers = Array.from(this.workers.values())
      .filter(worker => worker.status === 'available' && worker.currentLoad < worker.maxCapacity);

    if (availableWorkers.length === 0) {
      return null;
    }

    // Return worker with lowest load
    return availableWorkers.reduce((prev, current) => 
      prev.currentLoad < current.currentLoad ? prev : current
    );
  }

  /**
   * Ensure LiveKit room exists
   */
  private async ensureRoom(roomName: string, companyId: string): Promise<any> {
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

      logger.info(`Created LiveKit room: ${roomName} for company ${companyId}`);
      return room;

    } catch (error) {
      logger.error(`Error ensuring room ${roomName}:`, error);
      throw error;
    }
  }

  /**
   * Start agent worker process
   */
  private async startAgentWorker(config: LiveKitAgentConfig, session: AgentSession, room: any): Promise<void> {
    try {
      logger.info(`Starting agent worker for session ${session.id}`);

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
      
      logger.info(`Agent worker started for session ${session.id}`);

    } catch (error) {
      logger.error(`Error starting agent worker for session ${session.id}:`, error);
      throw error;
    }
  }

  /**
   * Handle worker heartbeat
   */
  private handleWorkerHeartbeat(data: any): void {
    const { workerId, status, load, capabilities } = data;
    
    if (this.workers.has(workerId)) {
      const worker = this.workers.get(workerId)!;
      worker.lastHeartbeat = new Date();
      worker.currentLoad = load;
      worker.status = status;
    } else {
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
  private handleWorkerStatusChange(data: any): void {
    const { workerId, status } = data;
    
    if (this.workers.has(workerId)) {
      const worker = this.workers.get(workerId)!;
      worker.status = status;
      logger.info(`Worker ${workerId} status changed to ${status}`);
    }
  }

  /**
   * Start worker heartbeat monitoring
   */
  private startWorkerHeartbeatMonitoring(): void {
    setInterval(() => {
      const now = new Date();
      const timeoutMs = 30000; // 30 seconds

      for (const [workerId, worker] of this.workers.entries()) {
        if (now.getTime() - worker.lastHeartbeat.getTime() > timeoutMs) {
          logger.warn(`Worker ${workerId} heartbeat timeout, marking as offline`);
          worker.status = 'offline';
        }
      }
    }, 10000); // Check every 10 seconds
  }

  /**
   * Assign worker to session
   */
  private async assignWorkerToSession(workerId: string, sessionId: string): Promise<void> {
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
  private async releaseWorker(workerId: string): Promise<void> {
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
  private async archiveSession(session: AgentSession): Promise<void> {
    try {
      // Store session data for analytics and billing
      await this.redis.hSet(`session:archive:${session.id}`, {
        agentId: session.agentId,
        companyId: session.companyId,
        duration: session.endedAt ? session.endedAt.getTime() - session.startedAt.getTime() : 0,
        interactions: JSON.stringify(session.interactions),
        archivedAt: new Date().toISOString()
      });

      logger.info(`Archived session ${session.id}`);
    } catch (error) {
      logger.error(`Error archiving session ${session.id}:`, error);
    }
  }

  /**
   * Get active agent sessions
   */
  getActiveAgentSessions(): AgentSession[] {
    return Array.from(this.sessions.values()).filter(session => session.status === 'active');
  }

  /**
   * Get worker statistics
   */
  async getWorkerStats(): Promise<WorkerStats> {
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
      }, {} as Record<string, number>)
    };
  }

  /**
   * Cleanup and shutdown
   */
  async shutdown(): Promise<void> {
    try {
      logger.info('Shutting down LiveKit Agent Orchestrator');

      // Stop all active sessions
      for (const session of this.sessions.values()) {
        await this.stopAgentSession(session.id);
      }

      // Disconnect Redis
      await this.redis.disconnect();

      logger.info('LiveKit Agent Orchestrator shutdown complete');
    } catch (error) {
      logger.error('Error during shutdown:', error);
    }
  }
} 