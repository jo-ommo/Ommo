import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { Database } from '../types/database';
import { VoiceAgent, VoiceAgentCreateRequest, VoiceAgentUpdateRequest, KnowledgeBaseFile, CallSession, CallTranscript, Company, Profile } from '../types';
import { logger } from '../utils/logger';

// Database type aliases for convenience
type Tables = Database['public']['Tables'];
type VoiceAgentRow = Tables['voice_agents']['Row'];
type VoiceAgentInsert = Tables['voice_agents']['Insert'];
type VoiceAgentUpdate = Tables['voice_agents']['Update'];
type KnowledgeBaseFileRow = Tables['knowledge_base_files']['Row'];
type KnowledgeBaseFileInsert = Tables['knowledge_base_files']['Insert'];
type CallSessionRow = Tables['call_sessions']['Row'];
type CallSessionInsert = Tables['call_sessions']['Insert'];
type CallTranscriptRow = Tables['call_transcripts']['Row'];
type CallTranscriptInsert = Tables['call_transcripts']['Insert'];
type ProfileRow = Tables['profiles']['Row'];
type CompanyRow = Tables['companies']['Row'];

export class SupabaseService {
  private supabase: SupabaseClient<Database>;

  constructor() {
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseAnonKey) {
      throw new Error('SUPABASE_URL and SUPABASE_ANON_KEY environment variables are required');
    }

    this.supabase = createClient<Database>(supabaseUrl, supabaseAnonKey);
  }

  // ================================================================
  // HEALTH CHECK
  // ================================================================

  async checkConnection(): Promise<boolean> {
    try {
      const { data, error } = await this.supabase
        .from('companies')
        .select('id')
        .limit(1);
      
      return !error;
    } catch (error) {
      logger.error('Supabase connection check failed:', error);
      return false;
    }
  }

  // ================================================================
  // COMPANY MANAGEMENT
  // ================================================================

  async getCompanyBySlug(slug: string): Promise<Company | null> {
    try {
      const { data, error } = await this.supabase
        .from('companies')
        .select('*')
        .eq('slug', slug)
        .single();

      if (error) {
        logger.error('Error fetching company by slug:', error);
        return null;
      }

      return this.mapCompanyRowToCompany(data);
    } catch (error) {
      logger.error('Error in getCompanyBySlug:', error);
      return null;
    }
  }

  async getCompanyById(id: string): Promise<Company | null> {
    try {
      const { data, error } = await this.supabase
        .from('companies')
        .select('*')
        .eq('id', id)
        .single();

      if (error) {
        logger.error('Error fetching company by id:', error);
        return null;
      }

      return this.mapCompanyRowToCompany(data);
    } catch (error) {
      logger.error('Error in getCompanyById:', error);
      return null;
    }
  }

  // ================================================================
  // PROFILE MANAGEMENT
  // ================================================================

  async getProfileById(id: string): Promise<Profile | null> {
    try {
      const { data, error } = await this.supabase
        .from('profiles')
        .select('*')
        .eq('id', id)
        .single();

      if (error) {
        logger.error('Error fetching profile by id:', error);
        return null;
      }

      return this.mapProfileRowToProfile(data);
    } catch (error) {
      logger.error('Error in getProfileById:', error);
      return null;
    }
  }

  async getProfilesInCompany(companyId: string): Promise<Profile[]> {
    try {
      const { data, error } = await this.supabase
        .from('profiles')
        .select('*')
        .eq('company_id', companyId)
        .order('created_at', { ascending: false });

      if (error) {
        logger.error('Error fetching profiles in company:', error);
        return [];
      }

      return (data || []).map(row => this.mapProfileRowToProfile(row));
    } catch (error) {
      logger.error('Error in getProfilesInCompany:', error);
      return [];
    }
  }

  // ================================================================
  // VOICE AGENT MANAGEMENT
  // ================================================================

  async createVoiceAgent(agentData: VoiceAgentCreateRequest, companyId: string, createdBy: string): Promise<VoiceAgent | null> {
    try {
      const insertData: VoiceAgentInsert = {
        company_id: companyId,
        name: agentData.name,
        description: agentData.description,
        model: agentData.model || 'gpt-4o',
        voice: agentData.voice || 'alloy',
        language: agentData.language || 'en',
        system_prompt: agentData.systemPrompt,
        greeting: agentData.greeting,
        temperature: agentData.temperature || 0.7,
        max_tokens: agentData.maxTokens || 150,
        response_timeout_ms: agentData.responseTimeoutMs || 5000,
        interruption_threshold_ms: agentData.interruptionThresholdMs || 300,
        active: agentData.active !== undefined ? agentData.active : true,
        webhook_url: agentData.webhookUrl,
        metadata: agentData.metadata || {},
        created_by: createdBy
      };

      const { data, error } = await this.supabase
        .from('voice_agents')
        .insert(insertData)
        .select()
        .single();

      if (error) {
        logger.error('Error creating voice agent:', error);
        return null;
      }

      return this.mapVoiceAgentRowToVoiceAgent(data);
    } catch (error) {
      logger.error('Error in createVoiceAgent:', error);
      return null;
    }
  }

  async getVoiceAgents(companyId: string): Promise<VoiceAgent[]> {
    try {
      const { data, error } = await this.supabase
        .from('voice_agents')
        .select('*')
        .eq('company_id', companyId)
        .order('created_at', { ascending: false });

      if (error) {
        logger.error('Error fetching voice agents:', error);
        return [];
      }

      return (data || []).map(row => this.mapVoiceAgentRowToVoiceAgent(row));
    } catch (error) {
      logger.error('Error in getVoiceAgents:', error);
      return [];
    }
  }

  async getVoiceAgentById(id: string, companyId: string): Promise<VoiceAgent | null> {
    try {
      const { data, error } = await this.supabase
        .from('voice_agents')
        .select('*')
        .eq('id', id)
        .eq('company_id', companyId)
        .single();

      if (error) {
        logger.error('Error fetching voice agent by id:', error);
        return null;
      }

      return this.mapVoiceAgentRowToVoiceAgent(data);
    } catch (error) {
      logger.error('Error in getVoiceAgentById:', error);
      return null;
    }
  }

  async updateVoiceAgent(id: string, companyId: string, updates: VoiceAgentUpdateRequest): Promise<VoiceAgent | null> {
    try {
      const updateData: VoiceAgentUpdate = {};
      
      if (updates.name !== undefined) updateData.name = updates.name;
      if (updates.description !== undefined) updateData.description = updates.description;
      if (updates.model !== undefined) updateData.model = updates.model;
      if (updates.voice !== undefined) updateData.voice = updates.voice;
      if (updates.language !== undefined) updateData.language = updates.language;
      if (updates.systemPrompt !== undefined) updateData.system_prompt = updates.systemPrompt;
      if (updates.greeting !== undefined) updateData.greeting = updates.greeting;
      if (updates.temperature !== undefined) updateData.temperature = updates.temperature;
      if (updates.maxTokens !== undefined) updateData.max_tokens = updates.maxTokens;
      if (updates.responseTimeoutMs !== undefined) updateData.response_timeout_ms = updates.responseTimeoutMs;
      if (updates.interruptionThresholdMs !== undefined) updateData.interruption_threshold_ms = updates.interruptionThresholdMs;
      if (updates.active !== undefined) updateData.active = updates.active;
      if (updates.webhookUrl !== undefined) updateData.webhook_url = updates.webhookUrl;
      if (updates.metadata !== undefined) updateData.metadata = updates.metadata;

      const { data, error } = await this.supabase
        .from('voice_agents')
        .update(updateData)
        .eq('id', id)
        .eq('company_id', companyId)
        .select()
        .single();

      if (error) {
        logger.error('Error updating voice agent:', error);
        return null;
      }

      return this.mapVoiceAgentRowToVoiceAgent(data);
    } catch (error) {
      logger.error('Error in updateVoiceAgent:', error);
      return null;
    }
  }

  async deleteVoiceAgent(id: string, companyId: string): Promise<boolean> {
    try {
      const { error } = await this.supabase
        .from('voice_agents')
        .delete()
        .eq('id', id)
        .eq('company_id', companyId);

      if (error) {
        logger.error('Error deleting voice agent:', error);
        return false;
      }

      return true;
    } catch (error) {
      logger.error('Error in deleteVoiceAgent:', error);
      return false;
    }
  }

  // ================================================================
  // KNOWLEDGE BASE FILE MANAGEMENT
  // ================================================================

  async uploadFile(fileData: {
    filename: string;
    originalFilename: string;
    fileSize: number;
    mimeType?: string;
    filePath: string;
    contentHash?: string;
    contentPreview?: string;
    tags?: string[];
  }, companyId: string, uploadedBy: string): Promise<KnowledgeBaseFile | null> {
    try {
      const insertData: KnowledgeBaseFileInsert = {
        company_id: companyId,
        filename: fileData.filename,
        original_filename: fileData.originalFilename,
        file_size: fileData.fileSize,
        mime_type: fileData.mimeType,
        file_path: fileData.filePath,
        content_hash: fileData.contentHash,
        content_preview: fileData.contentPreview,
        processing_status: 'uploaded',
        processing_metadata: {},
        tags: fileData.tags || [],
        uploaded_by: uploadedBy
      };

      const { data, error } = await this.supabase
        .from('knowledge_base_files')
        .insert(insertData)
        .select()
        .single();

      if (error) {
        logger.error('Error uploading file:', error);
        return null;
      }

      return this.mapKnowledgeBaseFileRowToKnowledgeBaseFile(data);
    } catch (error) {
      logger.error('Error in uploadFile:', error);
      return null;
    }
  }

  async getFiles(companyId: string): Promise<KnowledgeBaseFile[]> {
    try {
      const { data, error } = await this.supabase
        .from('knowledge_base_files')
        .select('*')
        .eq('company_id', companyId)
        .order('created_at', { ascending: false });

      if (error) {
        logger.error('Error fetching files:', error);
        return [];
      }

      return (data || []).map(row => this.mapKnowledgeBaseFileRowToKnowledgeBaseFile(row));
    } catch (error) {
      logger.error('Error in getFiles:', error);
      return [];
    }
  }

  async getFileById(id: string, companyId: string): Promise<KnowledgeBaseFile | null> {
    try {
      const { data, error } = await this.supabase
        .from('knowledge_base_files')
        .select('*')
        .eq('id', id)
        .eq('company_id', companyId)
        .single();

      if (error) {
        logger.error('Error fetching file by id:', error);
        return null;
      }

      return this.mapKnowledgeBaseFileRowToKnowledgeBaseFile(data);
    } catch (error) {
      logger.error('Error in getFileById:', error);
      return null;
    }
  }

  async deleteFile(id: string, companyId: string): Promise<boolean> {
    try {
      const { error } = await this.supabase
        .from('knowledge_base_files')
        .delete()
        .eq('id', id)
        .eq('company_id', companyId);

      if (error) {
        logger.error('Error deleting file:', error);
        return false;
      }

      return true;
    } catch (error) {
      logger.error('Error in deleteFile:', error);
      return false;
    }
  }

  async addFileToAgent(agentId: string, fileId: string, companyId: string, addedBy: string): Promise<boolean> {
    try {
      // First verify the agent and file belong to the company
      const [agentExists, fileExists] = await Promise.all([
        this.supabase.from('voice_agents').select('id').eq('id', agentId).eq('company_id', companyId).single(),
        this.supabase.from('knowledge_base_files').select('id').eq('id', fileId).eq('company_id', companyId).single()
      ]);

      if (agentExists.error || fileExists.error) {
        logger.error('Agent or file not found in company');
        return false;
      }

      const { error } = await this.supabase
        .from('agent_knowledge_files')
        .insert({
          agent_id: agentId,
          file_id: fileId,
          added_by: addedBy
        });

      if (error) {
        logger.error('Error adding file to agent:', error);
        return false;
      }

      return true;
    } catch (error) {
      logger.error('Error in addFileToAgent:', error);
      return false;
    }
  }

  async removeFileFromAgent(agentId: string, fileId: string, companyId: string): Promise<boolean> {
    try {
      // Verify ownership through the agent
      const { data: agent } = await this.supabase
        .from('voice_agents')
        .select('id')
        .eq('id', agentId)
        .eq('company_id', companyId)
        .single();

      if (!agent) {
        logger.error('Agent not found in company');
        return false;
      }

      const { error } = await this.supabase
        .from('agent_knowledge_files')
        .delete()
        .eq('agent_id', agentId)
        .eq('file_id', fileId);

      if (error) {
        logger.error('Error removing file from agent:', error);
        return false;
      }

      return true;
    } catch (error) {
      logger.error('Error in removeFileFromAgent:', error);
      return false;
    }
  }

  async getAgentFiles(agentId: string, companyId: string): Promise<KnowledgeBaseFile[]> {
    try {
      // Verify agent belongs to company
      const { data: agent } = await this.supabase
        .from('voice_agents')
        .select('id')
        .eq('id', agentId)
        .eq('company_id', companyId)
        .single();

      if (!agent) {
        logger.error('Agent not found in company');
        return [];
      }

      const { data, error } = await this.supabase
        .from('agent_knowledge_files')
        .select(`
          knowledge_base_files (*)
        `)
        .eq('agent_id', agentId);

      if (error) {
        logger.error('Error fetching agent files:', error);
        return [];
      }

      return (data || [])
        .map(row => row.knowledge_base_files)
        .filter(file => file !== null)
        .map(file => this.mapKnowledgeBaseFileRowToKnowledgeBaseFile(file as KnowledgeBaseFileRow));
    } catch (error) {
      logger.error('Error in getAgentFiles:', error);
      return [];
    }
  }

  // ================================================================
  // CALL SESSION MANAGEMENT
  // ================================================================

  async createCallSession(sessionData: {
    call_sid: string;
    phone_number_id?: string;
    agent_id?: string;
    from_number: string;
    to_number: string;
    direction?: 'inbound' | 'outbound';
  }, companyId: string): Promise<CallSession | null> {
    try {
      const insertData: CallSessionInsert = {
        company_id: companyId,
        call_sid: sessionData.call_sid,
        phone_number_id: sessionData.phone_number_id,
        agent_id: sessionData.agent_id,
        from_number: sessionData.from_number,
        to_number: sessionData.to_number,
        direction: sessionData.direction || 'inbound',
        status: 'active',
        analytics: {},
        cost_data: {}
      };

      const { data, error } = await this.supabase
        .from('call_sessions')
        .insert(insertData)
        .select()
        .single();

      if (error) {
        logger.error('Error creating call session:', error);
        return null;
      }

      return this.mapCallSessionRowToCallSession(data);
    } catch (error) {
      logger.error('Error in createCallSession:', error);
      return null;
    }
  }

  async updateCallSession(callSid: string, updates: {
    end_time?: string;
    duration_seconds?: number;
    status?: 'active' | 'completed' | 'failed' | 'busy' | 'no-answer';
    recording_url?: string;
    summary?: string;
    sentiment_score?: number;
    analytics?: any;
    cost_data?: any;
  }): Promise<CallSession | null> {
    try {
      const { data, error } = await this.supabase
        .from('call_sessions')
        .update(updates)
        .eq('call_sid', callSid)
        .select()
        .single();

      if (error) {
        logger.error('Error updating call session:', error);
        return null;
      }

      return this.mapCallSessionRowToCallSession(data);
    } catch (error) {
      logger.error('Error in updateCallSession:', error);
      return null;
    }
  }

  async getCallSession(callSid: string): Promise<CallSession | null> {
    try {
      const { data, error } = await this.supabase
        .from('call_sessions')
        .select('*')
        .eq('call_sid', callSid)
        .single();

      if (error) {
        logger.error('Error fetching call session:', error);
        return null;
      }

      return this.mapCallSessionRowToCallSession(data);
    } catch (error) {
      logger.error('Error in getCallSession:', error);
      return null;
    }
  }

  async getCallSessions(companyId: string, limit: number = 100): Promise<CallSession[]> {
    try {
      const { data, error } = await this.supabase
        .from('call_sessions')
        .select('*')
        .eq('company_id', companyId)
        .order('start_time', { ascending: false })
        .limit(limit);

      if (error) {
        logger.error('Error fetching call sessions:', error);
        return [];
      }

      return (data || []).map(row => this.mapCallSessionRowToCallSession(row));
    } catch (error) {
      logger.error('Error in getCallSessions:', error);
      return [];
    }
  }

  // ================================================================
  // CALL TRANSCRIPT MANAGEMENT
  // ================================================================

  async addCallTranscript(transcriptData: {
    session_id: string;
    speaker: 'user' | 'agent';
    text: string;
    confidence?: number;
    timestamp_ms: number;
    audio_url?: string;
    turn_number?: number;
  }): Promise<CallTranscript | null> {
    try {
      const insertData: CallTranscriptInsert = {
        session_id: transcriptData.session_id,
        speaker: transcriptData.speaker,
        text: transcriptData.text,
        confidence: transcriptData.confidence,
        timestamp_ms: transcriptData.timestamp_ms,
        audio_url: transcriptData.audio_url,
        turn_number: transcriptData.turn_number || 1
      };

      const { data, error } = await this.supabase
        .from('call_transcripts')
        .insert(insertData)
        .select()
        .single();

      if (error) {
        logger.error('Error adding call transcript:', error);
        return null;
      }

      return this.mapCallTranscriptRowToCallTranscript(data);
    } catch (error) {
      logger.error('Error in addCallTranscript:', error);
      return null;
    }
  }

  async getCallTranscripts(sessionId: string): Promise<CallTranscript[]> {
    try {
      const { data, error } = await this.supabase
        .from('call_transcripts')
        .select('*')
        .eq('session_id', sessionId)
        .order('timestamp_ms', { ascending: true });

      if (error) {
        logger.error('Error fetching call transcripts:', error);
        return [];
      }

      return (data || []).map(row => this.mapCallTranscriptRowToCallTranscript(row));
    } catch (error) {
      logger.error('Error in getCallTranscripts:', error);
      return [];
    }
  }

  // ================================================================
  // STORAGE MANAGEMENT
  // ================================================================

  async uploadFileToStorage(bucket: string, path: string, file: Buffer, options?: { contentType?: string }): Promise<string | null> {
    try {
      const { data, error } = await this.supabase.storage
        .from(bucket)
        .upload(path, file, {
          contentType: options?.contentType,
          upsert: false
        });

      if (error) {
        logger.error('Error uploading file to storage:', error);
        return null;
      }

      return data.path;
    } catch (error) {
      logger.error('Error in uploadFileToStorage:', error);
      return null;
    }
  }

  async deleteFileFromStorage(bucket: string, path: string): Promise<boolean> {
    try {
      const { error } = await this.supabase.storage
        .from(bucket)
        .remove([path]);

      if (error) {
        logger.error('Error deleting file from storage:', error);
        return false;
      }

      return true;
    } catch (error) {
      logger.error('Error in deleteFileFromStorage:', error);
      return false;
    }
  }

  async getFileUrl(bucket: string, path: string): Promise<string | null> {
    try {
      const { data } = this.supabase.storage
        .from(bucket)
        .getPublicUrl(path);

      return data.publicUrl;
    } catch (error) {
      logger.error('Error getting file URL:', error);
      return null;
    }
  }

  // ================================================================
  // HELPER METHODS - TYPE MAPPING
  // ================================================================

  private mapCompanyRowToCompany(row: CompanyRow): Company {
    return {
      id: row.id,
      name: row.name,
      slug: row.slug,
      logoUrl: row.logo_url || undefined,
      settings: row.settings,
      subscriptionStatus: row.subscription_status,
      subscriptionPlanId: row.subscription_plan_id || undefined,
      subscriptionCustomerId: row.subscription_customer_id || undefined,
      maxAgents: row.max_agents,
      maxUsers: row.max_users,
      maxStorageMb: row.max_storage_mb,
      trialEndsAt: row.trial_ends_at,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }

  private mapProfileRowToProfile(row: ProfileRow): Profile {
    return {
      id: row.id,
      companyId: row.company_id || undefined,
      email: row.email,
      fullName: row.full_name || undefined,
      avatarUrl: row.avatar_url || undefined,
      role: row.role,
      permissions: row.permissions,
      lastActiveAt: row.last_active_at,
      invitedBy: row.invited_by || undefined,
      inviteAcceptedAt: row.invite_accepted_at || undefined,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }

  private mapVoiceAgentRowToVoiceAgent(row: VoiceAgentRow): VoiceAgent {
    return {
      id: row.id,
      name: row.name,
      description: row.description || undefined,
      model: row.model,
      voice: row.voice,
      language: row.language,
      systemPrompt: row.system_prompt || undefined,
      greeting: row.greeting || undefined,
      temperature: row.temperature,
      maxTokens: row.max_tokens,
      responseTimeoutMs: row.response_timeout_ms,
      interruptionThresholdMs: row.interruption_threshold_ms,
      active: row.active,
      webhookUrl: row.webhook_url || undefined,
      metadata: row.metadata,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }

  private mapKnowledgeBaseFileRowToKnowledgeBaseFile(row: KnowledgeBaseFileRow): KnowledgeBaseFile {
    return {
      id: row.id,
      filename: row.filename,
      originalFilename: row.original_filename,
      fileSize: row.file_size,
      mimeType: row.mime_type || undefined,
      filePath: row.file_path,
      contentHash: row.content_hash || undefined,
      contentPreview: row.content_preview || undefined,
      processingStatus: row.processing_status,
      processingMetadata: row.processing_metadata,
      tags: row.tags,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }

  private mapCallSessionRowToCallSession(row: CallSessionRow): CallSession {
    return {
      id: row.id,
      companyId: row.company_id,
      callSid: row.call_sid,
      phoneNumberId: row.phone_number_id || undefined,
      agentId: row.agent_id || undefined,
      fromNumber: row.from_number,
      toNumber: row.to_number,
      direction: row.direction,
      startTime: row.start_time,
      endTime: row.end_time || undefined,
      durationSeconds: row.duration_seconds || undefined,
      status: row.status,
      recordingUrl: row.recording_url || undefined,
      summary: row.summary || undefined,
      sentimentScore: row.sentiment_score || undefined,
      analytics: row.analytics,
      costData: row.cost_data,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }

  private mapCallTranscriptRowToCallTranscript(row: CallTranscriptRow): CallTranscript {
    return {
      id: row.id,
      sessionId: row.session_id,
      speaker: row.speaker,
      text: row.text,
      confidence: row.confidence || undefined,
      timestampMs: row.timestamp_ms,
      audioUrl: row.audio_url || undefined,
      turnNumber: row.turn_number,
      createdAt: row.created_at
    };
  }
}

// Lazy-loaded singleton instance 
let supabaseInstance: SupabaseService | null = null;

export const supabase = {
  get instance(): SupabaseService {
    if (!supabaseInstance) {
      supabaseInstance = new SupabaseService();
    }
    return supabaseInstance;
  },
  
  // Proxy all methods to the lazy-loaded instance
  checkConnection: () => supabase.instance.checkConnection(),
  getCompanyBySlug: (slug: string) => supabase.instance.getCompanyBySlug(slug),
  getCompanyById: (id: string) => supabase.instance.getCompanyById(id),
  getProfileById: (id: string) => supabase.instance.getProfileById(id),
  getProfilesInCompany: (companyId: string) => supabase.instance.getProfilesInCompany(companyId),
  createVoiceAgent: (agentData: any, companyId: string, createdBy: string) => supabase.instance.createVoiceAgent(agentData, companyId, createdBy),
  getVoiceAgents: (companyId: string) => supabase.instance.getVoiceAgents(companyId),
  getVoiceAgentById: (id: string, companyId: string) => supabase.instance.getVoiceAgentById(id, companyId),
  updateVoiceAgent: (id: string, companyId: string, updates: any) => supabase.instance.updateVoiceAgent(id, companyId, updates),
  deleteVoiceAgent: (id: string, companyId: string) => supabase.instance.deleteVoiceAgent(id, companyId),
  uploadFile: (fileData: any, companyId: string, uploadedBy: string) => supabase.instance.uploadFile(fileData, companyId, uploadedBy),
  getFiles: (companyId: string) => supabase.instance.getFiles(companyId),
  getFileById: (id: string, companyId: string) => supabase.instance.getFileById(id, companyId),
  deleteFile: (id: string, companyId: string) => supabase.instance.deleteFile(id, companyId),
  addFileToAgent: (agentId: string, fileId: string, companyId: string, addedBy: string) => supabase.instance.addFileToAgent(agentId, fileId, companyId, addedBy),
  removeFileFromAgent: (agentId: string, fileId: string, companyId: string) => supabase.instance.removeFileFromAgent(agentId, fileId, companyId),
  getAgentFiles: (agentId: string, companyId: string) => supabase.instance.getAgentFiles(agentId, companyId),
  createCallSession: (sessionData: any, companyId: string) => supabase.instance.createCallSession(sessionData, companyId),
  updateCallSession: (callSid: string, updates: any) => supabase.instance.updateCallSession(callSid, updates),
  getCallSession: (callSid: string) => supabase.instance.getCallSession(callSid),
  getCallSessions: (companyId: string, limit?: number) => supabase.instance.getCallSessions(companyId, limit),
  addCallTranscript: (transcriptData: any) => supabase.instance.addCallTranscript(transcriptData),
  getCallTranscripts: (sessionId: string) => supabase.instance.getCallTranscripts(sessionId),
  uploadFileToStorage: (bucket: string, path: string, file: Buffer, options?: any) => supabase.instance.uploadFileToStorage(bucket, path, file, options),
  deleteFileFromStorage: (bucket: string, path: string) => supabase.instance.deleteFileFromStorage(bucket, path),
  getFileUrl: (bucket: string, path: string) => supabase.instance.getFileUrl(bucket, path)
}; 