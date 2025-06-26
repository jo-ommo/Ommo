import type { FastifyInstance } from 'fastify';
import { AgentController } from '../controllers/agentController';
import { FileController } from '../controllers/fileController';
import { ASRService } from '../services/asr';
import { LLMService } from '../services/llm';
import { TTSService } from '../services/tts';
import { createContextualLogger, logVoiceInteraction, logError } from '../utils/logger';

export async function agentRoutes(fastify: FastifyInstance) {
  const agentController = new AgentController();
  const fileController = new FileController();
  const asrService = new ASRService();
  const llmService = new LLMService();
  const ttsService = new TTSService();

  // Health check endpoint
  fastify.get('/health', async (request, reply) => {
    const [deepgramStatus, openaiStatus, cartesiaStatus] = await Promise.all([
      asrService.checkConnection(),
      llmService.checkConnection(),
      ttsService.checkConnection()
    ]);

    return {
      status: 'healthy',
      timestamp: Date.now(),
      service: 'voice-agent-service',
      services: {
        deepgram: deepgramStatus ? 'connected' : 'disconnected',
        openai: openaiStatus ? 'connected' : 'disconnected',
        cartesia: cartesiaStatus ? 'connected' : 'disconnected',
        livekit: 'connected' // TODO: implement actual LiveKit health check
      }
    };
  });

  // Voice agent CRUD operations
  fastify.post('/agents', {
    preHandler: [(fastify as any).authenticate]
  }, async (request: any, reply: any) => {
    return agentController.createAgent(request, reply);
  });

  fastify.get('/agents/:agentId', {
    preHandler: [(fastify as any).authenticate]
  }, async (request: any, reply: any) => {
    return agentController.getAgent(request, reply);
  });

  fastify.put('/agents/:agentId', {
    preHandler: [(fastify as any).authenticate]
  }, async (request: any, reply: any) => {
    return agentController.updateAgent(request, reply);
  });

  fastify.delete('/agents/:agentId', {
    preHandler: [(fastify as any).authenticate]
  }, async (request: any, reply: any) => {
    return agentController.deleteAgent(request, reply);
  });

  fastify.get('/agents', {
    preHandler: [(fastify as any).authenticate]
  }, async (request: any, reply: any) => {
    return agentController.listAgents(request, reply);
  });

  // Knowledge Base File Management routes
  fastify.post('/files', {
    preHandler: [(fastify as any).authenticate]
  }, async (request: any, reply: any) => {
    return fileController.uploadFile(request, reply);
  });

  fastify.get('/files', {
    preHandler: [(fastify as any).authenticate]
  }, async (request: any, reply: any) => {
    return fileController.listFiles(request, reply);
  });

  fastify.get('/files/:fileId', {
    preHandler: [(fastify as any).authenticate]
  }, async (request: any, reply: any) => {
    return fileController.getFile(request, reply);
  });

  fastify.delete('/files/:fileId', {
    preHandler: [(fastify as any).authenticate]
  }, async (request: any, reply: any) => {
    return fileController.deleteFile(request, reply);
  });

  // Agent-File relationship routes
  fastify.post('/agents/:agentId/files', {
    preHandler: [(fastify as any).authenticate]
  }, async (request: any, reply: any) => {
    return agentController.addFileToAgent(request, reply);
  });

  fastify.delete('/agents/:agentId/files/:fileId', {
    preHandler: [(fastify as any).authenticate]
  }, async (request: any, reply: any) => {
    return agentController.removeFileFromAgent(request, reply);
  });

  fastify.get('/agents/:agentId/files', {
    preHandler: [(fastify as any).authenticate]
  }, async (request: any, reply: any) => {
    return agentController.getAgentFiles(request, reply);
  });

  // Session management
  fastify.post('/sessions', {
    preHandler: [(fastify as any).authenticate]
  }, async (request: any, reply) => {
    try {
      // TODO: Implement proper session creation with LiveKit
      const sessionId = `session_${Date.now()}`;
      
      reply.code(201).send({
        success: true,
        data: {
          sessionId,
          status: 'created',
          message: 'Session endpoint - to be implemented with LiveKit integration'
        }
      });
    } catch (error) {
      reply.code(500).send({
        success: false,
        error: 'Failed to create session',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // WebSocket endpoint for real-time voice communication
  fastify.register(async function (fastify) {
    fastify.get('/ws/voice/:sessionId', { websocket: true }, async (connection, request) => {
      const { sessionId } = request.params as { sessionId: string };
      let authContext: any = null;
      let logger: any = null;
      let dgConnection: any = null;
      let conversationHistory: Array<{ role: 'user' | 'assistant' | 'system'; content: string }> = [];

      try {
        // Authenticate WebSocket connection
        authContext = await (fastify as any).authenticateWS(connection, request);
        logger = createContextualLogger({
          tenantId: authContext.tenantId,
          userId: authContext.userId,
          sessionId,
          requestId: `ws_${Date.now()}`
        });

        logger.info({ sessionId }, 'WebSocket voice connection established');

        // Create live Deepgram connection
        dgConnection = asrService.createLiveConnection(
          { tenantId: authContext.tenantId, sessionId },
          async (transcriptionResult) => {
            try {
              // Log transcription
              logVoiceInteraction(
                { tenantId: authContext.tenantId, sessionId },
                'transcription',
                {
                  text: transcriptionResult.text,
                  confidence: transcriptionResult.confidence,
                  isFinal: transcriptionResult.isFinal
                }
              );

              // Send transcription to client
              connection.socket.send(JSON.stringify({
                type: 'transcription',
                sessionId,
                text: transcriptionResult.text,
                confidence: transcriptionResult.confidence,
                isFinal: transcriptionResult.isFinal,
                timestamp: transcriptionResult.timestampMs
              }));

              // Process final transcriptions with LLM
              if (transcriptionResult.isFinal && transcriptionResult.text.trim()) {
                await processTranscription(transcriptionResult.text);
              }
            } catch (error) {
              logger.error(error, 'Error processing transcription');
            }
          }
        );

        // Function to process transcription through LLM and TTS pipeline
        const processTranscription = async (text: string) => {
          try {
            // TODO: Get agent configuration from session
            const mockAgentConfig = {
              id: 'mock-agent',
              tenantId: authContext.tenantId,
              name: 'Mock Agent',
              model: 'gpt-4o' as const,
              voice: 'cartesia-sonic',
              language: 'en-US',
              systemPrompt: 'You are a helpful voice assistant. Keep responses brief and conversational.',
              temperature: 0.7,
              maxTokens: 150,
              responseTimeoutMs: 5000,
              interruptionThresholdMs: 300
            };

            // Generate LLM response
            logVoiceInteraction(
              { tenantId: authContext.tenantId, sessionId },
              'llm_request',
              { message: text, model: mockAgentConfig.model }
            );

            const llmResponse = await llmService.generateResponse(
              text,
              mockAgentConfig,
              { tenantId: authContext.tenantId, sessionId },
              conversationHistory
            );

            logVoiceInteraction(
              { tenantId: authContext.tenantId, sessionId },
              'llm_response',
              {
                response: llmResponse.text,
                usage: llmResponse.usage
              }
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

            // Send LLM response to client
            connection.socket.send(JSON.stringify({
              type: 'llm_response',
              sessionId,
              text: llmResponse.text,
              usage: llmResponse.usage,
              timestamp: Date.now()
            }));

            // Generate TTS audio
            logVoiceInteraction(
              { tenantId: authContext.tenantId, sessionId },
              'tts_request',
              { text: llmResponse.text, voice: mockAgentConfig.voice }
            );

            const ttsResponse = await ttsService.synthesizeSpeech(
              llmResponse.text,
              { tenantId: authContext.tenantId, sessionId },
              {
                voice: mockAgentConfig.voice,
                language: mockAgentConfig.language
              }
            );

            logVoiceInteraction(
              { tenantId: authContext.tenantId, sessionId },
              'tts_response',
              {
                audioSize: ttsResponse.audioBuffer.length,
                duration: ttsResponse.duration,
                format: ttsResponse.contentType
              }
            );

            // Send audio response to client
            connection.socket.send(JSON.stringify({
              type: 'audio_response',
              sessionId,
              audioData: ttsResponse.audioBuffer.toString('base64'),
              format: ttsResponse.contentType,
              duration: ttsResponse.duration,
              timestamp: Date.now()
            }));

          } catch (error) {
            logError(
              { tenantId: authContext.tenantId, sessionId },
              error as Error,
              { stage: 'voice_pipeline' }
            );

            connection.socket.send(JSON.stringify({
              type: 'error',
              sessionId,
              error: 'Failed to process voice input',
              timestamp: Date.now()
            }));
          }
        };

        // Handle incoming WebSocket messages
        connection.socket.on('message', async (message) => {
          try {
            const data = JSON.parse(message.toString());
            
            switch (data.type) {
              case 'audio_chunk':
                // Forward audio to Deepgram
                if (dgConnection && data.audioData) {
                  const audioBuffer = Buffer.from(data.audioData, 'base64');
                  dgConnection.send(audioBuffer);
                }
                break;
                
              case 'session_status':
                connection.socket.send(JSON.stringify({
                  type: 'status_response',
                  sessionId,
                  status: 'active',
                  timestamp: Date.now()
                }));
                break;
                
              case 'end_session':
                logger.info({ sessionId }, 'Session ended by client');
                if (dgConnection) {
                  dgConnection.finish();
                }
                connection.socket.close();
                break;
                
              default:
                connection.socket.send(JSON.stringify({
                  type: 'error',
                  error: 'Unknown message type',
                  timestamp: Date.now()
                }));
            }
          } catch (error) {
            logger.error(error, 'Error processing WebSocket message');
            connection.socket.send(JSON.stringify({
              type: 'error',
              error: 'Invalid message format',
              timestamp: Date.now()
            }));
          }
        });

        // Handle WebSocket close
        connection.socket.on('close', (code, reason) => {
          logger.info({ sessionId, code, reason: reason?.toString() }, 'WebSocket connection closed');
          
          // Clean up Deepgram connection
          if (dgConnection) {
            try {
              dgConnection.finish();
            } catch (error) {
              logger.error(error, 'Error closing Deepgram connection');
            }
          }
        });

        // Handle WebSocket errors
        connection.socket.on('error', (error) => {
          logger.error(error, 'WebSocket error occurred');
          
          // Clean up Deepgram connection
          if (dgConnection) {
            try {
              dgConnection.finish();
            } catch (cleanupError) {
              logger.error(cleanupError, 'Error during cleanup');
            }
          }
        });

        // Send welcome message
        connection.socket.send(JSON.stringify({
          type: 'connected',
          sessionId,
          message: 'Voice pipeline ready',
          timestamp: Date.now()
        }));

      } catch (error) {
        if (logger) {
          logger.error(error, 'Failed to establish voice connection');
        }
        
        connection.socket.send(JSON.stringify({
          type: 'error',
          error: 'Authentication failed',
          timestamp: Date.now()
        }));
        
        connection.socket.close();
      }
    });
  });
} 