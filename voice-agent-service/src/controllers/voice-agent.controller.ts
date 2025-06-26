import { FastifyRequest, FastifyReply } from 'fastify';
import { v4 as uuidv4 } from 'uuid';
import { LiveKitAgentOrchestrator, LiveKitAgentConfig } from '../services/livekit-agent.service';
import { supabase } from '../services/supabase';
import { logger } from '../utils/logger';
import { 
  CreateVoiceAgentRequest, 
  UpdateVoiceAgentRequest, 
  VoiceAgent, 
  AgentSession,
  KnowledgeBaseFile
} from '../types';

export class VoiceAgentController {
  private orchestrator: LiveKitAgentOrchestrator;

  constructor(orchestrator: LiveKitAgentOrchestrator) {
    this.orchestrator = orchestrator;
  }

  /**
   * Create a new voice agent with RAG capabilities
   */
  async createVoiceAgent(request: FastifyRequest<{
    Body: CreateVoiceAgentRequest
  }>, reply: FastifyReply) {
    try {
      const { companyId } = request.user as { companyId: string };
      const body = request.body as CreateVoiceAgentRequest;
      const {
        name,
        instructions,
        voice = 'alloy',
        model = 'gpt-4o-mini',
        phoneNumber,
        knowledgeBaseFiles = [],
        settings = {
          interruptions_enabled: true,
          noise_suppression_enabled: true,
          voice_speed: 1.0,
          voice_pitch: 1.0,
          speech_timeout: 1.0,
          silence_timeout: 2.0
        }
      } = body;

      // Generate unique agent ID
      const agentId = uuidv4();

      // Prepare agent configuration
      const agentConfig: LiveKitAgentConfig = {
        agentId,
        companyId,
        name,
        instructions,
        voice,
        model: model as LiveKitAgentConfig['model'], // Type assertion for model compatibility
        phoneNumber,
        knowledgeBaseFiles,
        settings: {
          interruptions_enabled: settings.interruptions_enabled ?? true,
          noise_suppression_enabled: settings.noise_suppression_enabled ?? true,
          voice_speed: settings.voice_speed ?? 1.0,
          voice_pitch: settings.voice_pitch ?? 1.0,
          speech_timeout: settings.speech_timeout ?? 1.0,
          silence_timeout: settings.silence_timeout ?? 2.0
        }
      };

      // Create agent using orchestrator
      const createdAgentId = await this.orchestrator.createAgent(agentConfig);

      // Get the created agent details using the supabase service instance
      const agent = await supabase.getVoiceAgentById(createdAgentId, companyId);

      if (!agent) {
        throw new Error('Failed to retrieve created agent');
      }

      logger.info(`Created voice agent ${createdAgentId} for company ${companyId}`);

      reply.status(201).send({
        success: true,
        data: {
          agent,
          message: 'Voice agent created successfully'
        }
      });

    } catch (error) {
      logger.error('Error creating voice agent:', error);
      reply.status(400).send({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to create voice agent'
      });
    }
  }

  /**
   * Get all voice agents for a company
   */
  async getVoiceAgents(request: FastifyRequest, reply: FastifyReply) {
    try {
      const { companyId } = request.user as { companyId: string };
      const { page = 1, limit = 10, active } = request.query as any;

      // Get agents using the supabase service
      const agents = await supabase.getVoiceAgents(companyId);

      // Filter by active status if specified
      const filteredAgents = active !== undefined 
        ? agents.filter(agent => agent.active === (active === 'true'))
        : agents;

      // Apply pagination
      const offset = (page - 1) * limit;
      const paginatedAgents = filteredAgents.slice(offset, offset + limit);

      // Get agent session information from orchestrator
      const activeSessions = this.orchestrator.getActiveAgentSessions();
      const agentsWithSessions = paginatedAgents.map(agent => ({
        ...agent,
        activeSession: activeSessions.find(session => session.agentId === agent.id)
      }));

      reply.send({
        success: true,
        data: {
          agents: agentsWithSessions,
          pagination: {
            page,
            limit,
            total: filteredAgents.length,
            totalPages: Math.ceil(filteredAgents.length / limit)
          }
        }
      });

    } catch (error) {
      logger.error('Error getting voice agents:', error);
      reply.status(500).send({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get voice agents'
      });
    }
  }

  /**
   * Get a specific voice agent by ID
   */
  async getVoiceAgent(request: FastifyRequest<{
    Params: { agentId: string }
  }>, reply: FastifyReply) {
    try {
      const { companyId } = request.user as { companyId: string };
      const { agentId } = request.params;

      const agent = await supabase.getVoiceAgentById(agentId, companyId);

      if (!agent) {
        reply.status(404).send({
          success: false,
          error: 'Voice agent not found'
        });
        return;
      }

      // Get active session information
      const activeSessions = this.orchestrator.getActiveAgentSessions();
      const activeSession = activeSessions.find(session => session.agentId === agentId);

      reply.send({
        success: true,
        data: {
          agent: {
            ...agent,
            activeSession
          }
        }
      });

    } catch (error) {
      logger.error('Error getting voice agent:', error);
      reply.status(500).send({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get voice agent'
      });
    }
  }

  /**
   * Update a voice agent
   */
  async updateVoiceAgent(request: FastifyRequest<{
    Params: { agentId: string },
    Body: UpdateVoiceAgentRequest
  }>, reply: FastifyReply) {
    try {
      const { companyId } = request.user as { companyId: string };
      const { agentId } = request.params;
      const updates = request.body as UpdateVoiceAgentRequest;

      // Verify agent belongs to company
      const existingAgent = await supabase.getVoiceAgentById(agentId, companyId);

      if (!existingAgent) {
        reply.status(404).send({
          success: false,
          error: 'Voice agent not found'
        });
        return;
      }

      // Update agent using supabase service
      const updatedAgent = await supabase.updateVoiceAgent(agentId, companyId, {
        name: updates.name,
        model: updates.model as any, // Type assertion for now
        voice: updates.voice,
        systemPrompt: updates.instructions,
        active: updates.active
      });

      if (!updatedAgent) {
        throw new Error('Failed to update voice agent');
      }

      // Handle knowledge base file updates
      if (updates.knowledgeBaseFiles !== undefined) {
        await this.updateAgentKnowledgeFiles(agentId, updates.knowledgeBaseFiles, companyId);
      }

      logger.info(`Updated voice agent ${agentId} for company ${companyId}`);

      reply.send({
        success: true,
        data: {
          agent: updatedAgent,
          message: 'Voice agent updated successfully'
        }
      });

    } catch (error) {
      logger.error('Error updating voice agent:', error);
      reply.status(400).send({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to update voice agent'
      });
    }
  }

  /**
   * Delete a voice agent
   */
  async deleteVoiceAgent(request: FastifyRequest<{
    Params: { agentId: string }
  }>, reply: FastifyReply) {
    try {
      const { companyId } = request.user as { companyId: string };
      const { agentId } = request.params;

      // Check if agent has active sessions
      const activeSessions = this.orchestrator.getActiveAgentSessions();
      const activeSession = activeSessions.find(session => session.agentId === agentId);

      if (activeSession) {
        reply.status(400).send({
          success: false,
          error: 'Cannot delete agent with active sessions. Stop the agent first.'
        });
        return;
      }

      // Delete agent using supabase service
      const deleted = await supabase.deleteVoiceAgent(agentId, companyId);

      if (!deleted) {
        throw new Error('Failed to delete voice agent');
      }

      logger.info(`Deleted voice agent ${agentId} for company ${companyId}`);

      reply.send({
        success: true,
        data: {
          message: 'Voice agent deleted successfully'
        }
      });

    } catch (error) {
      logger.error('Error deleting voice agent:', error);
      reply.status(500).send({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to delete voice agent'
      });
    }
  }

  /**
   * Deploy agent to a LiveKit room
   */
  async deployAgent(request: FastifyRequest<{
    Params: { agentId: string },
    Body: { roomName: string }
  }>, reply: FastifyReply) {
    try {
      const { companyId } = request.user as { companyId: string };
      const { agentId } = request.params;
      const { roomName } = request.body as { roomName: string };

      if (!roomName) {
        reply.status(400).send({
          success: false,
          error: 'Room name is required'
        });
        return;
      }

      // Verify agent belongs to company and is active
      const agent = await supabase.getVoiceAgentById(agentId, companyId);

      if (!agent || !agent.active) {
        reply.status(404).send({
          success: false,
          error: 'Active voice agent not found'
        });
        return;
      }

      // Deploy agent to room
      await this.orchestrator.deployAgentToRoom(agentId, roomName);

      logger.info(`Deployed agent ${agentId} to room ${roomName}`);

      reply.send({
        success: true,
        data: {
          message: `Agent deployed to room ${roomName}`,
          roomName,
          agentId
        }
      });

    } catch (error) {
      logger.error('Error deploying agent:', error);
      reply.status(500).send({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to deploy agent'
      });
    }
  }

  /**
   * Stop an active agent session
   */
  async stopAgent(request: FastifyRequest<{
    Params: { agentId: string },
    Body: { sessionId?: string }
  }>, reply: FastifyReply) {
    try {
      const { companyId } = request.user as { companyId: string };
      const { agentId } = request.params;
      const { sessionId } = request.body as { sessionId?: string };

      // Find active session for this agent
      const activeSessions = this.orchestrator.getActiveAgentSessions();
      let targetSession: AgentSession | undefined;

      if (sessionId) {
        targetSession = activeSessions.find(s => s.id === sessionId && s.agentId === agentId);
      } else {
        targetSession = activeSessions.find(s => s.agentId === agentId);
      }

      if (!targetSession) {
        reply.status(404).send({
          success: false,
          error: 'No active session found for this agent'
        });
        return;
      }

      // Verify agent belongs to company
      if (targetSession.companyId !== companyId) {
        reply.status(403).send({
          success: false,
          error: 'Unauthorized to stop this agent session'
        });
        return;
      }

      // Stop the agent session
      await this.orchestrator.stopAgentSession(targetSession.id);

      logger.info(`Stopped agent session ${targetSession.id} for agent ${agentId}`);

      reply.send({
        success: true,
        data: {
          message: 'Agent session stopped successfully',
          sessionId: targetSession.id
        }
      });

    } catch (error) {
      logger.error('Error stopping agent:', error);
      reply.status(500).send({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to stop agent'
      });
    }
  }

  /**
   * Get agent performance metrics
   */
  async getAgentMetrics(request: FastifyRequest<{
    Params: { agentId: string },
    Querystring: {
      startDate?: string;
      endDate?: string;
      timeframe?: 'hour' | 'day' | 'week' | 'month';
    }
  }>, reply: FastifyReply) {
    try {
      const { companyId } = request.user as { companyId: string };
      const { agentId } = request.params;
      const { startDate, endDate, timeframe = 'day' } = request.query as any;

      // Verify agent belongs to company
      const agent = await supabase.getVoiceAgentById(agentId, companyId);

      if (!agent) {
        reply.status(404).send({
          success: false,
          error: 'Voice agent not found'
        });
        return;
      }

      // Calculate date range
      const endDateTime = endDate ? new Date(endDate) : new Date();
      const startDateTime = startDate 
        ? new Date(startDate) 
        : new Date(endDateTime.getTime() - (7 * 24 * 60 * 60 * 1000)); // 7 days ago

      // Get call sessions for metrics using supabase service
      const sessions = await supabase.getCallSessions(companyId);
      
      // Filter sessions by agent and date range
      const filteredSessions = sessions.filter(session => 
        session.agentId === agentId &&
        new Date(session.startTime).getTime() >= startDateTime.getTime() &&
        new Date(session.startTime).getTime() <= endDateTime.getTime()
      );

      // Calculate metrics
      const totalSessions = filteredSessions.length;
      const completedSessions = filteredSessions.filter(s => s.status === 'completed').length;
      const totalDuration = filteredSessions.reduce((sum, s) => {
        return sum + (s.durationSeconds || 0);
      }, 0);
      
      const averageDuration = totalSessions > 0 ? totalDuration / totalSessions : 0;
      const completionRate = totalSessions > 0 ? (completedSessions / totalSessions) * 100 : 0;

      const metrics = {
        agentId,
        agentName: agent.name,
        timeframe: {
          start: startDateTime.toISOString(),
          end: endDateTime.toISOString(),
          period: timeframe
        },
        performance: {
          totalSessions,
          completedSessions,
          completionRate: Math.round(completionRate * 100) / 100,
          averageDuration: Math.round(averageDuration),
          totalDuration: Math.round(totalDuration)
        },
        sessions: filteredSessions
      };

      reply.send({
        success: true,
        data: metrics
      });

    } catch (error) {
      logger.error('Error getting agent metrics:', error);
      reply.status(500).send({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get agent metrics'
      });
    }
  }

  /**
   * Get worker status and statistics
   */
  async getWorkerStats(request: FastifyRequest, reply: FastifyReply) {
    try {
      const stats = await this.orchestrator.getWorkerStats();
      
      reply.send({
        success: true,
        data: stats
      });

    } catch (error) {
      logger.error('Error getting worker stats:', error);
      reply.status(500).send({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get worker stats'
      });
    }
  }

  /**
   * Get active agent sessions
   */
  async getActiveSessions(request: FastifyRequest, reply: FastifyReply) {
    try {
      const { companyId } = request.user as { companyId: string };
      
      const activeSessions = this.orchestrator.getActiveAgentSessions()
        .filter(session => session.companyId === companyId);

      reply.send({
        success: true,
        data: {
          sessions: activeSessions,
          count: activeSessions.length
        }
      });

    } catch (error) {
      logger.error('Error getting active sessions:', error);
      reply.status(500).send({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get active sessions'
      });
    }
  }

  /**
   * Update agent knowledge base files
   */
  private async updateAgentKnowledgeFiles(agentId: string, fileIds: string[], companyId: string): Promise<void> {
    try {
      // Get current files linked to agent
      const currentFiles = await supabase.getAgentFiles(agentId, companyId);
      const currentFileIds = currentFiles.map(f => f.id);

      // Remove files that are no longer in the list
      for (const fileId of currentFileIds) {
        if (!fileIds.includes(fileId)) {
          await supabase.removeFileFromAgent(agentId, fileId, companyId);
        }
      }

      // Add new files
      for (const fileId of fileIds) {
        if (!currentFileIds.includes(fileId)) {
          await supabase.addFileToAgent(agentId, fileId, companyId, 'system'); // TODO: get actual user
        }
      }

      logger.info(`Updated knowledge base files for agent ${agentId}`);
    } catch (error) {
      logger.error(`Failed to update agent knowledge files for ${agentId}:`, error);
      throw error;
    }
  }

  /**
   * Test agent configuration without deployment
   */
  async testAgent(request: FastifyRequest<{
    Params: { agentId: string },
    Body: { testMessage?: string }
  }>, reply: FastifyReply) {
    try {
      const { companyId } = request.user as { companyId: string };
      const { agentId } = request.params;
      const { testMessage = "Hello, this is a test message." } = request.body as { testMessage?: string };

      // Verify agent belongs to company
      const agent = await supabase.getVoiceAgentById(agentId, companyId);

      if (!agent) {
        reply.status(404).send({
          success: false,
          error: 'Voice agent not found'
        });
        return;
      }

      // Get agent knowledge base files
      const knowledgeFiles = await supabase.getAgentFiles(agentId, companyId);

      // Create test session data
      const testResult = {
        agentId,
        agentName: agent.name,
        testMessage,
        timestamp: new Date().toISOString(),
        configuration: {
          instructions: agent.systemPrompt,
          voice: agent.voice,
          model: agent.model,
          settings: agent.metadata
        },
        knowledgeBase: {
          filesCount: knowledgeFiles.length,
          files: knowledgeFiles
        },
        status: 'ready_for_deployment'
      };

      reply.send({
        success: true,
        data: {
          testResult,
          message: 'Agent configuration test completed successfully'
        }
      });

    } catch (error) {
      logger.error('Error testing agent:', error);
      reply.status(500).send({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to test agent'
      });
    }
  }
} 