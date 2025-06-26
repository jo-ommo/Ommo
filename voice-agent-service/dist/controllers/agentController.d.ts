import type { FastifyRequest, FastifyReply } from 'fastify';
import type { VoiceAgentCreateRequest, VoiceAgentUpdateRequest } from '../types';
interface AuthenticatedRequest extends FastifyRequest {
    tenantId: string;
    userId: string;
    companyId: string;
}
interface CreateAgentRequest extends AuthenticatedRequest {
    Body: VoiceAgentCreateRequest;
}
interface UpdateAgentRequest extends AuthenticatedRequest {
    Params: {
        agentId: string;
    };
    Body: VoiceAgentUpdateRequest;
}
interface GetAgentRequest extends AuthenticatedRequest {
    Params: {
        agentId: string;
    };
}
interface DeleteAgentRequest extends AuthenticatedRequest {
    Params: {
        agentId: string;
    };
}
export declare class AgentController {
    private supabaseService;
    constructor();
    createAgent: (request: CreateAgentRequest, reply: FastifyReply) => Promise<void>;
    getAgent: (request: GetAgentRequest, reply: FastifyReply) => Promise<void>;
    updateAgent: (request: UpdateAgentRequest, reply: FastifyReply) => Promise<void>;
    deleteAgent: (request: DeleteAgentRequest, reply: FastifyReply) => Promise<void>;
    listAgents: (request: AuthenticatedRequest, reply: FastifyReply) => Promise<void>;
    addFileToAgent: (request: FastifyRequest & {
        tenantId: string;
        userId: string;
        companyId: string;
        params: {
            agentId: string;
        };
        body: {
            fileId: string;
        };
    }, reply: FastifyReply) => Promise<void>;
    removeFileFromAgent: (request: FastifyRequest & {
        tenantId: string;
        userId: string;
        companyId: string;
        params: {
            agentId: string;
            fileId: string;
        };
    }, reply: FastifyReply) => Promise<void>;
    getAgentFiles: (request: FastifyRequest & {
        tenantId: string;
        userId: string;
        companyId: string;
        params: {
            agentId: string;
        };
    }, reply: FastifyReply) => Promise<void>;
}
export {};
//# sourceMappingURL=agentController.d.ts.map