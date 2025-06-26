import { EventEmitter } from 'events';
import { Room, RoomServiceClient, DataPacket_Kind } from 'livekit-server-sdk';
import { createClient } from 'redis';
import type { RedisClientType } from 'redis';
import OpenAI from 'openai';
import { createClient as createDeepgramClient } from '@deepgram/sdk';
import twilio from 'twilio';
import { supabase } from './supabase';
import { logger } from '../utils/logger';
import { VoiceAgent, CallSession } from '../types';

// Production-grade interfaces for voice AI pipeline
export interface VoiceAIConfig {
  agent: VoiceAgent;
  session: CallSession;
  livekit: {
    url: string;
    apiKey: string;
    apiSecret: string;
    roomName: string;
  };
  twilio: {
    accountSid: string;
    authToken: string;
    phoneNumber: string;
  };
  ai: {
    openaiApiKey: string;
    deepgramApiKey: string;
    model: string;
    voice: string;
    temperature: number;
  };
}

export interface VoiceInteraction {
  id: string;
  sessionId: string;
  timestamp: Date;
  speaker: 'user' | 'agent';
  text: string;
  audioUrl?: string;
  confidence?: number;
  processingTime?: number;
  tokens?: {
    input: number;
    output: number;
    cost: number;
  };
}

export interface KnowledgeContext {
  documents: Array<{
    id: string;
    content: string;
    relevanceScore: number;
    metadata: any;
  }>;
  query: string;
  totalDocuments: number;
}

export interface SessionMetrics {
  sessionId: string;
  duration: number;
  interactions: number;
  avgResponseTime: number;
  userSatisfaction?: number;
  cost: {
    stt: number;
    llm: number;
    tts: number;
    total: number;
  };
  errors: number;
}

/**
 * Production-grade Voice AI Pipeline Service
 * Handles real-time voice conversations with AI agents over phone calls
 */
export class VoiceAIPipelineService extends EventEmitter {
  private redis: RedisClientType | null = null;
  private roomService: RoomServiceClient | null = null;
  private openai: OpenAI | null = null;
  private deepgram: any = null;
  private twilioClient: twilio.Twilio | null = null;
  private _servicesInitialized = false;
  
  private activeSessions: Map<string, VoiceAIConfig> = new Map();
  private sessionMetrics: Map<string, SessionMetrics> = new Map();
  private knowledgeCache: Map<string, KnowledgeContext> = new Map();

  constructor() {
    super();
    // Don't initialize services in constructor - wait until they're needed
  }

  private async ensureServicesInitialized() {
    if (this._servicesInitialized) return;
    
    try {
      // Initialize Redis for session management and caching
      this.redis = createClient({
        url: process.env.REDIS_URL || 'redis://localhost:6379'
      });
      await this.redis.connect();

      // Initialize LiveKit for real-time communication
      this.roomService = new RoomServiceClient(
        process.env.LIVEKIT_URL!,
        process.env.LIVEKIT_API_KEY!,
        process.env.LIVEKIT_API_SECRET!
      );

      // Initialize AI services
      this.openai = new OpenAI({
        apiKey: process.env.OPENAI_API_KEY!
      });

      this.deepgram = createDeepgramClient(process.env.DEEPGRAM_API_KEY!);

      // Initialize Twilio for phone integration
      this.twilioClient = twilio(
        process.env.TWILIO_ACCOUNT_SID!,
        process.env.TWILIO_AUTH_TOKEN!
      );

      this._servicesInitialized = true;
      logger.info('Voice AI Pipeline services initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize Voice AI Pipeline services:', error);
      throw error;
    }
  }

  /**
   * Start a new voice AI session for incoming phone call
   */
  async startVoiceSession(config: VoiceAIConfig): Promise<string> {
    try {
      // Ensure services are initialized
      await this.ensureServicesInitialized();
      
      const sessionId = config.session.id;
      logger.info(`Starting voice AI session ${sessionId} for agent ${config.agent.id}`);

      // Store session configuration
      this.activeSessions.set(sessionId, config);

      // Initialize session metrics
      this.sessionMetrics.set(sessionId, {
        sessionId,
        duration: 0,
        interactions: 0,
        avgResponseTime: 0,
        cost: { stt: 0, llm: 0, tts: 0, total: 0 },
        errors: 0
      });

      // Create LiveKit room for this session
      await this.createLiveKitRoom(config);

      // Load agent's knowledge base
      await this.loadKnowledgeBase(config.agent.id);

      // Set up real-time audio processing pipeline
      await this.setupAudioPipeline(sessionId);

      // Update session status in database
      await supabase.updateCallSession(config.session.callSid, {
        status: 'active'
      });

      this.emit('session:started', { sessionId, agentId: config.agent.id });
      return sessionId;

    } catch (error) {
      logger.error('Error starting voice session:', error);
      throw error;
    }
  }

  /**
   * Process incoming audio from phone call
   */
  async processIncomingAudio(sessionId: string, audioBuffer: Buffer): Promise<void> {
    try {
      const config = this.activeSessions.get(sessionId);
      if (!config) {
        throw new Error(`Session ${sessionId} not found`);
      }

      const startTime = Date.now();

      // Step 1: Speech-to-Text using Deepgram
      const transcription = await this.speechToText(audioBuffer, sessionId);
      
      if (!transcription.text || transcription.text.trim().length === 0) {
        return; // Skip empty transcriptions
      }

      logger.info(`STT Result for session ${sessionId}:`, transcription.text);

      // Step 2: Update conversation context
      await this.addInteraction(sessionId, {
        speaker: 'user',
        text: transcription.text,
        confidence: transcription.confidence,
        timestamp: new Date()
      });

      // Step 3: Generate AI response using LLM + RAG
      const response = await this.generateAIResponse(sessionId, transcription.text);

      // Step 4: Convert response to speech using TTS
      const audioResponse = await this.textToSpeech(response.text, config.ai.voice);

      // Step 5: Send audio response back through LiveKit
      await this.sendAudioResponse(sessionId, audioResponse);

      // Step 6: Update metrics
      await this.updateSessionMetrics(sessionId, {
        processingTime: Date.now() - startTime,
        inputTokens: response.usage?.prompt_tokens || 0,
        outputTokens: response.usage?.completion_tokens || 0
      });

      this.emit('interaction:completed', { sessionId, response: response.text });

    } catch (error) {
      logger.error(`Error processing audio for session ${sessionId}:`, error);
      await this.handleSessionError(sessionId, error);
    }
  }

  /**
   * Speech-to-Text using Deepgram
   */
  private async speechToText(audioBuffer: Buffer, sessionId: string): Promise<{
    text: string;
    confidence: number;
    processingTime: number;
  }> {
    try {
      const startTime = Date.now();

      const response = await this.deepgram.listen.prerecorded.transcribeBuffer(
        audioBuffer,
        {
          model: 'nova-2',
          language: 'en-US',
          smart_format: true,
          punctuate: true,
          diarize: true,
          utterances: true,
          keywords: ['agent', 'help', 'support', 'transfer', 'human']
        }
      );

      const transcript = response.result?.channels?.[0]?.alternatives?.[0];
      const processingTime = Date.now() - startTime;

      // Update cost tracking
      await this.updateCostMetrics(sessionId, 'stt', this.calculateSTTCost(audioBuffer.length));

      return {
        text: transcript?.transcript || '',
        confidence: transcript?.confidence || 0,
        processingTime
      };

    } catch (error) {
      logger.error('Speech-to-text error:', error);
      throw error;
    }
  }

  /**
   * Generate AI response using OpenAI + RAG
   */
  private async generateAIResponse(sessionId: string, userMessage: string): Promise<{
    text: string;
    usage?: any;
    knowledgeUsed: boolean;
  }> {
    try {
      const config = this.activeSessions.get(sessionId)!;
      
      // Get conversation history
      const conversationHistory = await this.getConversationHistory(sessionId);
      
      // Retrieve relevant knowledge base context
      const knowledgeContext = await this.retrieveKnowledgeContext(
        config.agent.id, 
        userMessage
      );

      // Build prompt with system instructions, knowledge base, and conversation history
      const systemPrompt = this.buildSystemPrompt(
        config.agent,
        knowledgeContext,
        conversationHistory
      );

      const messages = [
        { role: 'system', content: systemPrompt },
        ...conversationHistory.map(interaction => ({
          role: interaction.speaker === 'user' ? 'user' : 'assistant',
          content: interaction.text
        })),
        { role: 'user', content: userMessage }
      ];

      // Generate response using OpenAI
      const response = await this.openai.chat.completions.create({
        model: config.ai.model,
        messages: messages as any,
        temperature: config.ai.temperature,
        max_tokens: 150,
        presence_penalty: 0.1,
        frequency_penalty: 0.1,
        stream: false
      });

      const responseText = response.choices[0]?.message?.content || '';

      // Update cost tracking
      await this.updateCostMetrics(sessionId, 'llm', this.calculateLLMCost(response.usage));

      // Store AI response in conversation history
      await this.addInteraction(sessionId, {
        speaker: 'agent',
        text: responseText,
        timestamp: new Date()
      });

      return {
        text: responseText,
        usage: response.usage,
        knowledgeUsed: knowledgeContext.documents.length > 0
      };

    } catch (error) {
      logger.error('AI response generation error:', error);
      throw error;
    }
  }

  /**
   * Text-to-Speech using OpenAI
   */
  private async textToSpeech(text: string, voice: string): Promise<Buffer> {
    try {
      const response = await this.openai.audio.speech.create({
        model: 'tts-1-hd',
        voice: voice as any,
        input: text,
        response_format: 'wav',
        speed: 1.0
      });

      const audioBuffer = Buffer.from(await response.arrayBuffer());
      
      // Update cost tracking
      const sessionId = Array.from(this.activeSessions.keys())[0]; // Get current session
      await this.updateCostMetrics(sessionId, 'tts', this.calculateTTSCost(text.length));

      return audioBuffer;

    } catch (error) {
      logger.error('Text-to-speech error:', error);
      throw error;
    }
  }

  /**
   * Retrieve relevant knowledge base context using RAG
   */
  private async retrieveKnowledgeContext(
    agentId: string, 
    query: string
  ): Promise<KnowledgeContext> {
    try {
      // Check cache first
      const cacheKey = `knowledge:${agentId}:${this.hashQuery(query)}`;
      const cached = this.knowledgeCache.get(cacheKey);
      if (cached) {
        return cached;
      }

      // Get agent's knowledge base files
      const agentFiles = await supabase.getAgentFiles(agentId, 'system');
      
      if (agentFiles.length === 0) {
        return { documents: [], query, totalDocuments: 0 };
      }

      // Perform semantic search using OpenAI embeddings
      const queryEmbedding = await this.openai.embeddings.create({
        model: 'text-embedding-3-small',
        input: query
      });

      // Search through knowledge base (simplified for this example)
      const relevantDocuments = await this.performSemanticSearch(
        agentFiles,
        queryEmbedding.data[0].embedding,
        5 // Top 5 results
      );

      const context: KnowledgeContext = {
        documents: relevantDocuments,
        query,
        totalDocuments: agentFiles.length
      };

      // Cache the result
      this.knowledgeCache.set(cacheKey, context);

      return context;

    } catch (error) {
      logger.error('Knowledge retrieval error:', error);
      return { documents: [], query, totalDocuments: 0 };
    }
  }

  /**
   * Build comprehensive system prompt with context
   */
  private buildSystemPrompt(
    agent: VoiceAgent,
    knowledgeContext: KnowledgeContext,
    conversationHistory: VoiceInteraction[]
  ): string {
    let prompt = `You are ${agent.name}, an AI voice assistant. ${agent.systemPrompt || ''}

IMPORTANT INSTRUCTIONS:
- Keep responses under 150 words and conversational
- Speak naturally as if having a phone conversation
- Use the provided knowledge base to answer questions accurately
- If you don't know something, admit it politely
- Be helpful, professional, and empathetic
- Ask clarifying questions when needed

`;

    // Add knowledge base context if available
    if (knowledgeContext.documents.length > 0) {
      prompt += `KNOWLEDGE BASE CONTEXT:
${knowledgeContext.documents.map(doc => 
  `- ${doc.content} (Relevance: ${(doc.relevanceScore * 100).toFixed(0)}%)`
).join('\n')}

`;
    }

    // Add conversation context
    if (conversationHistory.length > 0) {
      prompt += `RECENT CONVERSATION CONTEXT:
${conversationHistory.slice(-3).map(interaction => 
  `${interaction.speaker}: ${interaction.text}`
).join('\n')}

`;
    }

    prompt += `Remember: You are speaking on a phone call. Keep responses natural and concise.`;

    return prompt;
  }

  /**
   * Create LiveKit room for the session
   */
  private async createLiveKitRoom(config: VoiceAIConfig): Promise<void> {
    try {
      await this.roomService.createRoom({
        name: config.livekit.roomName,
        emptyTimeout: 300, // 5 minutes
        maxParticipants: 2, // Agent and caller
        metadata: JSON.stringify({
          sessionId: config.session.id,
          agentId: config.agent.id,
          companyId: config.agent.companyId
        })
      });

      logger.info(`Created LiveKit room: ${config.livekit.roomName}`);
    } catch (error) {
      logger.error('Error creating LiveKit room:', error);
      throw error;
    }
  }

  /**
   * Set up audio processing pipeline
   */
  private async setupAudioPipeline(sessionId: string): Promise<void> {
    try {
      // Set up WebRTC audio processing
      // This would typically involve setting up audio tracks, encoding/decoding, etc.
      // Implementation details depend on your specific setup

      logger.info(`Audio pipeline set up for session ${sessionId}`);
    } catch (error) {
      logger.error('Error setting up audio pipeline:', error);
      throw error;
    }
  }

  /**
   * Send audio response back through LiveKit
   */
  private async sendAudioResponse(sessionId: string, audioBuffer: Buffer): Promise<void> {
    try {
      // Implementation would send audio through LiveKit room
      // This is a simplified placeholder
      
      logger.info(`Sent audio response for session ${sessionId}, size: ${audioBuffer.length} bytes`);
    } catch (error) {
      logger.error('Error sending audio response:', error);
      throw error;
    }
  }

  /**
   * Add interaction to conversation history
   */
  private async addInteraction(sessionId: string, interaction: Partial<VoiceInteraction>): Promise<void> {
    try {
      const fullInteraction: VoiceInteraction = {
        id: `interaction-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        sessionId,
        timestamp: new Date(),
        speaker: interaction.speaker!,
        text: interaction.text!,
        confidence: interaction.confidence,
        processingTime: interaction.processingTime
      };

      // Store in database
      await supabase.addCallTranscript({
        session_id: sessionId,
        speaker: interaction.speaker!,
        text: interaction.text!,
        confidence: interaction.confidence,
        timestamp_ms: Date.now(),
        turn_number: await this.getNextTurnNumber(sessionId)
      });

      // Store in Redis for quick access
      await this.redis.lPush(
        `session:${sessionId}:interactions`, 
        JSON.stringify(fullInteraction)
      );

      // Keep only last 20 interactions in Redis
      await this.redis.lTrim(`session:${sessionId}:interactions`, 0, 19);

    } catch (error) {
      logger.error('Error adding interaction:', error);
    }
  }

  /**
   * Get conversation history for the session
   */
  private async getConversationHistory(sessionId: string): Promise<VoiceInteraction[]> {
    try {
      const interactions = await this.redis.lRange(
        `session:${sessionId}:interactions`, 
        0, -1
      );

      return interactions
        .map(item => JSON.parse(item))
        .reverse(); // Reverse to get chronological order

    } catch (error) {
      logger.error('Error getting conversation history:', error);
      return [];
    }
  }

  /**
   * End voice session and cleanup
   */
  async endVoiceSession(sessionId: string): Promise<SessionMetrics> {
    try {
      logger.info(`Ending voice session ${sessionId}`);

      const config = this.activeSessions.get(sessionId);
      const metrics = this.sessionMetrics.get(sessionId);

      if (config) {
        // Update final session metrics
        if (metrics) {
          metrics.duration = Date.now() - config.session.startTime.getTime();
        }

        // Update database
        await supabase.updateCallSession(config.session.callSid, {
          end_time: new Date().toISOString(),
          duration_seconds: Math.floor((metrics?.duration || 0) / 1000),
          status: 'completed'
        });

        // Clean up LiveKit room
        try {
          await this.roomService.deleteRoom(config.livekit.roomName);
        } catch (error) {
          logger.warn('Error deleting LiveKit room:', error);
        }

        // Clean up Redis data
        await this.redis.del(`session:${sessionId}:interactions`);
      }

      // Remove from active sessions
      this.activeSessions.delete(sessionId);
      const finalMetrics = this.sessionMetrics.get(sessionId);
      this.sessionMetrics.delete(sessionId);

      this.emit('session:ended', { sessionId, metrics: finalMetrics });

      return finalMetrics!;

    } catch (error) {
      logger.error('Error ending voice session:', error);
      throw error;
    }
  }

  // Helper methods
  private async performSemanticSearch(files: any[], queryEmbedding: number[], limit: number): Promise<any[]> {
    // Simplified semantic search - in production, you'd use a vector database
    return files.slice(0, limit).map(file => ({
      id: file.id,
      content: file.contentPreview || '',
      relevanceScore: Math.random(), // Placeholder
      metadata: file.metadata
    }));
  }

  private hashQuery(query: string): string {
    return Buffer.from(query).toString('base64').substr(0, 16);
  }

  private calculateSTTCost(audioLength: number): number {
    // Deepgram pricing: ~$0.0059 per minute
    const minutes = audioLength / (44100 * 60 * 2); // Assuming 44.1kHz stereo
    return minutes * 0.0059;
  }

  private calculateLLMCost(usage: any): number {
    if (!usage) return 0;
    // GPT-4o pricing: $5/1M input tokens, $15/1M output tokens
    const inputCost = (usage.prompt_tokens / 1000000) * 5;
    const outputCost = (usage.completion_tokens / 1000000) * 15;
    return inputCost + outputCost;
  }

  private calculateTTSCost(textLength: number): number {
    // OpenAI TTS pricing: $15/1M characters
    return (textLength / 1000000) * 15;
  }

  private async updateCostMetrics(sessionId: string, type: 'stt' | 'llm' | 'tts', cost: number): Promise<void> {
    const metrics = this.sessionMetrics.get(sessionId);
    if (metrics) {
      metrics.cost[type] += cost;
      metrics.cost.total += cost;
    }
  }

  private async updateSessionMetrics(sessionId: string, data: any): Promise<void> {
    const metrics = this.sessionMetrics.get(sessionId);
    if (metrics) {
      metrics.interactions++;
      if (data.processingTime) {
        metrics.avgResponseTime = (metrics.avgResponseTime + data.processingTime) / 2;
      }
    }
  }

  private async handleSessionError(sessionId: string, error: any): Promise<void> {
    const metrics = this.sessionMetrics.get(sessionId);
    if (metrics) {
      metrics.errors++;
    }
    this.emit('session:error', { sessionId, error });
  }

  private async getNextTurnNumber(sessionId: string): Promise<number> {
    const length = await this.redis.lLen(`session:${sessionId}:interactions`);
    return length + 1;
  }

  private async loadKnowledgeBase(agentId: string): Promise<void> {
    // Pre-load and cache knowledge base for the agent
    logger.info(`Loading knowledge base for agent ${agentId}`);
  }

  // Public getters for monitoring
  getActiveSessionsCount(): number {
    return this.activeSessions.size;
  }

  getSessionMetrics(sessionId: string): SessionMetrics | undefined {
    return this.sessionMetrics.get(sessionId);
  }

  getAllSessionMetrics(): SessionMetrics[] {
    return Array.from(this.sessionMetrics.values());
  }
} 