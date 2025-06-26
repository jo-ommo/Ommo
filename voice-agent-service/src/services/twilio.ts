import twilio from 'twilio';
import type { 
  PhoneNumber, 
  CallSession, 
  TwilioCallData, 
  TwilioWebhookRequest,
  VoiceAgentConfig 
} from '../types';
import type { LogContext } from '../utils/logger';

const VoiceResponse = twilio.twiml.VoiceResponse;

export class TwilioService {
  private twilioClient: twilio.Twilio;
  private accountSid: string;
  private authToken: string;
  private baseUrl: string;

  constructor() {
    this.accountSid = process.env.TWILIO_ACCOUNT_SID || '';
    this.authToken = process.env.TWILIO_AUTH_TOKEN || '';
    this.baseUrl = process.env.BASE_URL || 'https://your-domain.com';

    if (!this.accountSid || !this.authToken) {
      throw new Error('TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN environment variables are required');
    }

    this.twilioClient = twilio(this.accountSid, this.authToken);
  }

  public async purchasePhoneNumber(
    tenantId: string,
    agentId: string,
    areaCode?: string,
    country: string = 'US'
  ): Promise<PhoneNumber> {
    try {
      // Search for available phone numbers
      const numbers = await this.twilioClient.availablePhoneNumbers(country)
        .local.list({
          areaCode: areaCode ? parseInt(areaCode) : undefined,
          limit: 1
        });

      if (numbers.length === 0) {
        throw new Error(`No available phone numbers found in area code ${areaCode}`);
      }

      // Purchase the phone number
      const incomingPhoneNumber = await this.twilioClient.incomingPhoneNumbers
        .create({
          phoneNumber: numbers[0].phoneNumber,
          voiceUrl: `${this.baseUrl}/api/v1/twilio/voice`,
          statusCallback: `${this.baseUrl}/api/v1/twilio/status`,
          statusCallbackMethod: 'POST'
        });

      // Create phone number record
      const phoneNumber: PhoneNumber = {
        id: `phone_${Date.now()}`,
        tenantId,
        phoneNumber: incomingPhoneNumber.phoneNumber,
        friendlyName: incomingPhoneNumber.friendlyName || incomingPhoneNumber.phoneNumber,
        agentId,
        twilioSid: incomingPhoneNumber.sid,
        voiceUrl: `${this.baseUrl}/api/v1/twilio/voice`,
        statusCallbackUrl: `${this.baseUrl}/api/v1/twilio/status`,
        active: true,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      return phoneNumber;
    } catch (error) {
      throw new Error(`Failed to purchase phone number: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  public async updatePhoneNumberAgent(
    phoneNumberSid: string,
    agentId: string
  ): Promise<void> {
    try {
      await this.twilioClient.incomingPhoneNumbers(phoneNumberSid)
        .update({
          voiceUrl: `${this.baseUrl}/api/v1/twilio/voice?agentId=${agentId}`,
        });
    } catch (error) {
      throw new Error(`Failed to update phone number agent: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  public generateAnswerTwiML(
    callSid: string,
    agentConfig: VoiceAgentConfig
  ): string {
    const twiml = new VoiceResponse();

    // Say greeting
    const say = twiml.say({
      voice: 'alice' as any,
      language: (agentConfig.language || 'en-US') as any
    }, agentConfig.greeting || 'Hello! How can I help you today?');

    // Start streaming for real-time conversation
    const connect = twiml.connect();
    const stream = connect.stream({
      url: `wss://${this.baseUrl.replace('https://', '').replace('http://', '')}/api/v1/twilio/stream/${callSid}`,
      track: 'both_tracks'
    });

    // Set stream parameters
    stream.parameter({
      name: 'agentId',
      value: agentConfig.id
    });

    stream.parameter({
      name: 'tenantId', 
      value: agentConfig.tenantId
    });

    return twiml.toString();
  }

  public generateGatherTwiML(
    prompt: string,
    action: string,
    method: 'GET' | 'POST' = 'POST',
    timeout: number = 5,
    speechTimeout: number | 'auto' = 'auto'
  ): string {
    const twiml = new VoiceResponse();

    const gather = twiml.gather({
      action,
      method,
      timeout,
      speechTimeout: speechTimeout as any,
      input: ['speech', 'dtmf'],
      speechModel: 'phone_call',
      enhanced: true,
      language: 'en-US'
    });

    gather.say({
      voice: 'alice' as any
    }, prompt);

    // If no input received, repeat the prompt
    twiml.say({
      voice: 'alice' as any
    }, "I didn't hear anything. Let me transfer you to a human agent.");

    twiml.hangup();

    return twiml.toString();
  }

  public generateSayTwiML(
    message: string,
    voice: string = 'alice',
    language: string = 'en-US'
  ): string {
    const twiml = new VoiceResponse();
    
    twiml.say({
      voice: voice as any,
      language: language as any
    }, message);

    return twiml.toString();
  }

  public generateHangupTwiML(
    message?: string
  ): string {
    const twiml = new VoiceResponse();
    
    if (message) {
      twiml.say({
        voice: 'alice'
      }, message);
    }

    twiml.hangup();
    return twiml.toString();
  }

  public generateTransferTwiML(
    transferNumber: string,
    message?: string
  ): string {
    const twiml = new VoiceResponse();
    
    if (message) {
      twiml.say({
        voice: 'alice'
      }, message);
    }

    twiml.dial(transferNumber);
    return twiml.toString();
  }

  public async getCallDetails(callSid: string): Promise<TwilioCallData> {
    try {
      const call = await this.twilioClient.calls(callSid).fetch();
      
      return {
        callSid: call.sid,
        from: call.from,
        to: call.to,
        callStatus: call.status as any,
        direction: call.direction as 'inbound' | 'outbound',
        accountSid: call.accountSid,
        apiVersion: call.apiVersion || '2010-04-01',
      };
    } catch (error) {
      throw new Error(`Failed to get call details: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  public async endCall(callSid: string): Promise<void> {
    try {
      await this.twilioClient.calls(callSid)
        .update({ status: 'completed' });
    } catch (error) {
      throw new Error(`Failed to end call: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  public async listPhoneNumbers(): Promise<any[]> {
    try {
      return await this.twilioClient.incomingPhoneNumbers.list();
    } catch (error) {
      throw new Error(`Failed to list phone numbers: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  public async releasePhoneNumber(phoneNumberSid: string): Promise<void> {
    try {
      await this.twilioClient.incomingPhoneNumbers(phoneNumberSid).remove();
    } catch (error) {
      throw new Error(`Failed to release phone number: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  public validateWebhookSignature(
    url: string,
    params: Record<string, any>,
    twilioSignature: string
  ): boolean {
    try {
      return twilio.validateRequest(
        this.authToken,
        twilioSignature,
        url,
        params
      );
    } catch (error) {
      return false;
    }
  }

  public async checkConnection(): Promise<boolean> {
    try {
      // Test connection by fetching account info
      await this.twilioClient.api.accounts(this.accountSid).fetch();
      return true;
    } catch (error) {
      return false;
    }
  }

  public async getCallRecordings(callSid: string): Promise<any[]> {
    try {
      return await this.twilioClient.recordings.list({ callSid });
    } catch (error) {
      throw new Error(`Failed to get call recordings: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  public async createConferenceCall(
    participantNumbers: string[],
    agentConfig: VoiceAgentConfig
  ): Promise<string> {
    try {
      // Create conference room
      const conference = await this.twilioClient.conferences.list({
        friendlyName: `agent-conference-${Date.now()}`,
        limit: 1
      });

      const conferenceName = `agent-conference-${Date.now()}`;

      // Call each participant and add to conference
      for (const number of participantNumbers) {
        await this.twilioClient.calls.create({
          to: number,
          from: '+1234567890', // Replace with your Twilio number
          twiml: `<Response><Dial><Conference>${conferenceName}</Conference></Dial></Response>`
        });
      }

      return conferenceName;
    } catch (error) {
      throw new Error(`Failed to create conference call: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
} 