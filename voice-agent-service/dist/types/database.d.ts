export type Json = string | number | boolean | null | {
    [key: string]: Json | undefined;
} | Json[];
export type Database = {
    public: {
        Tables: {
            activity_logs: {
                Row: {
                    id: string;
                    company_id: string;
                    user_id: string | null;
                    action: string;
                    resource_type: string;
                    resource_id: string | null;
                    details: Json;
                    ip_address: string | null;
                    user_agent: string | null;
                    created_at: string;
                };
                Insert: {
                    id?: string;
                    company_id: string;
                    user_id?: string | null;
                    action: string;
                    resource_type: string;
                    resource_id?: string | null;
                    details?: Json;
                    ip_address?: string | null;
                    user_agent?: string | null;
                    created_at?: string;
                };
                Update: {
                    id?: string;
                    company_id?: string;
                    user_id?: string | null;
                    action?: string;
                    resource_type?: string;
                    resource_id?: string | null;
                    details?: Json;
                    ip_address?: string | null;
                    user_agent?: string | null;
                    created_at?: string;
                };
                Relationships: [
                    {
                        foreignKeyName: "activity_logs_company_id_fkey";
                        columns: ["company_id"];
                        isOneToOne: false;
                        referencedRelation: "companies";
                        referencedColumns: ["id"];
                    },
                    {
                        foreignKeyName: "activity_logs_user_id_fkey";
                        columns: ["user_id"];
                        isOneToOne: false;
                        referencedRelation: "profiles";
                        referencedColumns: ["id"];
                    }
                ];
            };
            agent_knowledge_files: {
                Row: {
                    id: string;
                    agent_id: string;
                    file_id: string;
                    added_by: string;
                    created_at: string;
                };
                Insert: {
                    id?: string;
                    agent_id: string;
                    file_id: string;
                    added_by: string;
                    created_at?: string;
                };
                Update: {
                    id?: string;
                    agent_id?: string;
                    file_id?: string;
                    added_by?: string;
                    created_at?: string;
                };
                Relationships: [
                    {
                        foreignKeyName: "agent_knowledge_files_agent_id_fkey";
                        columns: ["agent_id"];
                        isOneToOne: false;
                        referencedRelation: "voice_agents";
                        referencedColumns: ["id"];
                    },
                    {
                        foreignKeyName: "agent_knowledge_files_file_id_fkey";
                        columns: ["file_id"];
                        isOneToOne: false;
                        referencedRelation: "knowledge_base_files";
                        referencedColumns: ["id"];
                    },
                    {
                        foreignKeyName: "agent_knowledge_files_added_by_fkey";
                        columns: ["added_by"];
                        isOneToOne: false;
                        referencedRelation: "profiles";
                        referencedColumns: ["id"];
                    }
                ];
            };
            api_usage_logs: {
                Row: {
                    id: string;
                    company_id: string;
                    session_id: string | null;
                    session_type: 'call' | 'voice' | 'api' | null;
                    service: 'deepgram' | 'openai' | 'anthropic' | 'cartesia' | 'twilio' | 'livekit';
                    usage_type: string;
                    quantity: number;
                    unit_cost: number;
                    total_cost: number;
                    currency: string;
                    provider_request_id: string | null;
                    metadata: Json;
                    logged_at: string;
                };
                Insert: {
                    id?: string;
                    company_id: string;
                    session_id?: string | null;
                    session_type?: 'call' | 'voice' | 'api' | null;
                    service: 'deepgram' | 'openai' | 'anthropic' | 'cartesia' | 'twilio' | 'livekit';
                    usage_type: string;
                    quantity: number;
                    unit_cost?: number;
                    total_cost?: number;
                    currency?: string;
                    provider_request_id?: string | null;
                    metadata?: Json;
                    logged_at?: string;
                };
                Update: {
                    id?: string;
                    company_id?: string;
                    session_id?: string | null;
                    session_type?: 'call' | 'voice' | 'api' | null;
                    service?: 'deepgram' | 'openai' | 'anthropic' | 'cartesia' | 'twilio' | 'livekit';
                    usage_type?: string;
                    quantity?: number;
                    unit_cost?: number;
                    total_cost?: number;
                    currency?: string;
                    provider_request_id?: string | null;
                    metadata?: Json;
                    logged_at?: string;
                };
                Relationships: [
                    {
                        foreignKeyName: "api_usage_logs_company_id_fkey";
                        columns: ["company_id"];
                        isOneToOne: false;
                        referencedRelation: "companies";
                        referencedColumns: ["id"];
                    }
                ];
            };
            call_sessions: {
                Row: {
                    id: string;
                    company_id: string;
                    call_sid: string;
                    phone_number_id: string | null;
                    agent_id: string | null;
                    from_number: string;
                    to_number: string;
                    direction: 'inbound' | 'outbound';
                    start_time: string;
                    end_time: string | null;
                    duration_seconds: number | null;
                    status: 'active' | 'completed' | 'failed' | 'busy' | 'no-answer';
                    recording_url: string | null;
                    summary: string | null;
                    sentiment_score: number | null;
                    analytics: Json;
                    cost_data: Json;
                    created_at: string;
                    updated_at: string;
                };
                Insert: {
                    id?: string;
                    company_id: string;
                    call_sid: string;
                    phone_number_id?: string | null;
                    agent_id?: string | null;
                    from_number: string;
                    to_number: string;
                    direction?: 'inbound' | 'outbound';
                    start_time?: string;
                    end_time?: string | null;
                    duration_seconds?: number | null;
                    status?: 'active' | 'completed' | 'failed' | 'busy' | 'no-answer';
                    recording_url?: string | null;
                    summary?: string | null;
                    sentiment_score?: number | null;
                    analytics?: Json;
                    cost_data?: Json;
                    created_at?: string;
                    updated_at?: string;
                };
                Update: {
                    id?: string;
                    company_id?: string;
                    call_sid?: string;
                    phone_number_id?: string | null;
                    agent_id?: string | null;
                    from_number?: string;
                    to_number?: string;
                    direction?: 'inbound' | 'outbound';
                    start_time?: string;
                    end_time?: string | null;
                    duration_seconds?: number | null;
                    status?: 'active' | 'completed' | 'failed' | 'busy' | 'no-answer';
                    recording_url?: string | null;
                    summary?: string | null;
                    sentiment_score?: number | null;
                    analytics?: Json;
                    cost_data?: Json;
                    created_at?: string;
                    updated_at?: string;
                };
                Relationships: [
                    {
                        foreignKeyName: "call_sessions_company_id_fkey";
                        columns: ["company_id"];
                        isOneToOne: false;
                        referencedRelation: "companies";
                        referencedColumns: ["id"];
                    },
                    {
                        foreignKeyName: "call_sessions_phone_number_id_fkey";
                        columns: ["phone_number_id"];
                        isOneToOne: false;
                        referencedRelation: "phone_numbers";
                        referencedColumns: ["id"];
                    },
                    {
                        foreignKeyName: "call_sessions_agent_id_fkey";
                        columns: ["agent_id"];
                        isOneToOne: false;
                        referencedRelation: "voice_agents";
                        referencedColumns: ["id"];
                    }
                ];
            };
            call_transcripts: {
                Row: {
                    id: string;
                    session_id: string;
                    speaker: 'user' | 'agent';
                    text: string;
                    confidence: number | null;
                    timestamp_ms: number;
                    audio_url: string | null;
                    turn_number: number;
                    created_at: string;
                };
                Insert: {
                    id?: string;
                    session_id: string;
                    speaker: 'user' | 'agent';
                    text: string;
                    confidence?: number | null;
                    timestamp_ms: number;
                    audio_url?: string | null;
                    turn_number?: number;
                    created_at?: string;
                };
                Update: {
                    id?: string;
                    session_id?: string;
                    speaker?: 'user' | 'agent';
                    text?: string;
                    confidence?: number | null;
                    timestamp_ms?: number;
                    audio_url?: string | null;
                    turn_number?: number;
                    created_at?: string;
                };
                Relationships: [
                    {
                        foreignKeyName: "call_transcripts_session_id_fkey";
                        columns: ["session_id"];
                        isOneToOne: false;
                        referencedRelation: "call_sessions";
                        referencedColumns: ["id"];
                    }
                ];
            };
            companies: {
                Row: {
                    id: string;
                    name: string;
                    slug: string;
                    logo_url: string | null;
                    settings: Json;
                    subscription_status: 'trial' | 'active' | 'past_due' | 'canceled' | 'paused';
                    subscription_plan_id: string | null;
                    subscription_customer_id: string | null;
                    max_agents: number;
                    max_users: number;
                    max_storage_mb: number;
                    trial_ends_at: string;
                    created_at: string;
                    updated_at: string;
                };
                Insert: {
                    id?: string;
                    name: string;
                    slug: string;
                    logo_url?: string | null;
                    settings?: Json;
                    subscription_status?: 'trial' | 'active' | 'past_due' | 'canceled' | 'paused';
                    subscription_plan_id?: string | null;
                    subscription_customer_id?: string | null;
                    max_agents?: number;
                    max_users?: number;
                    max_storage_mb?: number;
                    trial_ends_at?: string;
                    created_at?: string;
                    updated_at?: string;
                };
                Update: {
                    id?: string;
                    name?: string;
                    slug?: string;
                    logo_url?: string | null;
                    settings?: Json;
                    subscription_status?: 'trial' | 'active' | 'past_due' | 'canceled' | 'paused';
                    subscription_plan_id?: string | null;
                    subscription_customer_id?: string | null;
                    max_agents?: number;
                    max_users?: number;
                    max_storage_mb?: number;
                    trial_ends_at?: string;
                    created_at?: string;
                    updated_at?: string;
                };
                Relationships: [];
            };
            company_invitations: {
                Row: {
                    id: string;
                    company_id: string;
                    email: string;
                    role: 'admin' | 'member';
                    token: string;
                    invited_by: string;
                    expires_at: string;
                    accepted_at: string | null;
                    created_at: string;
                };
                Insert: {
                    id?: string;
                    company_id: string;
                    email: string;
                    role?: 'admin' | 'member';
                    token: string;
                    invited_by: string;
                    expires_at?: string;
                    accepted_at?: string | null;
                    created_at?: string;
                };
                Update: {
                    id?: string;
                    company_id?: string;
                    email?: string;
                    role?: 'admin' | 'member';
                    token?: string;
                    invited_by?: string;
                    expires_at?: string;
                    accepted_at?: string | null;
                    created_at?: string;
                };
                Relationships: [
                    {
                        foreignKeyName: "company_invitations_company_id_fkey";
                        columns: ["company_id"];
                        isOneToOne: false;
                        referencedRelation: "companies";
                        referencedColumns: ["id"];
                    },
                    {
                        foreignKeyName: "company_invitations_invited_by_fkey";
                        columns: ["invited_by"];
                        isOneToOne: false;
                        referencedRelation: "profiles";
                        referencedColumns: ["id"];
                    }
                ];
            };
            company_usage_summaries: {
                Row: {
                    id: string;
                    company_id: string;
                    date: string;
                    service: string;
                    usage_type: string;
                    total_quantity: number;
                    total_cost: number;
                    currency: string;
                    created_at: string;
                    updated_at: string;
                };
                Insert: {
                    id?: string;
                    company_id: string;
                    date: string;
                    service: string;
                    usage_type: string;
                    total_quantity?: number;
                    total_cost?: number;
                    currency?: string;
                    created_at?: string;
                    updated_at?: string;
                };
                Update: {
                    id?: string;
                    company_id?: string;
                    date?: string;
                    service?: string;
                    usage_type?: string;
                    total_quantity?: number;
                    total_cost?: number;
                    currency?: string;
                    created_at?: string;
                    updated_at?: string;
                };
                Relationships: [
                    {
                        foreignKeyName: "company_usage_summaries_company_id_fkey";
                        columns: ["company_id"];
                        isOneToOne: false;
                        referencedRelation: "companies";
                        referencedColumns: ["id"];
                    }
                ];
            };
            knowledge_base_files: {
                Row: {
                    id: string;
                    company_id: string;
                    filename: string;
                    original_filename: string;
                    file_size: number;
                    mime_type: string | null;
                    file_path: string;
                    content_hash: string | null;
                    content_preview: string | null;
                    processing_status: 'uploaded' | 'processing' | 'processed' | 'error';
                    processing_metadata: Json;
                    tags: string[];
                    uploaded_by: string;
                    created_at: string;
                    updated_at: string;
                };
                Insert: {
                    id?: string;
                    company_id: string;
                    filename: string;
                    original_filename: string;
                    file_size: number;
                    mime_type?: string | null;
                    file_path: string;
                    content_hash?: string | null;
                    content_preview?: string | null;
                    processing_status?: 'uploaded' | 'processing' | 'processed' | 'error';
                    processing_metadata?: Json;
                    tags?: string[];
                    uploaded_by: string;
                    created_at?: string;
                    updated_at?: string;
                };
                Update: {
                    id?: string;
                    company_id?: string;
                    filename?: string;
                    original_filename?: string;
                    file_size?: number;
                    mime_type?: string | null;
                    file_path?: string;
                    content_hash?: string | null;
                    content_preview?: string | null;
                    processing_status?: 'uploaded' | 'processing' | 'processed' | 'error';
                    processing_metadata?: Json;
                    tags?: string[];
                    uploaded_by?: string;
                    created_at?: string;
                    updated_at?: string;
                };
                Relationships: [
                    {
                        foreignKeyName: "knowledge_base_files_company_id_fkey";
                        columns: ["company_id"];
                        isOneToOne: false;
                        referencedRelation: "companies";
                        referencedColumns: ["id"];
                    },
                    {
                        foreignKeyName: "knowledge_base_files_uploaded_by_fkey";
                        columns: ["uploaded_by"];
                        isOneToOne: false;
                        referencedRelation: "profiles";
                        referencedColumns: ["id"];
                    }
                ];
            };
            phone_numbers: {
                Row: {
                    id: string;
                    company_id: string;
                    phone_number: string;
                    country_code: string;
                    friendly_name: string | null;
                    provider: 'twilio' | 'vonage';
                    provider_sid: string | null;
                    capabilities: Json;
                    agent_id: string | null;
                    voice_url: string | null;
                    status_callback_url: string | null;
                    active: boolean;
                    monthly_cost: number;
                    created_at: string;
                    updated_at: string;
                };
                Insert: {
                    id?: string;
                    company_id: string;
                    phone_number: string;
                    country_code?: string;
                    friendly_name?: string | null;
                    provider?: 'twilio' | 'vonage';
                    provider_sid?: string | null;
                    capabilities?: Json;
                    agent_id?: string | null;
                    voice_url?: string | null;
                    status_callback_url?: string | null;
                    active?: boolean;
                    monthly_cost?: number;
                    created_at?: string;
                    updated_at?: string;
                };
                Update: {
                    id?: string;
                    company_id?: string;
                    phone_number?: string;
                    country_code?: string;
                    friendly_name?: string | null;
                    provider?: 'twilio' | 'vonage';
                    provider_sid?: string | null;
                    capabilities?: Json;
                    agent_id?: string | null;
                    voice_url?: string | null;
                    status_callback_url?: string | null;
                    active?: boolean;
                    monthly_cost?: number;
                    created_at?: string;
                    updated_at?: string;
                };
                Relationships: [
                    {
                        foreignKeyName: "phone_numbers_company_id_fkey";
                        columns: ["company_id"];
                        isOneToOne: false;
                        referencedRelation: "companies";
                        referencedColumns: ["id"];
                    },
                    {
                        foreignKeyName: "phone_numbers_agent_id_fkey";
                        columns: ["agent_id"];
                        isOneToOne: false;
                        referencedRelation: "voice_agents";
                        referencedColumns: ["id"];
                    }
                ];
            };
            profiles: {
                Row: {
                    id: string;
                    company_id: string | null;
                    email: string;
                    full_name: string | null;
                    avatar_url: string | null;
                    role: 'owner' | 'admin' | 'member';
                    permissions: Json;
                    last_active_at: string;
                    invited_by: string | null;
                    invite_accepted_at: string | null;
                    created_at: string;
                    updated_at: string;
                };
                Insert: {
                    id: string;
                    company_id?: string | null;
                    email: string;
                    full_name?: string | null;
                    avatar_url?: string | null;
                    role?: 'owner' | 'admin' | 'member';
                    permissions?: Json;
                    last_active_at?: string;
                    invited_by?: string | null;
                    invite_accepted_at?: string | null;
                    created_at?: string;
                    updated_at?: string;
                };
                Update: {
                    id?: string;
                    company_id?: string | null;
                    email?: string;
                    full_name?: string | null;
                    avatar_url?: string | null;
                    role?: 'owner' | 'admin' | 'member';
                    permissions?: Json;
                    last_active_at?: string;
                    invited_by?: string | null;
                    invite_accepted_at?: string | null;
                    created_at?: string;
                    updated_at?: string;
                };
                Relationships: [
                    {
                        foreignKeyName: "profiles_company_id_fkey";
                        columns: ["company_id"];
                        isOneToOne: false;
                        referencedRelation: "companies";
                        referencedColumns: ["id"];
                    },
                    {
                        foreignKeyName: "profiles_invited_by_fkey";
                        columns: ["invited_by"];
                        isOneToOne: false;
                        referencedRelation: "profiles";
                        referencedColumns: ["id"];
                    }
                ];
            };
            voice_agents: {
                Row: {
                    id: string;
                    company_id: string;
                    name: string;
                    description: string | null;
                    model: 'gpt-4o' | 'gpt-3.5-turbo' | 'gpt-4o-mini' | 'claude-3-sonnet' | 'claude-3-haiku';
                    voice: string;
                    language: string;
                    system_prompt: string | null;
                    greeting: string | null;
                    temperature: number;
                    max_tokens: number;
                    response_timeout_ms: number;
                    interruption_threshold_ms: number;
                    active: boolean;
                    webhook_url: string | null;
                    metadata: Json;
                    created_by: string;
                    created_at: string;
                    updated_at: string;
                };
                Insert: {
                    id?: string;
                    company_id: string;
                    name: string;
                    description?: string | null;
                    model?: 'gpt-4o' | 'gpt-3.5-turbo' | 'gpt-4o-mini' | 'claude-3-sonnet' | 'claude-3-haiku';
                    voice?: string;
                    language?: string;
                    system_prompt?: string | null;
                    greeting?: string | null;
                    temperature?: number;
                    max_tokens?: number;
                    response_timeout_ms?: number;
                    interruption_threshold_ms?: number;
                    active?: boolean;
                    webhook_url?: string | null;
                    metadata?: Json;
                    created_by: string;
                    created_at?: string;
                    updated_at?: string;
                };
                Update: {
                    id?: string;
                    company_id?: string;
                    name?: string;
                    description?: string | null;
                    model?: 'gpt-4o' | 'gpt-3.5-turbo' | 'gpt-4o-mini' | 'claude-3-sonnet' | 'claude-3-haiku';
                    voice?: string;
                    language?: string;
                    system_prompt?: string | null;
                    greeting?: string | null;
                    temperature?: number;
                    max_tokens?: number;
                    response_timeout_ms?: number;
                    interruption_threshold_ms?: number;
                    active?: boolean;
                    webhook_url?: string | null;
                    metadata?: Json;
                    created_by?: string;
                    created_at?: string;
                    updated_at?: string;
                };
                Relationships: [
                    {
                        foreignKeyName: "voice_agents_company_id_fkey";
                        columns: ["company_id"];
                        isOneToOne: false;
                        referencedRelation: "companies";
                        referencedColumns: ["id"];
                    },
                    {
                        foreignKeyName: "voice_agents_created_by_fkey";
                        columns: ["created_by"];
                        isOneToOne: false;
                        referencedRelation: "profiles";
                        referencedColumns: ["id"];
                    }
                ];
            };
            voice_sessions: {
                Row: {
                    id: string;
                    company_id: string;
                    livekit_room_id: string;
                    agent_id: string | null;
                    user_id: string | null;
                    client_info: Json;
                    status: 'starting' | 'active' | 'ended' | 'error';
                    started_at: string;
                    ended_at: string | null;
                    duration_seconds: number | null;
                    metadata: Json;
                    created_at: string;
                    updated_at: string;
                };
                Insert: {
                    id?: string;
                    company_id: string;
                    livekit_room_id: string;
                    agent_id?: string | null;
                    user_id?: string | null;
                    client_info?: Json;
                    status?: 'starting' | 'active' | 'ended' | 'error';
                    started_at?: string;
                    ended_at?: string | null;
                    duration_seconds?: number | null;
                    metadata?: Json;
                    created_at?: string;
                    updated_at?: string;
                };
                Update: {
                    id?: string;
                    company_id?: string;
                    livekit_room_id?: string;
                    agent_id?: string | null;
                    user_id?: string | null;
                    client_info?: Json;
                    status?: 'starting' | 'active' | 'ended' | 'error';
                    started_at?: string;
                    ended_at?: string | null;
                    duration_seconds?: number | null;
                    metadata?: Json;
                    created_at?: string;
                    updated_at?: string;
                };
                Relationships: [
                    {
                        foreignKeyName: "voice_sessions_company_id_fkey";
                        columns: ["company_id"];
                        isOneToOne: false;
                        referencedRelation: "companies";
                        referencedColumns: ["id"];
                    },
                    {
                        foreignKeyName: "voice_sessions_agent_id_fkey";
                        columns: ["agent_id"];
                        isOneToOne: false;
                        referencedRelation: "voice_agents";
                        referencedColumns: ["id"];
                    },
                    {
                        foreignKeyName: "voice_sessions_user_id_fkey";
                        columns: ["user_id"];
                        isOneToOne: false;
                        referencedRelation: "profiles";
                        referencedColumns: ["id"];
                    }
                ];
            };
        };
        Views: {
            company_stats: {
                Row: {
                    id: string | null;
                    name: string | null;
                    subscription_status: 'trial' | 'active' | 'past_due' | 'canceled' | 'paused' | null;
                    total_users: number | null;
                    total_agents: number | null;
                    active_agents: number | null;
                    total_phone_numbers: number | null;
                    total_files: number | null;
                    total_storage_bytes: number | null;
                    total_calls: number | null;
                    calls_last_30_days: number | null;
                };
                Relationships: [];
            };
        };
        Functions: {
            get_user_company_id: {
                Args: Record<PropertyKey, never>;
                Returns: string;
            };
        };
        Enums: {
            [_ in never]: never;
        };
        CompositeTypes: {
            [_ in never]: never;
        };
    };
};
//# sourceMappingURL=database.d.ts.map