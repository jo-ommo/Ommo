import { VoiceAgent, VoiceAgentCreateRequest, VoiceAgentUpdateRequest, KnowledgeBaseFile, CallSession, CallTranscript, Company, Profile } from '../types';
export declare class SupabaseService {
    private supabase;
    constructor();
    checkConnection(): Promise<boolean>;
    getCompanyBySlug(slug: string): Promise<Company | null>;
    getCompanyById(id: string): Promise<Company | null>;
    getProfileById(id: string): Promise<Profile | null>;
    getProfilesInCompany(companyId: string): Promise<Profile[]>;
    createVoiceAgent(agentData: VoiceAgentCreateRequest, companyId: string, createdBy: string): Promise<VoiceAgent | null>;
    getVoiceAgents(companyId: string): Promise<VoiceAgent[]>;
    getVoiceAgentById(id: string, companyId: string): Promise<VoiceAgent | null>;
    updateVoiceAgent(id: string, companyId: string, updates: VoiceAgentUpdateRequest): Promise<VoiceAgent | null>;
    deleteVoiceAgent(id: string, companyId: string): Promise<boolean>;
    uploadFile(fileData: {
        filename: string;
        originalFilename: string;
        fileSize: number;
        mimeType?: string;
        filePath: string;
        contentHash?: string;
        contentPreview?: string;
        tags?: string[];
    }, companyId: string, uploadedBy: string): Promise<KnowledgeBaseFile | null>;
    getFiles(companyId: string): Promise<KnowledgeBaseFile[]>;
    getFileById(id: string, companyId: string): Promise<KnowledgeBaseFile | null>;
    deleteFile(id: string, companyId: string): Promise<boolean>;
    addFileToAgent(agentId: string, fileId: string, companyId: string, addedBy: string): Promise<boolean>;
    removeFileFromAgent(agentId: string, fileId: string, companyId: string): Promise<boolean>;
    getAgentFiles(agentId: string, companyId: string): Promise<KnowledgeBaseFile[]>;
    createCallSession(sessionData: {
        call_sid: string;
        phone_number_id?: string;
        agent_id?: string;
        from_number: string;
        to_number: string;
        direction?: 'inbound' | 'outbound';
    }, companyId: string): Promise<CallSession | null>;
    updateCallSession(callSid: string, updates: {
        end_time?: string;
        duration_seconds?: number;
        status?: 'active' | 'completed' | 'failed' | 'busy' | 'no-answer';
        recording_url?: string;
        summary?: string;
        sentiment_score?: number;
        analytics?: any;
        cost_data?: any;
    }): Promise<CallSession | null>;
    getCallSession(callSid: string): Promise<CallSession | null>;
    getCallSessions(companyId: string, limit?: number): Promise<CallSession[]>;
    addCallTranscript(transcriptData: {
        session_id: string;
        speaker: 'user' | 'agent';
        text: string;
        confidence?: number;
        timestamp_ms: number;
        audio_url?: string;
        turn_number?: number;
    }): Promise<CallTranscript | null>;
    getCallTranscripts(sessionId: string): Promise<CallTranscript[]>;
    uploadFileToStorage(bucket: string, path: string, file: Buffer, options?: {
        contentType?: string;
    }): Promise<string | null>;
    deleteFileFromStorage(bucket: string, path: string): Promise<boolean>;
    getFileUrl(bucket: string, path: string): Promise<string | null>;
    private mapCompanyRowToCompany;
    private mapProfileRowToProfile;
    private mapVoiceAgentRowToVoiceAgent;
    private mapKnowledgeBaseFileRowToKnowledgeBaseFile;
    private mapCallSessionRowToCallSession;
    private mapCallTranscriptRowToCallTranscript;
}
export declare const supabase: SupabaseService;
//# sourceMappingURL=supabase.d.ts.map