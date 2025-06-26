export interface JWTPayload {
  sub: string;
  company_id: string;
  user_id: string;
  tenant_id: string;
  exp: number;
  iat: number;
  iss: string;
  aud: string;
}

export interface VoiceAgent {
  id: string;
  name: string;
  description?: string;
  model: 'gpt-4o' | 'gpt-3.5-turbo' | 'gpt-4o-mini' | 'claude-3-sonnet' | 'claude-3-haiku';
  voice: string;
  language: string;
  systemPrompt?: string;
  greeting?: string;
  temperature: number;
  maxTokens: number;
  responseTimeoutMs: number;
  interruptionThresholdMs: number;
  active: boolean;
  webhookUrl?: string;
  metadata: any;
  createdAt: string;
  updatedAt: string;
}

export interface VoiceAgentCreateRequest {
  name: string;
  description?: string;
  model?: 'gpt-4o' | 'gpt-3.5-turbo' | 'gpt-4o-mini' | 'claude-3-sonnet' | 'claude-3-haiku';
  voice?: string;
  language?: string;
  systemPrompt?: string;
  greeting?: string;
  temperature?: number;
  maxTokens?: number;
  responseTimeoutMs?: number;
  interruptionThresholdMs?: number;
  active?: boolean;
  webhookUrl?: string;
  metadata?: any;
}

export interface VoiceAgentUpdateRequest {
  name?: string;
  description?: string;
  model?: 'gpt-4o' | 'gpt-3.5-turbo' | 'gpt-4o-mini' | 'claude-3-sonnet' | 'claude-3-haiku';
  voice?: string;
  language?: string;
  systemPrompt?: string;
  greeting?: string;
  temperature?: number;
  maxTokens?: number;
  responseTimeoutMs?: number;
  interruptionThresholdMs?: number;
  active?: boolean;
  webhookUrl?: string;
  metadata?: any;
}

export interface VoiceAgentConfig {
  id: string;
  name: string;
  model: string;
  voice: string;
  language: string;
  systemPrompt?: string;
  greeting?: string;
  temperature: number;
  maxTokens: number;
  responseTimeoutMs: number;
  interruptionThresholdMs: number;
  tenantId: string;
}

export interface KnowledgeBaseFile {
  id: string;
  filename: string;
  originalFilename: string;
  fileSize: number;
  mimeType?: string;
  filePath: string;
  contentHash?: string;
  contentPreview?: string;
  processingStatus: 'uploaded' | 'processing' | 'processed' | 'error';
  processingMetadata: any;
  tags: string[];
  createdAt: string;
  updatedAt: string;
}

export interface FileUploadRequest {
  filename: string;
  content: string; // base64 encoded
  mimeType?: string;
  tags?: string[];
}

export interface Company {
  id: string;
  name: string;
  slug: string;
  logoUrl?: string;
  settings: any;
  subscriptionStatus: 'trial' | 'active' | 'past_due' | 'canceled' | 'paused';
  subscriptionPlanId?: string;
  subscriptionCustomerId?: string;
  maxAgents: number;
  maxUsers: number;
  maxStorageMb: number;
  trialEndsAt: string;
  createdAt: string;
  updatedAt: string;
}

export interface Profile {
  id: string;
  companyId?: string;
  email: string;
  fullName?: string;
  avatarUrl?: string;
  role: 'owner' | 'admin' | 'member';
  permissions: any;
  lastActiveAt: string;
  invitedBy?: string;
  inviteAcceptedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface PhoneNumber {
  id: string;
  companyId: string;
  phoneNumber: string;
  countryCode: string;
  friendlyName?: string;
  provider: 'twilio' | 'vonage';
  providerSid?: string;
  twilioSid?: string;
  capabilities: any;
  agentId?: string;
  voiceUrl?: string;
  statusCallbackUrl?: string;
  active: boolean;
  monthlyCost: number;
  createdAt: string;
  updatedAt: string;
}

export interface CallSession {
  id: string;
  companyId: string;
  callSid: string;
  phoneNumberId?: string;
  agentId?: string;
  fromNumber: string;
  toNumber: string;
  direction: 'inbound' | 'outbound';
  startTime: string;
  endTime?: string;
  durationSeconds?: number;
  status: 'active' | 'completed' | 'failed' | 'busy' | 'no-answer';
  recordingUrl?: string;
  summary?: string;
  sentimentScore?: number;
  analytics: any;
  costData: any;
  createdAt: string;
  updatedAt: string;
}

export interface CallTranscript {
  id: string;
  sessionId: string;
  speaker: 'user' | 'agent';
  text: string;
  confidence?: number;
  timestampMs: number;
  audioUrl?: string;
  turnNumber: number;
  createdAt: string;
}

export interface TwilioWebhookRequest {
  CallSid: string;
  AccountSid: string;
  From: string;
  To: string;
  Direction: 'inbound' | 'outbound';
  CallStatus: string;
  ApiVersion: string;
  callSid?: string;
  from?: string;
  to?: string;
  callStatus?: string;
}

export interface TwilioCallData {
  callSid: string;
  accountSid: string;
  from: string;
  to: string;
  direction: 'inbound' | 'outbound';
  status: string;
  callStatus?: string;
}

export interface AudioChunk {
  data: Buffer;
  sequenceNumber: number;
  timestamp: number;
}

export interface TranscriptionResult {
  text: string;
  confidence: number;
  isFinal: boolean;
  timestampMs: number;
  speaker?: 'user' | 'agent';
}

export interface LLMResponse {
  text: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  finishReason?: string;
}

export interface TTSResponse {
  audioBuffer: Buffer;
  contentType: string;
  duration?: number;
}

export interface LogContext {
  companyId: string;
  sessionId?: string;
  userId?: string;
  requestId?: string;
  callSid?: string;
  tenantId?: string;
}

export interface ErrorResponse {
  error: string;
  code: string;
  timestamp: number;
  requestId?: string;
}

export interface HealthResponse {
  status: 'healthy' | 'unhealthy';
  timestamp: number;
  services: {
    supabase: 'connected' | 'disconnected';
    deepgram: 'connected' | 'disconnected';
    openai: 'connected' | 'disconnected';
    cartesia: 'connected' | 'disconnected';
    livekit: 'connected' | 'disconnected';
    redis?: 'connected' | 'disconnected';
  };
}

export interface AgentSession {
  id: string;
  agentId: string;
  roomName: string;
  companyId: string;
  workerId: string;
  status: 'active' | 'stopped' | 'error';
  startedAt: Date;
  endedAt?: Date;
  interactions: SessionInteraction[];
}

export interface SessionInteraction {
  id: string;
  sessionId: string;
  speaker: 'user' | 'agent';
  text: string;
  timestamp: Date;
  metadata?: any;
}

export interface CreateVoiceAgentRequest {
  name: string;
  instructions: string;
  voice?: string;
  model?: string;
  phoneNumber?: string;
  knowledgeBaseFiles?: string[];
  settings?: {
    interruptions_enabled?: boolean;
    noise_suppression_enabled?: boolean;
    voice_speed?: number;
    voice_pitch?: number;
    speech_timeout?: number;
    silence_timeout?: number;
  };
}

export interface UpdateVoiceAgentRequest {
  name?: string;
  instructions?: string;
  voice?: string;
  model?: string;
  phoneNumber?: string;
  knowledgeBaseFiles?: string[];
  active?: boolean;
  settings?: {
    interruptions_enabled?: boolean;
    noise_suppression_enabled?: boolean;
    voice_speed?: number;
    voice_pitch?: number;
    speech_timeout?: number;
    silence_timeout?: number;
  };
} 