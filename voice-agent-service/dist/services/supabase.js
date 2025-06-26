"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.supabase = exports.SupabaseService = void 0;
const supabase_js_1 = require("@supabase/supabase-js");
const logger_1 = require("../utils/logger");
class SupabaseService {
    constructor() {
        const supabaseUrl = process.env.SUPABASE_URL;
        const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;
        if (!supabaseUrl || !supabaseAnonKey) {
            throw new Error('SUPABASE_URL and SUPABASE_ANON_KEY environment variables are required');
        }
        this.supabase = (0, supabase_js_1.createClient)(supabaseUrl, supabaseAnonKey);
    }
    // ================================================================
    // HEALTH CHECK
    // ================================================================
    async checkConnection() {
        try {
            const { data, error } = await this.supabase
                .from('companies')
                .select('id')
                .limit(1);
            return !error;
        }
        catch (error) {
            logger_1.logger.error('Supabase connection check failed:', error);
            return false;
        }
    }
    // ================================================================
    // COMPANY MANAGEMENT
    // ================================================================
    async getCompanyBySlug(slug) {
        try {
            const { data, error } = await this.supabase
                .from('companies')
                .select('*')
                .eq('slug', slug)
                .single();
            if (error) {
                logger_1.logger.error('Error fetching company by slug:', error);
                return null;
            }
            return this.mapCompanyRowToCompany(data);
        }
        catch (error) {
            logger_1.logger.error('Error in getCompanyBySlug:', error);
            return null;
        }
    }
    async getCompanyById(id) {
        try {
            const { data, error } = await this.supabase
                .from('companies')
                .select('*')
                .eq('id', id)
                .single();
            if (error) {
                logger_1.logger.error('Error fetching company by id:', error);
                return null;
            }
            return this.mapCompanyRowToCompany(data);
        }
        catch (error) {
            logger_1.logger.error('Error in getCompanyById:', error);
            return null;
        }
    }
    // ================================================================
    // PROFILE MANAGEMENT
    // ================================================================
    async getProfileById(id) {
        try {
            const { data, error } = await this.supabase
                .from('profiles')
                .select('*')
                .eq('id', id)
                .single();
            if (error) {
                logger_1.logger.error('Error fetching profile by id:', error);
                return null;
            }
            return this.mapProfileRowToProfile(data);
        }
        catch (error) {
            logger_1.logger.error('Error in getProfileById:', error);
            return null;
        }
    }
    async getProfilesInCompany(companyId) {
        try {
            const { data, error } = await this.supabase
                .from('profiles')
                .select('*')
                .eq('company_id', companyId)
                .order('created_at', { ascending: false });
            if (error) {
                logger_1.logger.error('Error fetching profiles in company:', error);
                return [];
            }
            return (data || []).map(row => this.mapProfileRowToProfile(row));
        }
        catch (error) {
            logger_1.logger.error('Error in getProfilesInCompany:', error);
            return [];
        }
    }
    // ================================================================
    // VOICE AGENT MANAGEMENT
    // ================================================================
    async createVoiceAgent(agentData, companyId, createdBy) {
        try {
            const insertData = {
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
                logger_1.logger.error('Error creating voice agent:', error);
                return null;
            }
            return this.mapVoiceAgentRowToVoiceAgent(data);
        }
        catch (error) {
            logger_1.logger.error('Error in createVoiceAgent:', error);
            return null;
        }
    }
    async getVoiceAgents(companyId) {
        try {
            const { data, error } = await this.supabase
                .from('voice_agents')
                .select('*')
                .eq('company_id', companyId)
                .order('created_at', { ascending: false });
            if (error) {
                logger_1.logger.error('Error fetching voice agents:', error);
                return [];
            }
            return (data || []).map(row => this.mapVoiceAgentRowToVoiceAgent(row));
        }
        catch (error) {
            logger_1.logger.error('Error in getVoiceAgents:', error);
            return [];
        }
    }
    async getVoiceAgentById(id, companyId) {
        try {
            const { data, error } = await this.supabase
                .from('voice_agents')
                .select('*')
                .eq('id', id)
                .eq('company_id', companyId)
                .single();
            if (error) {
                logger_1.logger.error('Error fetching voice agent by id:', error);
                return null;
            }
            return this.mapVoiceAgentRowToVoiceAgent(data);
        }
        catch (error) {
            logger_1.logger.error('Error in getVoiceAgentById:', error);
            return null;
        }
    }
    async updateVoiceAgent(id, companyId, updates) {
        try {
            const updateData = {};
            if (updates.name !== undefined)
                updateData.name = updates.name;
            if (updates.description !== undefined)
                updateData.description = updates.description;
            if (updates.model !== undefined)
                updateData.model = updates.model;
            if (updates.voice !== undefined)
                updateData.voice = updates.voice;
            if (updates.language !== undefined)
                updateData.language = updates.language;
            if (updates.systemPrompt !== undefined)
                updateData.system_prompt = updates.systemPrompt;
            if (updates.greeting !== undefined)
                updateData.greeting = updates.greeting;
            if (updates.temperature !== undefined)
                updateData.temperature = updates.temperature;
            if (updates.maxTokens !== undefined)
                updateData.max_tokens = updates.maxTokens;
            if (updates.responseTimeoutMs !== undefined)
                updateData.response_timeout_ms = updates.responseTimeoutMs;
            if (updates.interruptionThresholdMs !== undefined)
                updateData.interruption_threshold_ms = updates.interruptionThresholdMs;
            if (updates.active !== undefined)
                updateData.active = updates.active;
            if (updates.webhookUrl !== undefined)
                updateData.webhook_url = updates.webhookUrl;
            if (updates.metadata !== undefined)
                updateData.metadata = updates.metadata;
            const { data, error } = await this.supabase
                .from('voice_agents')
                .update(updateData)
                .eq('id', id)
                .eq('company_id', companyId)
                .select()
                .single();
            if (error) {
                logger_1.logger.error('Error updating voice agent:', error);
                return null;
            }
            return this.mapVoiceAgentRowToVoiceAgent(data);
        }
        catch (error) {
            logger_1.logger.error('Error in updateVoiceAgent:', error);
            return null;
        }
    }
    async deleteVoiceAgent(id, companyId) {
        try {
            const { error } = await this.supabase
                .from('voice_agents')
                .delete()
                .eq('id', id)
                .eq('company_id', companyId);
            if (error) {
                logger_1.logger.error('Error deleting voice agent:', error);
                return false;
            }
            return true;
        }
        catch (error) {
            logger_1.logger.error('Error in deleteVoiceAgent:', error);
            return false;
        }
    }
    // ================================================================
    // KNOWLEDGE BASE FILE MANAGEMENT
    // ================================================================
    async uploadFile(fileData, companyId, uploadedBy) {
        try {
            const insertData = {
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
                logger_1.logger.error('Error uploading file:', error);
                return null;
            }
            return this.mapKnowledgeBaseFileRowToKnowledgeBaseFile(data);
        }
        catch (error) {
            logger_1.logger.error('Error in uploadFile:', error);
            return null;
        }
    }
    async getFiles(companyId) {
        try {
            const { data, error } = await this.supabase
                .from('knowledge_base_files')
                .select('*')
                .eq('company_id', companyId)
                .order('created_at', { ascending: false });
            if (error) {
                logger_1.logger.error('Error fetching files:', error);
                return [];
            }
            return (data || []).map(row => this.mapKnowledgeBaseFileRowToKnowledgeBaseFile(row));
        }
        catch (error) {
            logger_1.logger.error('Error in getFiles:', error);
            return [];
        }
    }
    async getFileById(id, companyId) {
        try {
            const { data, error } = await this.supabase
                .from('knowledge_base_files')
                .select('*')
                .eq('id', id)
                .eq('company_id', companyId)
                .single();
            if (error) {
                logger_1.logger.error('Error fetching file by id:', error);
                return null;
            }
            return this.mapKnowledgeBaseFileRowToKnowledgeBaseFile(data);
        }
        catch (error) {
            logger_1.logger.error('Error in getFileById:', error);
            return null;
        }
    }
    async deleteFile(id, companyId) {
        try {
            const { error } = await this.supabase
                .from('knowledge_base_files')
                .delete()
                .eq('id', id)
                .eq('company_id', companyId);
            if (error) {
                logger_1.logger.error('Error deleting file:', error);
                return false;
            }
            return true;
        }
        catch (error) {
            logger_1.logger.error('Error in deleteFile:', error);
            return false;
        }
    }
    async addFileToAgent(agentId, fileId, companyId, addedBy) {
        try {
            // First verify the agent and file belong to the company
            const [agentExists, fileExists] = await Promise.all([
                this.supabase.from('voice_agents').select('id').eq('id', agentId).eq('company_id', companyId).single(),
                this.supabase.from('knowledge_base_files').select('id').eq('id', fileId).eq('company_id', companyId).single()
            ]);
            if (agentExists.error || fileExists.error) {
                logger_1.logger.error('Agent or file not found in company');
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
                logger_1.logger.error('Error adding file to agent:', error);
                return false;
            }
            return true;
        }
        catch (error) {
            logger_1.logger.error('Error in addFileToAgent:', error);
            return false;
        }
    }
    async removeFileFromAgent(agentId, fileId, companyId) {
        try {
            // Verify ownership through the agent
            const { data: agent } = await this.supabase
                .from('voice_agents')
                .select('id')
                .eq('id', agentId)
                .eq('company_id', companyId)
                .single();
            if (!agent) {
                logger_1.logger.error('Agent not found in company');
                return false;
            }
            const { error } = await this.supabase
                .from('agent_knowledge_files')
                .delete()
                .eq('agent_id', agentId)
                .eq('file_id', fileId);
            if (error) {
                logger_1.logger.error('Error removing file from agent:', error);
                return false;
            }
            return true;
        }
        catch (error) {
            logger_1.logger.error('Error in removeFileFromAgent:', error);
            return false;
        }
    }
    async getAgentFiles(agentId, companyId) {
        try {
            // Verify agent belongs to company
            const { data: agent } = await this.supabase
                .from('voice_agents')
                .select('id')
                .eq('id', agentId)
                .eq('company_id', companyId)
                .single();
            if (!agent) {
                logger_1.logger.error('Agent not found in company');
                return [];
            }
            const { data, error } = await this.supabase
                .from('agent_knowledge_files')
                .select(`
          knowledge_base_files (*)
        `)
                .eq('agent_id', agentId);
            if (error) {
                logger_1.logger.error('Error fetching agent files:', error);
                return [];
            }
            return (data || [])
                .map(row => row.knowledge_base_files)
                .filter(file => file !== null)
                .map(file => this.mapKnowledgeBaseFileRowToKnowledgeBaseFile(file));
        }
        catch (error) {
            logger_1.logger.error('Error in getAgentFiles:', error);
            return [];
        }
    }
    // ================================================================
    // CALL SESSION MANAGEMENT
    // ================================================================
    async createCallSession(sessionData, companyId) {
        try {
            const insertData = {
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
                logger_1.logger.error('Error creating call session:', error);
                return null;
            }
            return this.mapCallSessionRowToCallSession(data);
        }
        catch (error) {
            logger_1.logger.error('Error in createCallSession:', error);
            return null;
        }
    }
    async updateCallSession(callSid, updates) {
        try {
            const { data, error } = await this.supabase
                .from('call_sessions')
                .update(updates)
                .eq('call_sid', callSid)
                .select()
                .single();
            if (error) {
                logger_1.logger.error('Error updating call session:', error);
                return null;
            }
            return this.mapCallSessionRowToCallSession(data);
        }
        catch (error) {
            logger_1.logger.error('Error in updateCallSession:', error);
            return null;
        }
    }
    async getCallSession(callSid) {
        try {
            const { data, error } = await this.supabase
                .from('call_sessions')
                .select('*')
                .eq('call_sid', callSid)
                .single();
            if (error) {
                logger_1.logger.error('Error fetching call session:', error);
                return null;
            }
            return this.mapCallSessionRowToCallSession(data);
        }
        catch (error) {
            logger_1.logger.error('Error in getCallSession:', error);
            return null;
        }
    }
    async getCallSessions(companyId, limit = 100) {
        try {
            const { data, error } = await this.supabase
                .from('call_sessions')
                .select('*')
                .eq('company_id', companyId)
                .order('start_time', { ascending: false })
                .limit(limit);
            if (error) {
                logger_1.logger.error('Error fetching call sessions:', error);
                return [];
            }
            return (data || []).map(row => this.mapCallSessionRowToCallSession(row));
        }
        catch (error) {
            logger_1.logger.error('Error in getCallSessions:', error);
            return [];
        }
    }
    // ================================================================
    // CALL TRANSCRIPT MANAGEMENT
    // ================================================================
    async addCallTranscript(transcriptData) {
        try {
            const insertData = {
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
                logger_1.logger.error('Error adding call transcript:', error);
                return null;
            }
            return this.mapCallTranscriptRowToCallTranscript(data);
        }
        catch (error) {
            logger_1.logger.error('Error in addCallTranscript:', error);
            return null;
        }
    }
    async getCallTranscripts(sessionId) {
        try {
            const { data, error } = await this.supabase
                .from('call_transcripts')
                .select('*')
                .eq('session_id', sessionId)
                .order('timestamp_ms', { ascending: true });
            if (error) {
                logger_1.logger.error('Error fetching call transcripts:', error);
                return [];
            }
            return (data || []).map(row => this.mapCallTranscriptRowToCallTranscript(row));
        }
        catch (error) {
            logger_1.logger.error('Error in getCallTranscripts:', error);
            return [];
        }
    }
    // ================================================================
    // STORAGE MANAGEMENT
    // ================================================================
    async uploadFileToStorage(bucket, path, file, options) {
        try {
            const { data, error } = await this.supabase.storage
                .from(bucket)
                .upload(path, file, {
                contentType: options?.contentType,
                upsert: false
            });
            if (error) {
                logger_1.logger.error('Error uploading file to storage:', error);
                return null;
            }
            return data.path;
        }
        catch (error) {
            logger_1.logger.error('Error in uploadFileToStorage:', error);
            return null;
        }
    }
    async deleteFileFromStorage(bucket, path) {
        try {
            const { error } = await this.supabase.storage
                .from(bucket)
                .remove([path]);
            if (error) {
                logger_1.logger.error('Error deleting file from storage:', error);
                return false;
            }
            return true;
        }
        catch (error) {
            logger_1.logger.error('Error in deleteFileFromStorage:', error);
            return false;
        }
    }
    async getFileUrl(bucket, path) {
        try {
            const { data } = this.supabase.storage
                .from(bucket)
                .getPublicUrl(path);
            return data.publicUrl;
        }
        catch (error) {
            logger_1.logger.error('Error getting file URL:', error);
            return null;
        }
    }
    // ================================================================
    // HELPER METHODS - TYPE MAPPING
    // ================================================================
    mapCompanyRowToCompany(row) {
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
    mapProfileRowToProfile(row) {
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
    mapVoiceAgentRowToVoiceAgent(row) {
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
    mapKnowledgeBaseFileRowToKnowledgeBaseFile(row) {
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
    mapCallSessionRowToCallSession(row) {
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
    mapCallTranscriptRowToCallTranscript(row) {
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
exports.SupabaseService = SupabaseService;
// Export a singleton instance for use in controllers
exports.supabase = new SupabaseService();
//# sourceMappingURL=supabase.js.map