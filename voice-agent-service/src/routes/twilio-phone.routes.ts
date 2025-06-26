import { FastifyInstance } from 'fastify';
import { TwilioPhoneController } from '../controllers/twilio-phone.controller';
import { logger } from '../utils/logger';

const twilioController = new TwilioPhoneController();

/**
 * Twilio Phone Integration Routes
 * Handles incoming calls, webhooks, and call management
 */
export async function twilioPhoneRoutes(fastify: FastifyInstance) {
  // ================================================================
  // TWILIO WEBHOOKS
  // ================================================================

  /**
   * Main webhook for incoming calls from Twilio
   */
  fastify.post('/twilio/incoming-call', {
    schema: {
      description: 'Handle incoming phone calls from Twilio',
      tags: ['Twilio'],
      body: {
        type: 'object',
        properties: {
          CallSid: { type: 'string' },
          From: { type: 'string' },
          To: { type: 'string' },
          CallStatus: { type: 'string' },
          Direction: { type: 'string' },
          AccountSid: { type: 'string' },
          ApiVersion: { type: 'string' }
        },
        required: ['CallSid', 'From', 'To', 'CallStatus']
      },
      response: {
        200: {
          type: 'string',
          description: 'TwiML response'
        }
      }
    }
  }, async (request, reply) => {
    return twilioController.handleIncomingCall(request as any, reply);
  });

  /**
   * Webhook for call status updates
   */
  fastify.post('/twilio/call-status', {
    schema: {
      description: 'Handle call status updates from Twilio',
      tags: ['Twilio'],
      body: {
        type: 'object',
        properties: {
          CallSid: { type: 'string' },
          CallStatus: { type: 'string' },
          CallDuration: { type: 'string' },
          AccountSid: { type: 'string' }
        },
        required: ['CallSid', 'CallStatus']
      },
      response: {
        200: {
          type: 'string',
          description: 'OK'
        }
      }
    }
  }, async (request, reply) => {
    return twilioController.handleCallStatusUpdate(request as any, reply);
  });

  /**
   * Webhook for call recordings
   */
  fastify.post('/twilio/recording', {
    schema: {
      description: 'Handle call recording webhooks from Twilio',
      tags: ['Twilio'],
      body: {
        type: 'object',
        properties: {
          CallSid: { type: 'string' },
          RecordingUrl: { type: 'string' },
          RecordingDuration: { type: 'string' },
          RecordingSid: { type: 'string' }
        },
        required: ['CallSid', 'RecordingUrl']
      },
      response: {
        200: {
          type: 'string',
          description: 'OK'
        }
      }
    }
  }, async (request, reply) => {
    return twilioController.handleCallRecording(request as any, reply);
  });

  /**
   * WebSocket endpoint for audio streaming
   */
  fastify.post('/twilio/audio-stream', {
    schema: {
      description: 'Handle audio streaming connections',
      tags: ['Twilio'],
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            message: { type: 'string' }
          }
        }
      }
    }
  }, async (request, reply) => {
    return twilioController.handleAudioStream(request, reply);
  });

  // ================================================================
  // CALL MANAGEMENT ENDPOINTS (Protected)
  // ================================================================

  /**
   * Get active call statistics
   */
  fastify.get('/twilio/stats', {
    schema: {
      description: 'Get active call statistics',
      tags: ['Twilio', 'Stats'],
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            data: {
              type: 'object',
              properties: {
                activeVoiceSessions: { type: 'number' },
                activeTwilioCalls: { type: 'number' },
                totalCostToday: { type: 'number' },
                averageCallDuration: { type: 'number' },
                averageResponseTime: { type: 'number' }
              }
            }
          }
        }
      }
    }
  }, async (request, reply) => {
    return twilioController.getActiveCallStats(request, reply);
  });

  /**
   * Make an outbound call
   */
  fastify.post('/twilio/outbound-call', {
    schema: {
      description: 'Initiate an outbound call',
      tags: ['Twilio', 'Calls'],
      body: {
        type: 'object',
        properties: {
          to: { type: 'string', description: 'Phone number to call' },
          agentId: { type: 'string', description: 'ID of the voice agent' },
          companyId: { type: 'string', description: 'Company ID' }
        },
        required: ['to', 'agentId', 'companyId']
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            data: {
              type: 'object',
              properties: {
                callSid: { type: 'string' },
                from: { type: 'string' },
                to: { type: 'string' },
                status: { type: 'string' },
                agentId: { type: 'string' }
              }
            }
          }
        }
      }
    }
  }, async (request, reply) => {
    return twilioController.makeOutboundCall(request, reply);
  });

  /**
   * End an active call
   */
  fastify.post('/twilio/end-call/:callSid', {
    schema: {
      description: 'End an active call',
      tags: ['Twilio', 'Calls'],
      params: {
        type: 'object',
        properties: {
          callSid: { type: 'string', description: 'Twilio Call SID' }
        },
        required: ['callSid']
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            data: {
              type: 'object',
              properties: {
                callSid: { type: 'string' },
                status: { type: 'string' }
              }
            }
          }
        }
      }
    }
  }, async (request, reply) => {
    return twilioController.endCall(request, reply);
  });

  // ================================================================
  // HEALTH CHECK
  // ================================================================

  /**
   * Health check for Twilio integration
   */
  fastify.get('/twilio/health', {
    schema: {
      description: 'Health check for Twilio phone integration',
      tags: ['Health', 'Twilio'],
      response: {
        200: {
          type: 'object',
          properties: {
            status: { type: 'string' },
            timestamp: { type: 'number' },
            services: {
              type: 'object',
              properties: {
                twilio: { type: 'string' },
                livekit: { type: 'string' },
                voiceAI: { type: 'string' }
              }
            }
          }
        }
      }
    }
  }, async (request, reply) => {
    try {
      const status = {
        status: 'healthy',
        timestamp: Date.now(),
        services: {
          twilio: 'connected',
          livekit: 'connected',
          voiceAI: 'ready'
        }
      };

      return reply.send(status);
    } catch (error) {
      logger.error('Twilio health check failed:', error);
      return reply.code(500).send({
        status: 'unhealthy',
        timestamp: Date.now(),
        error: 'Health check failed'
      });
    }
  });

  logger.info('Twilio phone routes registered');
} 