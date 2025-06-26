import type { FastifyInstance } from 'fastify';
import { TwilioService } from '../services/twilio';
import { PhoneController } from '../controllers/phoneController';
import { SupabaseService } from '../services/supabase';
import { ASRService } from '../services/asr';
import { LLMService } from '../services/llm';
import { TTSService } from '../services/tts';
import { createContextualLogger, logVoiceInteraction, logError } from '../utils/logger';
import type { 
  TwilioWebhookRequest, 
  CallSession, 
  CallTranscript,
  VoiceAgentConfig 
} from '../types';

export async function twilioRoutes(fastify: FastifyInstance) {
  const twilioService = new TwilioService();
  const supabaseService = new SupabaseService();
  const phoneController = new PhoneController();
  const asrService = new ASRService();
  const llmService = new LLMService();
  const ttsService = new TTSService();

  // Store active call sessions in memory (for real-time tracking)
  const activeStreams = new Map<string, any>();

  // TODO: Add phone number management routes after fixing TypeScript issues

  // Twilio webhook for incoming voice calls
  fastify.post('/voice', async (request, reply) => {
    const logger = createContextualLogger({
      requestId: `voice_${Date.now()}`
    });

    try {
      const webhookData = request.body as TwilioWebhookRequest;
      const { callSid, from, to, callStatus } = webhookData;

      logger.info({ 
        callSid, 
        from, 
        to, 
        callStatus 
      }, 'Incoming voice call');

      // TODO: Look up agent configuration by phone number from Supabase
      // For now, use a mock agent configuration
      const mockAgentConfig: VoiceAgentConfig = {
        id: 'agent-default',
        tenantId: '1', // Default company ID
        name: 'Customer Support Agent',
        model: 'gpt-4o',
        voice: 'alice',
        language: 'en-US',
        systemPrompt: 'You are a helpful customer support agent. Keep responses brief and professional.',
        greeting: 'Hello! Thank you for calling. How can I assist you today?',
        temperature: 0.7,
        maxTokens: 150,
        active: true,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      // Create call session in Supabase
      const callSession = await supabaseService.createCallSession(
        {
          callSid,
          phoneNumberId: to,
          agentId: mockAgentConfig.id,
          fromNumber: from,
          toNumber: to
        },
        1, // Default company ID
        {
          tenantId: mockAgentConfig.tenantId,
          requestId: `voice_${Date.now()}`
        }
      );

      // Generate TwiML response to answer the call
      const twiml = twilioService.generateAnswerTwiML(callSid, mockAgentConfig);

      logVoiceInteraction(
        { tenantId: mockAgentConfig.tenantId, sessionId: callSession.id },
        'call_started',
        { from, to, agentId: mockAgentConfig.id }
      );

      reply.type('text/xml').send(twiml);

    } catch (error) {
      logger.error(error, 'Error handling voice webhook');
      
      // Return basic TwiML to handle the call gracefully
      const errorTwiml = twilioService.generateSayTwiML(
        'I apologize, but I am experiencing technical difficulties. Please try calling again later.'
      );
      
      reply.type('text/xml').send(errorTwiml);
    }
  });

  // Twilio webhook for call status updates
  fastify.post('/status', async (request, reply) => {
    const logger = createContextualLogger({
      requestId: `status_${Date.now()}`
    });

    try {
      const webhookData = request.body as TwilioWebhookRequest;
      const { callSid, callStatus } = webhookData;

      logger.info({ callSid, callStatus }, 'Call status update');

      // Update call session status in Supabase
      if (callStatus === 'completed' || callStatus === 'failed' || callStatus === 'canceled') {
        const endTime = new Date();
        const status = callStatus === 'completed' ? 'completed' : 'failed';
        
        await supabaseService.updateCallSession(
          callSid,
          {
            endTime,
            status
          },
          1, // Default company ID
          {
            tenantId: '1',
            requestId: `status_${Date.now()}`
          }
        );

        logVoiceInteraction(
          { tenantId: '1', sessionId: callSid },
          'call_ended',
          { 
            status: callStatus
          }
        );

        // Clean up resources
        activeStreams.delete(callSid);
        
        logger.info({ callSid }, 'Call session completed');
      }

      reply.send('OK');

    } catch (error) {
      logger.error(error, 'Error handling status webhook');
      reply.send('OK');
    }
  });

  // WebSocket endpoint for Twilio Media Streams
  fastify.register(async function (fastify) {
    fastify.get('/stream/:callSid', { websocket: true }, async (connection, request) => {
      const params = request.params as { callSid: string };
      const { callSid } = params;
      
      const logger = createContextualLogger({
        tenantId: '1',
        requestId: `stream_${Date.now()}`
      });

      let dgConnection: any = null;
      let conversationHistory: Array<{ role: 'user' | 'assistant' | 'system'; content: string }> = [];

      try {
        logger.info({ callSid }, 'Media stream connected');

        // TODO: Get agent configuration from call session in Supabase
        const mockAgentConfig: VoiceAgentConfig = {
          id: 'agent-default',
          tenantId: '1',
          name: 'Customer Support Agent',
          model: 'gpt-4o',
          voice: 'alice',
          language: 'en-US',
          systemPrompt: 'You are a helpful customer support agent. Keep responses brief and professional.',
          greeting: 'Hello! Thank you for calling. How can I assist you today?',
          temperature: 0.7,
          maxTokens: 150,
          active: true,
          createdAt: new Date(),
          updatedAt: new Date()
        };

        // Create Deepgram connection for real-time transcription
        dgConnection = asrService.createLiveConnection(
          { tenantId: '1', sessionId: callSid },
          async (transcriptionResult) => {
            try {
              // Save transcript to Supabase
              await supabaseService.addCallTranscript(
                callSid,
                {
                  speaker: 'user',
                  text: transcriptionResult.text,
                  confidence: transcriptionResult.confidence
                },
                {
                  tenantId: '1',
                  sessionId: callSid,
                  requestId: `transcript_${Date.now()}`
                }
              );

              logger.info({
                callSid,
                text: transcriptionResult.text,
                confidence: transcriptionResult.confidence,
                isFinal: transcriptionResult.isFinal
              }, 'Transcription received');

              // Process final transcriptions
              if (transcriptionResult.isFinal && transcriptionResult.text.trim()) {
                await processUserMessage(transcriptionResult.text, callSid, mockAgentConfig);
              }
            } catch (error) {
              logger.error(error, 'Error processing transcription');
            }
          }
        );

        activeStreams.set(callSid, { dgConnection, logger });

        // Process user message through LLM and TTS
        const processUserMessage = async (text: string, sessionId: string, agentConfig: VoiceAgentConfig) => {
          try {
            // Generate LLM response
            const llmResponse = await llmService.generateResponse(
              text,
              agentConfig,
              { tenantId: '1', sessionId },
              conversationHistory
            );

            // Update conversation history
            conversationHistory.push(
              { role: 'user', content: text },
              { role: 'assistant', content: llmResponse.text }
            );

            // Keep conversation history manageable
            if (conversationHistory.length > 20) {
              conversationHistory = conversationHistory.slice(-20);
            }

            // Save agent response transcript to Supabase
            await supabaseService.addCallTranscript(
              sessionId,
              {
                speaker: 'agent',
                text: llmResponse.text,
                confidence: 1.0
              },
              {
                tenantId: '1',
                sessionId,
                requestId: `agent_transcript_${Date.now()}`
              }
            );

            // Generate TTS audio and send to Twilio
            const ttsResponse = await ttsService.synthesizeSpeech(
              llmResponse.text,
              { tenantId: '1', sessionId },
              { voice: agentConfig.voice, language: agentConfig.language }
            );

            // Send audio back to Twilio stream
            // TODO: Implement audio streaming back to Twilio
            logger.info({
              callSid,
              responseText: llmResponse.text,
              audioSize: ttsResponse.audioData.length
            }, 'Generated agent response');

          } catch (error) {
            logger.error(error, 'Error processing user message');
          }
        };

        // Handle incoming media from Twilio
        connection.socket.on('message', async (message) => {
          try {
            const data = JSON.parse(message.toString());
            
            switch (data.event) {
              case 'connected':
                logger.info({ callSid }, 'Twilio stream connected');
                break;
                
              case 'start':
                logger.info({ callSid, streamSid: data.start?.streamSid }, 'Media stream started');
                break;
                
              case 'media':
                // Forward audio to Deepgram
                if (dgConnection && data.media?.payload) {
                  const audioBuffer = Buffer.from(data.media.payload, 'base64');
                  dgConnection.send(audioBuffer);
                }
                break;
                
              case 'stop':
                logger.info({ callSid }, 'Media stream stopped');
                if (dgConnection) {
                  dgConnection.finish();
                }
                break;
            }
          } catch (error) {
            logger.error(error, 'Error processing media stream message');
          }
        });

        // Handle stream close
        connection.socket.on('close', () => {
          logger.info({ callSid }, 'Media stream disconnected');
          if (dgConnection) {
            try {
              dgConnection.finish();
            } catch (error) {
              logger.error(error, 'Error closing Deepgram connection');
            }
          }
          activeStreams.delete(callSid);
        });

      } catch (error) {
        logger.error(error, 'Error setting up media stream');
        connection.socket.close();
      }
    });
  });

  // Analytics endpoint for call data
  fastify.get('/analytics/calls', {
    preHandler: [(fastify as any).authenticate]
  }, async (request: any, reply) => {
    try {
      // TODO: Implement database queries for call analytics from Supabase
      const mockAnalytics = {
        totalCalls: 0,
        averageDuration: 0,
        callsToday: 0,
        topTopics: [],
        satisfactionScore: 0
      };

      reply.send({
        success: true,
        data: mockAnalytics
      });
    } catch (error) {
      reply.code(500).send({
        success: false,
        error: 'Failed to retrieve analytics'
      });
    }
  });

  // Get call transcripts
  fastify.get('/calls/:callSid/transcripts', {
    preHandler: [(fastify as any).authenticate]
  }, async (request: any, reply) => {
    try {
      const { callSid } = request.params;

      // TODO: Get transcripts from Supabase by callSid
      const mockTranscripts = [];

      reply.send({
        success: true,
        data: {
          callSid,
          transcripts: mockTranscripts
        }
      });
    } catch (error) {
      reply.code(500).send({
        success: false,
        error: 'Failed to retrieve transcripts'
      });
    }
  });

  // Health check for Twilio integration
  fastify.get('/health', async (request, reply) => {
    try {
      const twilioConnected = await twilioService.checkConnection();
      const supabaseConnected = await supabaseService.checkConnection();
      
      const health = {
        status: 'healthy',
        timestamp: Date.now(),
        services: {
          twilio: twilioConnected ? 'connected' : 'disconnected',
          supabase: supabaseConnected ? 'connected' : 'disconnected',
          deepgram: 'unknown', // TODO: implement actual health checks
          openai: 'unknown',
          cartesia: 'unknown'
        }
      };

      const allHealthy = Object.values(health.services).every(
        status => status === 'connected' || status === 'unknown'
      );

      reply.code(allHealthy ? 200 : 503).send(health);
    } catch (error) {
      reply.code(503).send({
        status: 'unhealthy',
        timestamp: Date.now(),
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });
} 