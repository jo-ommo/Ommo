import { EventEmitter } from 'events';
import { AgentSession } from '../types';
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
export declare class LiveKitAgentOrchestrator extends EventEmitter {
    private redis;
    private roomService;
    private workers;
    private sessions;
    private knowledgeCache;
    constructor();
    private initializeRedis;
    /**
     * Create a new voice agent configuration
     */
    createAgent(config: LiveKitAgentConfig): Promise<string>;
    /**
     * Deploy agent to a LiveKit room
     */
    deployAgentToRoom(agentId: string, roomName: string): Promise<AgentSession>;
    /**
     * Stop an agent session
     */
    stopAgentSession(sessionId: string): Promise<void>;
    /**
     * Process knowledge base files for RAG integration
     */
    private processKnowledgeBaseFiles;
    /**
     * Get agent configuration
     */
    private getAgentConfig;
    /**
     * Find an available worker for the company
     */
    private findAvailableWorker;
    /**
     * Ensure LiveKit room exists
     */
    private ensureRoom;
    /**
     * Start agent worker process
     */
    private startAgentWorker;
    /**
     * Handle worker heartbeat
     */
    private handleWorkerHeartbeat;
    /**
     * Handle worker status change
     */
    private handleWorkerStatusChange;
    /**
     * Start worker heartbeat monitoring
     */
    private startWorkerHeartbeatMonitoring;
    /**
     * Assign worker to session
     */
    private assignWorkerToSession;
    /**
     * Release worker from session
     */
    private releaseWorker;
    /**
     * Archive completed session
     */
    private archiveSession;
    /**
     * Get active agent sessions
     */
    getActiveAgentSessions(): AgentSession[];
    /**
     * Get worker statistics
     */
    getWorkerStats(): Promise<WorkerStats>;
    /**
     * Cleanup and shutdown
     */
    shutdown(): Promise<void>;
}
//# sourceMappingURL=livekit-agent.service.d.ts.map