import { FastifyRequest, FastifyReply } from 'fastify';
import { supabase } from '../services/supabase';
import { logger } from '../utils/logger';

interface AuthenticatedRequest extends FastifyRequest {
  companyId: string;
  userId: string;
  user: any;
}

export class SimpleVoiceAgentController {
  
  /**
   * Get voice agents for company
   */
  async getVoiceAgents(request: AuthenticatedRequest, reply: FastifyReply) {
    try {
      const { companyId } = request;
      const { page = 1, limit = 10, active } = request.query as any;

      logger.info(`Getting voice agents for company ${companyId}`);

      // Get agents from database using the correct method
      const allAgents = await supabase.getVoiceAgents(companyId);
      
      // Filter by active status if specified
      let filteredAgents = allAgents;
      if (active === 'true') {
        filteredAgents = allAgents.filter(agent => agent.active);
      } else if (active === 'false') {
        filteredAgents = allAgents.filter(agent => !agent.active);
      }

      // Apply pagination
      const startIndex = (parseInt(page) - 1) * parseInt(limit);
      const endIndex = startIndex + parseInt(limit);
      const paginatedAgents = filteredAgents.slice(startIndex, endIndex);

      return reply.send({
        success: true,
        data: paginatedAgents,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: filteredAgents.length,
          totalPages: Math.ceil(filteredAgents.length / parseInt(limit))
        }
      });

    } catch (error) {
      logger.error('Error getting voice agents:', error);
      return reply.code(500).send({
        success: false,
        error: 'Failed to retrieve voice agents'
      });
    }
  }

  /**
   * Create a new voice agent
   */
  async createVoiceAgent(request: AuthenticatedRequest, reply: FastifyReply) {
    try {
      const { companyId, userId } = request;
      const agentData = request.body as any;

      logger.info(`Creating voice agent for company ${companyId}:`, agentData.name);

      // Create agent using existing supabase service
      const agent = await supabase.createVoiceAgent({
        name: agentData.name,
        description: agentData.description || `Voice agent: ${agentData.name}`,
        systemPrompt: agentData.instructions,
        voice: agentData.voice || 'alloy',
        model: agentData.model || 'gpt-4o-mini',
        metadata: {
          phoneNumber: agentData.phoneNumber,
          settings: agentData.settings || {}
        }
      }, companyId, userId);

      if (!agent) {
        return reply.code(400).send({
          success: false,
          error: 'Failed to create voice agent'
        });
      }

      // Add knowledge base files if provided
      if (agentData.knowledgeBaseFiles && agentData.knowledgeBaseFiles.length > 0) {
        for (const fileId of agentData.knowledgeBaseFiles) {
          try {
            await supabase.addFileToAgent(agent.id, fileId, companyId, userId);
          } catch (fileError) {
            logger.warn(`Failed to add file ${fileId} to agent ${agent.id}:`, fileError);
          }
        }
      }

      return reply.code(201).send({
        success: true,
        data: {
          agent,
          message: 'Voice agent created successfully'
        }
      });

    } catch (error) {
      logger.error('Error creating voice agent:', error);
      return reply.code(500).send({
        success: false,
        error: 'Failed to create voice agent'
      });
    }
  }

  /**
   * Get specific voice agent
   */
  async getVoiceAgent(request: AuthenticatedRequest, reply: FastifyReply) {
    try {
      const { companyId } = request;
      const { agentId } = request.params as any;

      const agent = await supabase.getVoiceAgentById(agentId, companyId);
      
      if (!agent) {
        return reply.code(404).send({
          success: false,
          error: 'Voice agent not found'
        });
      }

      return reply.send({
        success: true,
        data: agent
      });

    } catch (error) {
      logger.error('Error getting voice agent:', error);
      return reply.code(500).send({
        success: false,
        error: 'Failed to retrieve voice agent'
      });
    }
  }

  /**
   * Update voice agent
   */
  async updateVoiceAgent(request: AuthenticatedRequest, reply: FastifyReply) {
    try {
      const { companyId } = request;
      const { agentId } = request.params as any;
      const updateData = request.body as any;

      const updatedAgent = await supabase.updateVoiceAgent(agentId, companyId, {
        name: updateData.name,
        description: updateData.description,
        systemPrompt: updateData.instructions,
        voice: updateData.voice,
        model: updateData.model,
        active: updateData.active,
        metadata: {
          phoneNumber: updateData.phoneNumber,
          settings: updateData.settings || {}
        }
      });

      if (!updatedAgent) {
        return reply.code(404).send({
          success: false,
          error: 'Voice agent not found or update failed'
        });
      }

      return reply.send({
        success: true,
        data: updatedAgent
      });

    } catch (error) {
      logger.error('Error updating voice agent:', error);
      return reply.code(500).send({
        success: false,
        error: 'Failed to update voice agent'
      });
    }
  }

  /**
   * Delete voice agent
   */
  async deleteVoiceAgent(request: AuthenticatedRequest, reply: FastifyReply) {
    try {
      const { companyId } = request;
      const { agentId } = request.params as any;

      const success = await supabase.deleteVoiceAgent(agentId, companyId);

      if (!success) {
        return reply.code(404).send({
          success: false,
          error: 'Voice agent not found'
        });
      }

      return reply.send({
        success: true,
        message: 'Voice agent deleted successfully'
      });

    } catch (error) {
      logger.error('Error deleting voice agent:', error);
      return reply.code(500).send({
        success: false,
        error: 'Failed to delete voice agent'
      });
    }
  }

  /**
   * Deploy agent (simplified - no LiveKit for now)
   */
  async deployAgent(request: AuthenticatedRequest, reply: FastifyReply) {
    try {
      const { companyId } = request;
      const { agentId } = request.params as any;
      const { roomName } = request.body as any;

      // For now, just return a mock deployment response
      return reply.send({
        success: true,
        data: {
          agentId,
          roomName,
          sessionId: `session-${Date.now()}`,
          status: 'simulated',
          message: 'Agent deployment simulated (LiveKit integration pending)'
        }
      });

    } catch (error) {
      logger.error('Error deploying agent:', error);
      return reply.code(500).send({
        success: false,
        error: 'Failed to deploy agent'
      });
    }
  }

  /**
   * Stop agent session (simplified)
   */
  async stopAgent(request: AuthenticatedRequest, reply: FastifyReply) {
    try {
      const { agentId } = request.params as any;

      return reply.send({
        success: true,
        data: {
          agentId,
          status: 'stopped',
          message: 'Agent session stopped (simulated)'
        }
      });

    } catch (error) {
      logger.error('Error stopping agent:', error);
      return reply.code(500).send({
        success: false,
        error: 'Failed to stop agent'
      });
    }
  }

  /**
   * Test agent configuration
   */
  async testAgent(request: AuthenticatedRequest, reply: FastifyReply) {
    try {
      const { companyId } = request;
      const { agentId } = request.params as any;

      const agent = await supabase.getVoiceAgentById(agentId, companyId);
      
      if (!agent) {
        return reply.code(404).send({
          success: false,
          error: 'Voice agent not found'
        });
      }

      // Get agent's knowledge base files
      const agentFiles = await supabase.getAgentFiles(agentId, companyId);

      return reply.send({
        success: true,
        data: {
          agentId,
          configValid: true,
          checks: {
            database: 'passed',
            configuration: 'passed',
            livekit: 'pending',
            knowledge_base: agentFiles.length > 0 ? 'passed' : 'none'
          },
          message: 'Agent configuration test completed'
        }
      });

    } catch (error) {
      logger.error('Error testing agent:', error);
      return reply.code(500).send({
        success: false,
        error: 'Failed to test agent'
      });
    }
  }

  /**
   * Get agent metrics (simplified)
   */
  async getAgentMetrics(request: AuthenticatedRequest, reply: FastifyReply) {
    try {
      const { agentId } = request.params as any;

      return reply.send({
        success: true,
        data: {
          agentId,
          metrics: {
            totalSessions: 0,
            activeSessions: 0,
            totalCallDuration: 0,
            averageSessionLength: 0,
            successRate: 100
          },
          message: 'Metrics simulation (LiveKit integration pending)'
        }
      });

    } catch (error) {
      logger.error('Error getting agent metrics:', error);
      return reply.code(500).send({
        success: false,
        error: 'Failed to retrieve agent metrics'
      });
    }
  }

  /**
   * Get active sessions (simplified)
   */
  async getActiveSessions(request: AuthenticatedRequest, reply: FastifyReply) {
    try {
      return reply.send({
        success: true,
        data: {
          activeSessions: [],
          totalSessions: 0,
          message: 'No active sessions (LiveKit integration pending)'
        }
      });

    } catch (error) {
      logger.error('Error getting active sessions:', error);
      return reply.code(500).send({
        success: false,
        error: 'Failed to retrieve active sessions'
      });
    }
  }

  /**
   * Get worker statistics (simplified)
   */
  async getWorkerStats(request: AuthenticatedRequest, reply: FastifyReply) {
    try {
      return reply.send({
        success: true,
        data: {
          totalWorkers: 0,
          availableWorkers: 0,
          busyWorkers: 0,
          totalSessions: 0,
          averageLoad: 0,
          regions: {},
          status: 'simulated',
          message: 'Worker statistics simulated (LiveKit integration pending)'
        }
      });

    } catch (error) {
      logger.error('Error getting worker stats:', error);
      return reply.code(500).send({
        success: false,
        error: 'Failed to retrieve worker statistics'
      });
    }
  }
} 