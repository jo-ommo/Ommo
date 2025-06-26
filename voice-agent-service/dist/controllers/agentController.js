"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AgentController = void 0;
const supabase_1 = require("../services/supabase");
const logger_1 = require("../utils/logger");
class AgentController {
    constructor() {
        this.createAgent = async (request, reply) => {
            const logger = (0, logger_1.createContextualLogger)({
                tenantId: request.tenantId,
                userId: request.userId,
                requestId: `create_agent_${Date.now()}`
            });
            try {
                const body = request.body;
                const companyId = request.companyId; // Keep as string since Supabase expects UUID
                const userId = request.userId;
                logger.info({ agentName: body.name }, 'Creating voice agent');
                const agent = await this.supabaseService.createVoiceAgent(body, companyId, userId);
                if (!agent) {
                    reply.code(500).send({
                        success: false,
                        error: 'Failed to create voice agent',
                        timestamp: Date.now()
                    });
                    return;
                }
                logger.info({ agentId: agent.id, agentName: agent.name }, 'Voice agent created successfully');
                reply.code(201).send({
                    success: true,
                    data: agent,
                    message: 'Voice agent created successfully'
                });
            }
            catch (error) {
                (0, logger_1.logError)({ tenantId: request.tenantId, userId: request.userId }, error, { operation: 'create_agent' });
                reply.code(500).send({
                    success: false,
                    error: 'Failed to create voice agent',
                    message: error instanceof Error ? error.message : 'Unknown error',
                    timestamp: Date.now()
                });
            }
        };
        this.getAgent = async (request, reply) => {
            const logger = (0, logger_1.createContextualLogger)({
                tenantId: request.tenantId,
                userId: request.userId,
                requestId: `get_agent_${Date.now()}`
            });
            try {
                const params = request.params;
                const { agentId } = params;
                const companyId = request.companyId; // Keep as string
                logger.info({ agentId }, 'Retrieving voice agent');
                const agent = await this.supabaseService.getVoiceAgentById(agentId, companyId);
                if (!agent) {
                    reply.code(404).send({
                        success: false,
                        error: 'Voice agent not found',
                        timestamp: Date.now()
                    });
                    return;
                }
                reply.send({
                    success: true,
                    data: agent
                });
            }
            catch (error) {
                (0, logger_1.logError)({ tenantId: request.tenantId, userId: request.userId }, error, { operation: 'get_agent', agentId: request.params.agentId });
                reply.code(500).send({
                    success: false,
                    error: 'Failed to retrieve voice agent',
                    message: error instanceof Error ? error.message : 'Unknown error',
                    timestamp: Date.now()
                });
            }
        };
        this.updateAgent = async (request, reply) => {
            const logger = (0, logger_1.createContextualLogger)({
                tenantId: request.tenantId,
                userId: request.userId,
                requestId: `update_agent_${Date.now()}`
            });
            try {
                const params = request.params;
                const { agentId } = params;
                const body = request.body;
                const companyId = request.companyId; // Keep as string
                logger.info({ agentId, updates: Object.keys(body) }, 'Updating voice agent');
                const agent = await this.supabaseService.updateVoiceAgent(agentId, companyId, body);
                if (!agent) {
                    reply.code(404).send({
                        success: false,
                        error: 'Voice agent not found or update failed',
                        timestamp: Date.now()
                    });
                    return;
                }
                logger.info({ agentId, agentName: agent.name }, 'Voice agent updated successfully');
                reply.send({
                    success: true,
                    data: agent,
                    message: 'Voice agent updated successfully'
                });
            }
            catch (error) {
                (0, logger_1.logError)({ tenantId: request.tenantId, userId: request.userId }, error, { operation: 'update_agent', agentId: request.params.agentId });
                reply.code(500).send({
                    success: false,
                    error: 'Failed to update voice agent',
                    message: error instanceof Error ? error.message : 'Unknown error',
                    timestamp: Date.now()
                });
            }
        };
        this.deleteAgent = async (request, reply) => {
            const logger = (0, logger_1.createContextualLogger)({
                tenantId: request.tenantId,
                userId: request.userId,
                requestId: `delete_agent_${Date.now()}`
            });
            try {
                const params = request.params;
                const { agentId } = params;
                const companyId = request.companyId; // Keep as string
                logger.info({ agentId }, 'Deleting voice agent');
                const success = await this.supabaseService.deleteVoiceAgent(agentId, companyId);
                if (!success) {
                    reply.code(404).send({
                        success: false,
                        error: 'Voice agent not found or delete failed',
                        timestamp: Date.now()
                    });
                    return;
                }
                logger.info({ agentId }, 'Voice agent deleted successfully');
                reply.send({
                    success: true,
                    message: 'Voice agent deleted successfully'
                });
            }
            catch (error) {
                (0, logger_1.logError)({ tenantId: request.tenantId, userId: request.userId }, error, { operation: 'delete_agent', agentId: request.params.agentId });
                reply.code(500).send({
                    success: false,
                    error: 'Failed to delete voice agent',
                    message: error instanceof Error ? error.message : 'Unknown error',
                    timestamp: Date.now()
                });
            }
        };
        this.listAgents = async (request, reply) => {
            const logger = (0, logger_1.createContextualLogger)({
                tenantId: request.tenantId,
                userId: request.userId,
                requestId: `list_agents_${Date.now()}`
            });
            try {
                const companyId = request.companyId; // Keep as string
                logger.info('Listing voice agents');
                const agents = await this.supabaseService.getVoiceAgents(companyId);
                reply.send({
                    success: true,
                    data: agents,
                    count: agents.length
                });
            }
            catch (error) {
                (0, logger_1.logError)({ tenantId: request.tenantId, userId: request.userId }, error, { operation: 'list_agents' });
                reply.code(500).send({
                    success: false,
                    error: 'Failed to list voice agents',
                    message: error instanceof Error ? error.message : 'Unknown error',
                    timestamp: Date.now()
                });
            }
        };
        // File management endpoints for knowledge base
        this.addFileToAgent = async (request, reply) => {
            const logger = (0, logger_1.createContextualLogger)({
                tenantId: request.tenantId,
                userId: request.userId,
                requestId: `add_file_to_agent_${Date.now()}`
            });
            try {
                const { agentId } = request.params;
                const { fileId } = request.body;
                const companyId = request.companyId; // Keep as string
                const userId = request.userId; // Keep as string
                logger.info({ agentId, fileId }, 'Adding file to agent');
                const success = await this.supabaseService.addFileToAgent(agentId, fileId, companyId, userId);
                if (!success) {
                    reply.code(400).send({
                        success: false,
                        error: 'Failed to add file to agent',
                        timestamp: Date.now()
                    });
                    return;
                }
                reply.send({
                    success: true,
                    message: 'File added to agent successfully'
                });
            }
            catch (error) {
                (0, logger_1.logError)({ tenantId: request.tenantId, userId: request.userId }, error, { operation: 'add_file_to_agent', agentId: request.params.agentId });
                reply.code(500).send({
                    success: false,
                    error: 'Failed to add file to agent',
                    message: error instanceof Error ? error.message : 'Unknown error',
                    timestamp: Date.now()
                });
            }
        };
        this.removeFileFromAgent = async (request, reply) => {
            const logger = (0, logger_1.createContextualLogger)({
                tenantId: request.tenantId,
                userId: request.userId,
                requestId: `remove_file_from_agent_${Date.now()}`
            });
            try {
                const { agentId, fileId } = request.params;
                const companyId = request.companyId; // Keep as string
                logger.info({ agentId, fileId }, 'Removing file from agent');
                const success = await this.supabaseService.removeFileFromAgent(agentId, fileId, companyId);
                if (!success) {
                    reply.code(400).send({
                        success: false,
                        error: 'Failed to remove file from agent',
                        timestamp: Date.now()
                    });
                    return;
                }
                reply.send({
                    success: true,
                    message: 'File removed from agent successfully'
                });
            }
            catch (error) {
                (0, logger_1.logError)({ tenantId: request.tenantId, userId: request.userId }, error, { operation: 'remove_file_from_agent', agentId: request.params.agentId });
                reply.code(500).send({
                    success: false,
                    error: 'Failed to remove file from agent',
                    message: error instanceof Error ? error.message : 'Unknown error',
                    timestamp: Date.now()
                });
            }
        };
        this.getAgentFiles = async (request, reply) => {
            const logger = (0, logger_1.createContextualLogger)({
                tenantId: request.tenantId,
                userId: request.userId,
                requestId: `get_agent_files_${Date.now()}`
            });
            try {
                const { agentId } = request.params;
                const companyId = request.companyId; // Keep as string
                logger.info({ agentId }, 'Getting agent files');
                const files = await this.supabaseService.getAgentFiles(agentId, companyId);
                reply.send({
                    success: true,
                    data: files,
                    count: files.length
                });
            }
            catch (error) {
                (0, logger_1.logError)({ tenantId: request.tenantId, userId: request.userId }, error, { operation: 'get_agent_files', agentId: request.params.agentId });
                reply.code(500).send({
                    success: false,
                    error: 'Failed to get agent files',
                    message: error instanceof Error ? error.message : 'Unknown error',
                    timestamp: Date.now()
                });
            }
        };
        this.supabaseService = new supabase_1.SupabaseService();
    }
}
exports.AgentController = AgentController;
//# sourceMappingURL=agentController.js.map