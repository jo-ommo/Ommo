import { FastifyRequest, FastifyReply } from 'fastify';
import { LiveKitAgentOrchestrator } from '../services/livekit-agent.service';
import { CreateVoiceAgentRequest, UpdateVoiceAgentRequest } from '../types';
export declare class VoiceAgentController {
    private orchestrator;
    constructor(orchestrator: LiveKitAgentOrchestrator);
    /**
     * Create a new voice agent with RAG capabilities
     */
    createVoiceAgent(request: FastifyRequest<{
        Body: CreateVoiceAgentRequest;
    }>, reply: FastifyReply): Promise<void>;
    /**
     * Get all voice agents for a company
     */
    getVoiceAgents(request: FastifyRequest, reply: FastifyReply): Promise<void>;
    /**
     * Get a specific voice agent by ID
     */
    getVoiceAgent(request: FastifyRequest<{
        Params: {
            agentId: string;
        };
    }>, reply: FastifyReply): Promise<void>;
    /**
     * Update a voice agent
     */
    updateVoiceAgent(request: FastifyRequest<{
        Params: {
            agentId: string;
        };
        Body: UpdateVoiceAgentRequest;
    }>, reply: FastifyReply): Promise<void>;
    /**
     * Delete a voice agent
     */
    deleteVoiceAgent(request: FastifyRequest<{
        Params: {
            agentId: string;
        };
    }>, reply: FastifyReply): Promise<void>;
    /**
     * Deploy agent to a LiveKit room
     */
    deployAgent(request: FastifyRequest<{
        Params: {
            agentId: string;
        };
        Body: {
            roomName: string;
        };
    }>, reply: FastifyReply): Promise<void>;
    /**
     * Stop an active agent session
     */
    stopAgent(request: FastifyRequest<{
        Params: {
            agentId: string;
        };
        Body: {
            sessionId?: string;
        };
    }>, reply: FastifyReply): Promise<void>;
    /**
     * Get agent performance metrics
     */
    getAgentMetrics(request: FastifyRequest<{
        Params: {
            agentId: string;
        };
        Querystring: {
            startDate?: string;
            endDate?: string;
            timeframe?: 'hour' | 'day' | 'week' | 'month';
        };
    }>, reply: FastifyReply): Promise<void>;
    /**
     * Get worker status and statistics
     */
    getWorkerStats(request: FastifyRequest, reply: FastifyReply): Promise<void>;
    /**
     * Get active agent sessions
     */
    getActiveSessions(request: FastifyRequest, reply: FastifyReply): Promise<void>;
    /**
     * Update agent knowledge base files
     */
    private updateAgentKnowledgeFiles;
    /**
     * Test agent configuration without deployment
     */
    testAgent(request: FastifyRequest<{
        Params: {
            agentId: string;
        };
        Body: {
            testMessage?: string;
        };
    }>, reply: FastifyReply): Promise<void>;
}
//# sourceMappingURL=voice-agent.controller.d.ts.map