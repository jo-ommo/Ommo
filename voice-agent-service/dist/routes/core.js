"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.coreRoutes = coreRoutes;
const agentController_1 = require("../controllers/agentController");
const fileController_1 = require("../controllers/fileController");
const supabase_1 = require("../services/supabase");
async function coreRoutes(fastify) {
    const agentController = new agentController_1.AgentController();
    const fileController = new fileController_1.FileController();
    const supabaseService = new supabase_1.SupabaseService();
    // ================================================================
    // HEALTH CHECK
    // ================================================================
    fastify.get('/health', async (request, reply) => {
        const supabaseConnected = await supabaseService.checkConnection();
        return {
            status: 'healthy',
            timestamp: Date.now(),
            service: 'ommo-voice-agent-service',
            version: '1.0.0',
            services: {
                supabase: supabaseConnected ? 'connected' : 'disconnected'
            }
        };
    });
    // ================================================================
    // VOICE AGENT MANAGEMENT
    // ================================================================
    // Create voice agent
    fastify.post('/agents', {
        preHandler: [fastify.authenticate]
    }, async (request, reply) => {
        return agentController.createAgent(request, reply);
    });
    // List all agents for company
    fastify.get('/agents', {
        preHandler: [fastify.authenticate]
    }, async (request, reply) => {
        return agentController.listAgents(request, reply);
    });
    // Get specific agent
    fastify.get('/agents/:agentId', {
        preHandler: [fastify.authenticate]
    }, async (request, reply) => {
        return agentController.getAgent(request, reply);
    });
    // Update agent
    fastify.put('/agents/:agentId', {
        preHandler: [fastify.authenticate]
    }, async (request, reply) => {
        return agentController.updateAgent(request, reply);
    });
    // Delete agent
    fastify.delete('/agents/:agentId', {
        preHandler: [fastify.authenticate]
    }, async (request, reply) => {
        return agentController.deleteAgent(request, reply);
    });
    // ================================================================
    // KNOWLEDGE BASE FILE MANAGEMENT
    // ================================================================
    // Upload knowledge base file
    fastify.post('/files', {
        preHandler: [fastify.authenticate]
    }, async (request, reply) => {
        return fileController.uploadFile(request, reply);
    });
    // List all files for company
    fastify.get('/files', {
        preHandler: [fastify.authenticate]
    }, async (request, reply) => {
        return fileController.listFiles(request, reply);
    });
    // Get specific file
    fastify.get('/files/:fileId', {
        preHandler: [fastify.authenticate]
    }, async (request, reply) => {
        return fileController.getFile(request, reply);
    });
    // Delete file
    fastify.delete('/files/:fileId', {
        preHandler: [fastify.authenticate]
    }, async (request, reply) => {
        return fileController.deleteFile(request, reply);
    });
    // ================================================================
    // AGENT-FILE RELATIONSHIPS
    // ================================================================
    // Add file to agent's knowledge base
    fastify.post('/agents/:agentId/files', {
        preHandler: [fastify.authenticate]
    }, async (request, reply) => {
        return agentController.addFileToAgent(request, reply);
    });
    // Remove file from agent's knowledge base
    fastify.delete('/agents/:agentId/files/:fileId', {
        preHandler: [fastify.authenticate]
    }, async (request, reply) => {
        return agentController.removeFileFromAgent(request, reply);
    });
    // Get all files for an agent
    fastify.get('/agents/:agentId/files', {
        preHandler: [fastify.authenticate]
    }, async (request, reply) => {
        return agentController.getAgentFiles(request, reply);
    });
    // ================================================================
    // COMPANY & PROFILE MANAGEMENT
    // ================================================================
    // Get current user's company
    fastify.get('/company', {
        preHandler: [fastify.authenticate]
    }, async (request, reply) => {
        try {
            const company = await supabaseService.getCompanyById(request.companyId);
            if (!company) {
                return reply.code(404).send({
                    success: false,
                    error: 'Company not found'
                });
            }
            reply.send({
                success: true,
                data: company
            });
        }
        catch (error) {
            reply.code(500).send({
                success: false,
                error: 'Failed to retrieve company information'
            });
        }
    });
    // Get current user's profile
    fastify.get('/profile', {
        preHandler: [fastify.authenticate]
    }, async (request, reply) => {
        try {
            const profile = await supabaseService.getProfileById(request.userId);
            if (!profile) {
                return reply.code(404).send({
                    success: false,
                    error: 'Profile not found'
                });
            }
            reply.send({
                success: true,
                data: profile
            });
        }
        catch (error) {
            reply.code(500).send({
                success: false,
                error: 'Failed to retrieve profile information'
            });
        }
    });
}
//# sourceMappingURL=core.js.map