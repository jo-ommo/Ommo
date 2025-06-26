import type { FastifyRequest, FastifyReply } from 'fastify';
import { SupabaseService } from '../services/supabase';
import { createContextualLogger, logError } from '../utils/logger';
import type { 
  VoiceAgentCreateRequest, 
  VoiceAgentUpdateRequest,
  VoiceAgentConfig 
} from '../types';

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

export class AgentController {
  private supabaseService: SupabaseService;

  constructor() {
    this.supabaseService = new SupabaseService();
  }

  public createAgent = async (
    request: CreateAgentRequest,
    reply: FastifyReply
  ): Promise<void> => {
    const logger = createContextualLogger({
      tenantId: request.tenantId,
      userId: request.userId,
      requestId: `create_agent_${Date.now()}`
    });

    try {
      const body = request.body as VoiceAgentCreateRequest;
      const companyId = request.companyId; // Keep as string since Supabase expects UUID
      const userId = request.userId;

      logger.info({ agentName: body.name }, 'Creating voice agent');

      const agent = await this.supabaseService.createVoiceAgent(
        body,
        companyId,
        userId
      );

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
    } catch (error) {
      logError(
        { tenantId: request.tenantId, userId: request.userId },
        error as Error,
        { operation: 'create_agent' }
      );

      reply.code(500).send({
        success: false,
        error: 'Failed to create voice agent',
        message: error instanceof Error ? error.message : 'Unknown error',
        timestamp: Date.now()
      });
    }
  };

  public getAgent = async (
    request: GetAgentRequest,
    reply: FastifyReply
  ): Promise<void> => {
    const logger = createContextualLogger({
      tenantId: request.tenantId,
      userId: request.userId,
      requestId: `get_agent_${Date.now()}`
    });

    try {
      const params = request.params as { agentId: string };
      const { agentId } = params;
      const companyId = request.companyId; // Keep as string

      logger.info({ agentId }, 'Retrieving voice agent');

      const agent = await this.supabaseService.getVoiceAgentById(
        agentId,
        companyId
      );

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
    } catch (error) {
      logError(
        { tenantId: request.tenantId, userId: request.userId },
        error as Error,
        { operation: 'get_agent', agentId: (request.params as any).agentId }
      );

      reply.code(500).send({
        success: false,
        error: 'Failed to retrieve voice agent',
        message: error instanceof Error ? error.message : 'Unknown error',
        timestamp: Date.now()
      });
    }
  };

  public updateAgent = async (
    request: UpdateAgentRequest,
    reply: FastifyReply
  ): Promise<void> => {
    const logger = createContextualLogger({
      tenantId: request.tenantId,
      userId: request.userId,
      requestId: `update_agent_${Date.now()}`
    });

    try {
      const params = request.params as { agentId: string };
      const { agentId } = params;
      const body = request.body as VoiceAgentUpdateRequest;
      const companyId = request.companyId; // Keep as string

      logger.info({ agentId, updates: Object.keys(body) }, 'Updating voice agent');

      const agent = await this.supabaseService.updateVoiceAgent(
        agentId,
        companyId,
        body
      );

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
    } catch (error) {
      logError(
        { tenantId: request.tenantId, userId: request.userId },
        error as Error,
        { operation: 'update_agent', agentId: (request.params as any).agentId }
      );

      reply.code(500).send({
        success: false,
        error: 'Failed to update voice agent',
        message: error instanceof Error ? error.message : 'Unknown error',
        timestamp: Date.now()
      });
    }
  };

  public deleteAgent = async (
    request: DeleteAgentRequest,
    reply: FastifyReply
  ): Promise<void> => {
    const logger = createContextualLogger({
      tenantId: request.tenantId,
      userId: request.userId,
      requestId: `delete_agent_${Date.now()}`
    });

    try {
      const params = request.params as { agentId: string };
      const { agentId } = params;
      const companyId = request.companyId; // Keep as string

      logger.info({ agentId }, 'Deleting voice agent');

      const success = await this.supabaseService.deleteVoiceAgent(
        agentId,
        companyId
      );

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
    } catch (error) {
      logError(
        { tenantId: request.tenantId, userId: request.userId },
        error as Error,
        { operation: 'delete_agent', agentId: (request.params as any).agentId }
      );

      reply.code(500).send({
        success: false,
        error: 'Failed to delete voice agent',
        message: error instanceof Error ? error.message : 'Unknown error',
        timestamp: Date.now()
      });
    }
  };

  public listAgents = async (
    request: AuthenticatedRequest,
    reply: FastifyReply
  ): Promise<void> => {
    const logger = createContextualLogger({
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
    } catch (error) {
      logError(
        { tenantId: request.tenantId, userId: request.userId },
        error as Error,
        { operation: 'list_agents' }
      );

      reply.code(500).send({
        success: false,
        error: 'Failed to list voice agents',
        message: error instanceof Error ? error.message : 'Unknown error',
        timestamp: Date.now()
      });
    }
  };

  // File management endpoints for knowledge base
  public addFileToAgent = async (
    request: FastifyRequest & {
      tenantId: string;
      userId: string;
      companyId: string;
      params: { agentId: string };
      body: { fileId: string };
    },
    reply: FastifyReply
  ): Promise<void> => {
    const logger = createContextualLogger({
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

      const success = await this.supabaseService.addFileToAgent(
        agentId,
        fileId,
        companyId,
        userId
      );

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
    } catch (error) {
      logError(
        { tenantId: request.tenantId, userId: request.userId },
        error as Error,
        { operation: 'add_file_to_agent', agentId: request.params.agentId }
      );

      reply.code(500).send({
        success: false,
        error: 'Failed to add file to agent',
        message: error instanceof Error ? error.message : 'Unknown error',
        timestamp: Date.now()
      });
    }
  };

  public removeFileFromAgent = async (
    request: FastifyRequest & {
      tenantId: string;
      userId: string;
      companyId: string;
      params: { agentId: string; fileId: string };
    },
    reply: FastifyReply
  ): Promise<void> => {
    const logger = createContextualLogger({
      tenantId: request.tenantId,
      userId: request.userId,
      requestId: `remove_file_from_agent_${Date.now()}`
    });

    try {
      const { agentId, fileId } = request.params;
      const companyId = request.companyId; // Keep as string

      logger.info({ agentId, fileId }, 'Removing file from agent');

      const success = await this.supabaseService.removeFileFromAgent(
        agentId,
        fileId,
        companyId
      );

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
    } catch (error) {
      logError(
        { tenantId: request.tenantId, userId: request.userId },
        error as Error,
        { operation: 'remove_file_from_agent', agentId: request.params.agentId }
      );

      reply.code(500).send({
        success: false,
        error: 'Failed to remove file from agent',
        message: error instanceof Error ? error.message : 'Unknown error',
        timestamp: Date.now()
      });
    }
  };

  public getAgentFiles = async (
    request: FastifyRequest & {
      tenantId: string;
      userId: string;
      companyId: string;
      params: { agentId: string };
    },
    reply: FastifyReply
  ): Promise<void> => {
    const logger = createContextualLogger({
      tenantId: request.tenantId,
      userId: request.userId,
      requestId: `get_agent_files_${Date.now()}`
    });

    try {
      const { agentId } = request.params;
      const companyId = request.companyId; // Keep as string

      logger.info({ agentId }, 'Getting agent files');

      const files = await this.supabaseService.getAgentFiles(
        agentId,
        companyId
      );

      reply.send({
        success: true,
        data: files,
        count: files.length
      });
    } catch (error) {
      logError(
        { tenantId: request.tenantId, userId: request.userId },
        error as Error,
        { operation: 'get_agent_files', agentId: request.params.agentId }
      );

      reply.code(500).send({
        success: false,
        error: 'Failed to get agent files',
        message: error instanceof Error ? error.message : 'Unknown error',
        timestamp: Date.now()
      });
    }
  };
}