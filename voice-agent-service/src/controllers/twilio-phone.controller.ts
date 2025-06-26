import { FastifyRequest, FastifyReply } from 'fastify';
import twilio from 'twilio';
import VoiceResponse = require('twilio/lib/twiml/VoiceResponse');
import { supabase } from '../services/supabase';
import { VoiceAIPipelineService, VoiceAIConfig } from '../services/voice-ai-pipeline.service';
import { logger } from '../utils/logger';

// Helper function for generating session IDs
function generateSessionId(): string {
  return `session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

interface TwilioWebhookRequest extends FastifyRequest {
  body: {
    CallSid: string;
    From: string;
    To: string;
    CallStatus: string;
    Direction: string;
    AccountSid: string;
    ApiVersion: string;
    ForwardedFrom?: string;
    CallerName?: string;
    [key: string]: any;
  };
}

/**
 * Production-grade Twilio Phone Integration Controller
 * Handles incoming phone calls and connects them to AI voice agents
 */
export class TwilioPhoneController {
  private voiceAIPipeline: VoiceAIPipelineService;
  private _twilioClient: twilio.Twilio | null = null;

  constructor() {
    this.voiceAIPipeline = new VoiceAIPipelineService();
    this.setupEventListeners();
  }

  private get twilioClient(): twilio.Twilio {
    if (!this._twilioClient) {
      const accountSid = process.env.TWILIO_ACCOUNT_SID;
      const authToken = process.env.TWILIO_AUTH_TOKEN;
      
      if (!accountSid || !authToken) {
        throw new Error('TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN environment variables are required');
      }
      
      this._twilioClient = twilio(accountSid, authToken);
    }
    return this._twilioClient;
  }

  private setupEventListeners() {
    // Listen to voice AI pipeline events
    this.voiceAIPipeline.on('session:started', (data) => {
      logger.info(`Voice AI session started: ${data.sessionId} for agent ${data.agentId}`);
    });

    this.voiceAIPipeline.on('session:ended', (data) => {
      logger.info(`Voice AI session ended: ${data.sessionId}`, data.metrics);
    });

    this.voiceAIPipeline.on('session:error', (data) => {
      logger.error(`Voice AI session error: ${data.sessionId}`, data.error);
    });

    this.voiceAIPipeline.on('interaction:completed', (data) => {
      logger.debug(`Voice interaction completed: ${data.sessionId} - ${data.response}`);
    });
  }

  /**
   * Handle incoming phone calls
   * This is the main webhook endpoint for Twilio
   */
  async handleIncomingCall(request: TwilioWebhookRequest, reply: FastifyReply) {
    try {
      const { CallSid, From, To, CallStatus } = request.body;
      
      logger.info(`Incoming call: ${CallSid} from ${From} to ${To}, status: ${CallStatus}`);

      // Find the voice agent associated with this phone number
      const agent = await this.findAgentByPhoneNumber(To);
      
      if (!agent) {
        logger.warn(`No agent found for phone number: ${To}`);
        return this.handleNoAgentResponse(reply);
      }

      // Create call session in database
      const session = await this.createCallSession(CallSid, From, To, agent.id, 'system'); // Use 'system' as fallback company_id

      // Generate TwiML response to connect to LiveKit
      const twiml = await this.generateLiveKitTwiML(agent, session);

      // Start voice AI pipeline
      await this.startVoiceAISession(agent, session);

      return reply
        .header('Content-Type', 'text/xml')
        .send(twiml.toString());

    } catch (error) {
      logger.error('Error handling incoming call:', error);
      return this.handleErrorResponse(reply, error);
    }
  }

  /**
   * Handle call status changes (webhooks)
   */
  async handleCallStatusUpdate(request: TwilioWebhookRequest, reply: FastifyReply) {
    try {
      const { CallSid, CallStatus, CallDuration } = request.body;
      
      logger.info(`Call status update: ${CallSid} - ${CallStatus}`);

      // Map Twilio status to our status enum
      const statusMap: { [key: string]: "active" | "completed" | "failed" | "busy" | "no-answer" } = {
        'initiated': 'active',
        'ringing': 'active', 
        'answered': 'active',
        'in-progress': 'active',
        'completed': 'completed',
        'busy': 'busy',
        'failed': 'failed',
        'no-answer': 'no-answer',
        'canceled': 'failed'
      };

      // Update call session in database
      await supabase.updateCallSession(CallSid, {
        status: statusMap[CallStatus.toLowerCase()] || 'failed',
        duration_seconds: parseInt(CallDuration) || 0
      });

      // Handle session cleanup if call ended
      if (['completed', 'busy', 'failed', 'no-answer', 'canceled'].includes(CallStatus.toLowerCase())) {
        await this.handleCallEnded(CallSid);
      }

      return reply.send('OK');

    } catch (error) {
      logger.error('Error handling call status update:', error);
      return reply.code(500).send('Error');
    }
  }

  /**
   * Handle call recording webhooks
   */
  async handleCallRecording(request: TwilioWebhookRequest, reply: FastifyReply) {
    try {
      const { CallSid, RecordingUrl, RecordingDuration, RecordingSid } = request.body;
      
      logger.info(`Call recording available: ${RecordingSid} for call ${CallSid}`);

      // Store recording information in database
      await supabase.updateCallSession(CallSid, {
        recording_url: RecordingUrl
      });

      return reply.send('OK');

    } catch (error) {
      logger.error('Error handling call recording:', error);
      return reply.code(500).send('Error');
    }
  }

  /**
   * Handle LiveKit audio streams from Twilio
   */
  async handleAudioStream(request: FastifyRequest, reply: FastifyReply) {
    try {
      // This would handle WebSocket connections for real-time audio streaming
      // Implementation depends on your WebSocket setup with Fastify
      
      logger.info('Audio stream connection requested');
      
      return reply.send({
        success: true,
        message: 'Audio streaming endpoint ready'
      });

    } catch (error) {
      logger.error('Error handling audio stream:', error);
      return reply.code(500).send('Error');
    }
  }

  /**
   * Get active call statistics
   */
  async getActiveCallStats(request: FastifyRequest, reply: FastifyReply) {
    try {
      const activeSessions = this.voiceAIPipeline.getActiveSessionsCount();
      const allMetrics = this.voiceAIPipeline.getAllSessionMetrics();

      // Get current active calls from Twilio
      const twilioActiveCalls = await this.twilioClient.calls.list({
        status: 'in-progress',
        limit: 100
      });

      const stats = {
        activeVoiceSessions: activeSessions,
        activeTwilioCalls: twilioActiveCalls.length,
        totalCostToday: allMetrics.reduce((sum, metric) => sum + metric.cost.total, 0),
        averageCallDuration: allMetrics.length > 0 
          ? allMetrics.reduce((sum, metric) => sum + metric.duration, 0) / allMetrics.length / 1000 
          : 0,
        averageResponseTime: allMetrics.length > 0
          ? allMetrics.reduce((sum, metric) => sum + metric.avgResponseTime, 0) / allMetrics.length
          : 0
      };

      return reply.send({
        success: true,
        data: stats
      });

    } catch (error) {
      logger.error('Error getting call stats:', error);
      return reply.code(500).send({
        success: false,
        error: 'Failed to retrieve call statistics'
      });
    }
  }

  /**
   * Initiate outbound call
   */
  async makeOutboundCall(request: FastifyRequest, reply: FastifyReply) {
    try {
      const { to, agentId, companyId } = request.body as any;

      // Get agent details
      const agent = await supabase.getVoiceAgentById(agentId, companyId);
      if (!agent) {
        return reply.code(404).send({
          success: false,
          error: 'Voice agent not found'
        });
      }

      // Get agent's phone number from metadata
      const phoneNumber = agent.metadata?.phoneNumber;
      if (!phoneNumber) {
        return reply.code(400).send({
          success: false,
          error: 'Agent does not have a configured phone number'
        });
      }

      // Make outbound call via Twilio
      const call = await this.twilioClient.calls.create({
        to: to,
        from: phoneNumber,
        url: `${process.env.BASE_URL}/api/v1/twilio/incoming-call`,
        statusCallback: `${process.env.BASE_URL}/api/v1/twilio/call-status`,
        statusCallbackEvent: ['initiated', 'ringing', 'answered', 'completed'],
        record: true,
        recordingStatusCallback: `${process.env.BASE_URL}/api/v1/twilio/recording`
      });

      logger.info(`Outbound call initiated: ${call.sid} from ${phoneNumber} to ${to}`);

      return reply.send({
        success: true,
        data: {
          callSid: call.sid,
          from: phoneNumber,
          to: to,
          status: call.status,
          agentId: agent.id
        }
      });

    } catch (error) {
      logger.error('Error making outbound call:', error);
      return reply.code(500).send({
        success: false,
        error: 'Failed to initiate outbound call'
      });
    }
  }

  /**
   * End an active call
   */
  async endCall(request: FastifyRequest, reply: FastifyReply) {
    try {
      const { callSid } = request.params as any;

      // End the call via Twilio
      const call = await this.twilioClient.calls(callSid).update({
        status: 'completed'
      });

      // Handle cleanup
      await this.handleCallEnded(callSid);

      return reply.send({
        success: true,
        data: {
          callSid: call.sid,
          status: call.status
        }
      });

    } catch (error) {
      logger.error('Error ending call:', error);
      return reply.code(500).send({
        success: false,
        error: 'Failed to end call'
      });
    }
  }

  // Private helper methods

  private async findAgentByPhoneNumber(phoneNumber: string) {
    try {
      // Search for agent with matching phone number in metadata
      const agents = await supabase.getVoiceAgents('system'); // Get all agents for system company
      
      return agents.find(agent => 
        agent.metadata?.phoneNumber === phoneNumber ||
        agent.metadata?.twilioPhoneNumber === phoneNumber
      );
    } catch (error) {
      logger.error('Error finding agent by phone number:', error);
      return null;
    }
  }

  private async createCallSession(callSid: string, from: string, to: string, agentId: string, companyId: string) {
    const session = {
      id: generateSessionId(),
      callSid,
      agentId,
      companyId,
      callerNumber: from,
      agentNumber: to,
      startTime: new Date(),
      status: 'initiated'
    };

    await supabase.createCallSession({
      call_sid: callSid,
      agent_id: agentId,
      from_number: from,
      to_number: to,
      direction: 'inbound'
    }, companyId);

    return session;
  }

  private async generateLiveKitTwiML(agent: any, session: any): Promise<VoiceResponse> {
    const twiml = new VoiceResponse();

    // Generate unique room name for this session
    const roomName = `voice-session-${session.callSid}`;

    // Create a LiveKit token for this session
    const livekitToken = await this.generateLiveKitToken(roomName, session.id);

    // Connect to LiveKit room for real-time audio processing
    const connect = twiml.connect();
    connect.stream({
      url: `wss://${process.env.LIVEKIT_URL}/rtc`
    });

    // Add a greeting message
    twiml.say({
      voice: 'alice',
      language: 'en-US'
    }, `Hello! You've reached ${agent.name}. Please hold on while I connect you.`);

    // Set up recording
    twiml.record({
      action: `/api/v1/twilio/recording`,
      method: 'POST',
      recordingStatusCallback: `/api/v1/twilio/recording`,
      recordingStatusCallbackMethod: 'POST'
    });

    return twiml;
  }

  private async generateLiveKitToken(roomName: string, sessionId: string): Promise<string> {
    try {
      // This would generate a proper LiveKit token
      // For now, return a placeholder
      return `livekit-token-${sessionId}`;
    } catch (error) {
      logger.error('Error generating LiveKit token:', error);
      throw error;
    }
  }

  private async startVoiceAISession(agent: any, session: any) {
    try {
      const config: VoiceAIConfig = {
        agent,
        session,
        livekit: {
          url: process.env.LIVEKIT_URL!,
          apiKey: process.env.LIVEKIT_API_KEY!,
          apiSecret: process.env.LIVEKIT_API_SECRET!,
          roomName: `voice-session-${session.callSid}`
        },
        twilio: {
          accountSid: process.env.TWILIO_ACCOUNT_SID!,
          authToken: process.env.TWILIO_AUTH_TOKEN!,
          phoneNumber: agent.metadata?.phoneNumber
        },
        ai: {
          openaiApiKey: process.env.OPENAI_API_KEY!,
          deepgramApiKey: process.env.DEEPGRAM_API_KEY!,
          model: agent.model || 'gpt-4o-mini',
          voice: agent.voice || 'alloy',
          temperature: 0.7
        }
      };

      await this.voiceAIPipeline.startVoiceSession(config);
      logger.info(`Voice AI session started for call ${session.callSid}`);

    } catch (error) {
      logger.error('Error starting voice AI session:', error);
      throw error;
    }
  }

  private async handleCallEnded(callSid: string) {
    try {
      // For now, just end the voice AI session using the call SID as session ID
      // In a real implementation, you'd maintain proper session mapping
      await this.voiceAIPipeline.endVoiceSession(callSid);
      
      // Update session status
      await supabase.updateCallSession(callSid, {
        status: 'completed',
        end_time: new Date().toISOString()
      });

      logger.info(`Call cleanup completed for ${callSid}`);

    } catch (error) {
      logger.error('Error handling call cleanup:', error);
    }
  }

  private handleNoAgentResponse(reply: FastifyReply) {
    const twiml = new VoiceResponse();
    twiml.say({
      voice: 'alice',
      language: 'en-US'
    }, 'I\'m sorry, but this number is not currently assigned to an agent. Please try again later or contact support.');
    
    twiml.hangup();

    return reply
      .header('Content-Type', 'text/xml')
      .send(twiml.toString());
  }

  private handleErrorResponse(reply: FastifyReply, error: any) {
    const twiml = new VoiceResponse();
    twiml.say({
      voice: 'alice',
      language: 'en-US'
    }, 'I\'m sorry, but we\'re experiencing technical difficulties. Please try again later.');
    
    twiml.hangup();

    logger.error('Error response sent to caller:', error);

    return reply
      .header('Content-Type', 'text/xml')
      .send(twiml.toString());
  }
} 