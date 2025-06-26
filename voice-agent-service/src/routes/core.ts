import type { FastifyInstance } from 'fastify';
import { AgentController } from '../controllers/agentController';
import { FileController } from '../controllers/fileController';
import { SupabaseService } from '../services/supabase';

export async function coreRoutes(fastify: FastifyInstance) {
  const agentController = new AgentController();
  const fileController = new FileController();
  const supabaseService = new SupabaseService();

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
    preHandler: [(fastify as any).authenticate]
  }, async (request: any, reply: any) => {
    return agentController.createAgent(request, reply);
  });

  // List all agents for company
  fastify.get('/agents', {
    preHandler: [(fastify as any).authenticate]
  }, async (request: any, reply: any) => {
    return agentController.listAgents(request, reply);
  });

  // Get specific agent
  fastify.get('/agents/:agentId', {
    preHandler: [(fastify as any).authenticate]
  }, async (request: any, reply: any) => {
    return agentController.getAgent(request, reply);
  });

  // Update agent
  fastify.put('/agents/:agentId', {
    preHandler: [(fastify as any).authenticate]
  }, async (request: any, reply: any) => {
    return agentController.updateAgent(request, reply);
  });

  // Delete agent
  fastify.delete('/agents/:agentId', {
    preHandler: [(fastify as any).authenticate]
  }, async (request: any, reply: any) => {
    return agentController.deleteAgent(request, reply);
  });

  // ================================================================
  // KNOWLEDGE BASE FILE MANAGEMENT
  // ================================================================
  
  // Upload knowledge base file
  fastify.post('/files', {
    preHandler: [(fastify as any).authenticate]
  }, async (request: any, reply: any) => {
    return fileController.uploadFile(request, reply);
  });

  // List all files for company
  fastify.get('/files', {
    preHandler: [(fastify as any).authenticate]
  }, async (request: any, reply: any) => {
    return fileController.listFiles(request, reply);
  });

  // Get specific file
  fastify.get('/files/:fileId', {
    preHandler: [(fastify as any).authenticate]
  }, async (request: any, reply: any) => {
    return fileController.getFile(request, reply);
  });

  // Delete file
  fastify.delete('/files/:fileId', {
    preHandler: [(fastify as any).authenticate]
  }, async (request: any, reply: any) => {
    return fileController.deleteFile(request, reply);
  });

  // ================================================================
  // AGENT-FILE RELATIONSHIPS
  // ================================================================
  
  // Add file to agent's knowledge base
  fastify.post('/agents/:agentId/files', {
    preHandler: [(fastify as any).authenticate]
  }, async (request: any, reply: any) => {
    return agentController.addFileToAgent(request, reply);
  });

  // Remove file from agent's knowledge base
  fastify.delete('/agents/:agentId/files/:fileId', {
    preHandler: [(fastify as any).authenticate]
  }, async (request: any, reply: any) => {
    return agentController.removeFileFromAgent(request, reply);
  });

  // Get all files for an agent
  fastify.get('/agents/:agentId/files', {
    preHandler: [(fastify as any).authenticate]
  }, async (request: any, reply: any) => {
    return agentController.getAgentFiles(request, reply);
  });

  // ================================================================
  // COMPANY & PROFILE MANAGEMENT
  // ================================================================
  
  // Get current user's company
  fastify.get('/company', {
    preHandler: [(fastify as any).authenticate]
  }, async (request: any, reply) => {
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
    } catch (error) {
      reply.code(500).send({
        success: false,
        error: 'Failed to retrieve company information'
      });
    }
  });

  // Get current user's profile
  fastify.get('/profile', {
    preHandler: [(fastify as any).authenticate]
  }, async (request: any, reply) => {
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
    } catch (error) {
      reply.code(500).send({
        success: false,
        error: 'Failed to retrieve profile information'
      });
    }
  });
} 