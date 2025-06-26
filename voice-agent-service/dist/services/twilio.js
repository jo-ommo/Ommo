"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.TwilioService = void 0;
const twilio_1 = __importDefault(require("twilio"));
const VoiceResponse = twilio_1.default.twiml.VoiceResponse;
class TwilioService {
    twilioClient;
    accountSid;
    authToken;
    baseUrl;
    constructor() {
        this.accountSid = process.env.TWILIO_ACCOUNT_SID || '';
        this.authToken = process.env.TWILIO_AUTH_TOKEN || '';
        this.baseUrl = process.env.BASE_URL || 'https://your-domain.com';
        if (!this.accountSid || !this.authToken) {
            throw new Error('TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN environment variables are required');
        }
        this.twilioClient = (0, twilio_1.default)(this.accountSid, this.authToken);
    }
    async purchasePhoneNumber(tenantId, agentId, areaCode, country = 'US') {
        try {
            const numbers = await this.twilioClient.availablePhoneNumbers(country)
                .local.list({
                areaCode: areaCode ? parseInt(areaCode) : undefined,
                limit: 1
            });
            if (numbers.length === 0) {
                throw new Error(`No available phone numbers found in area code ${areaCode}`);
            }
            const incomingPhoneNumber = await this.twilioClient.incomingPhoneNumbers
                .create({
                phoneNumber: numbers[0].phoneNumber,
                voiceUrl: `${this.baseUrl}/api/v1/twilio/voice`,
                statusCallback: `${this.baseUrl}/api/v1/twilio/status`,
                statusCallbackMethod: 'POST'
            });
            const phoneNumber = {
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
        }
        catch (error) {
            throw new Error(`Failed to purchase phone number: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }
    async updatePhoneNumberAgent(phoneNumberSid, agentId) {
        try {
            await this.twilioClient.incomingPhoneNumbers(phoneNumberSid)
                .update({
                voiceUrl: `${this.baseUrl}/api/v1/twilio/voice?agentId=${agentId}`,
            });
        }
        catch (error) {
            throw new Error(`Failed to update phone number agent: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }
    generateAnswerTwiML(callSid, agentConfig) {
        const twiml = new VoiceResponse();
        const say = twiml.say({
            voice: 'alice',
            language: (agentConfig.language || 'en-US')
        }, agentConfig.greeting || 'Hello! How can I help you today?');
        const connect = twiml.connect();
        const stream = connect.stream({
            url: `wss://${this.baseUrl.replace('https://', '').replace('http://', '')}/api/v1/twilio/stream/${callSid}`,
            track: 'both_tracks'
        });
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
    generateGatherTwiML(prompt, action, method = 'POST', timeout = 5, speechTimeout = 'auto') {
        const twiml = new VoiceResponse();
        const gather = twiml.gather({
            action,
            method,
            timeout,
            speechTimeout: speechTimeout,
            input: ['speech', 'dtmf'],
            speechModel: 'phone_call',
            enhanced: true,
            language: 'en-US'
        });
        gather.say({
            voice: 'alice'
        }, prompt);
        twiml.say({
            voice: 'alice'
        }, "I didn't hear anything. Let me transfer you to a human agent.");
        twiml.hangup();
        return twiml.toString();
    }
    generateSayTwiML(message, voice = 'alice', language = 'en-US') {
        const twiml = new VoiceResponse();
        twiml.say({
            voice: voice,
            language: language
        }, message);
        return twiml.toString();
    }
    generateHangupTwiML(message) {
        const twiml = new VoiceResponse();
        if (message) {
            twiml.say({
                voice: 'alice'
            }, message);
        }
        twiml.hangup();
        return twiml.toString();
    }
    generateTransferTwiML(transferNumber, message) {
        const twiml = new VoiceResponse();
        if (message) {
            twiml.say({
                voice: 'alice'
            }, message);
        }
        twiml.dial(transferNumber);
        return twiml.toString();
    }
    async getCallDetails(callSid) {
        try {
            const call = await this.twilioClient.calls(callSid).fetch();
            return {
                callSid: call.sid,
                from: call.from,
                to: call.to,
                callStatus: call.status,
                direction: call.direction,
                accountSid: call.accountSid,
                apiVersion: call.apiVersion || '2010-04-01',
            };
        }
        catch (error) {
            throw new Error(`Failed to get call details: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }
    async endCall(callSid) {
        try {
            await this.twilioClient.calls(callSid)
                .update({ status: 'completed' });
        }
        catch (error) {
            throw new Error(`Failed to end call: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }
    async listPhoneNumbers() {
        try {
            return await this.twilioClient.incomingPhoneNumbers.list();
        }
        catch (error) {
            throw new Error(`Failed to list phone numbers: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }
    async releasePhoneNumber(phoneNumberSid) {
        try {
            await this.twilioClient.incomingPhoneNumbers(phoneNumberSid).remove();
        }
        catch (error) {
            throw new Error(`Failed to release phone number: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }
    validateWebhookSignature(url, params, twilioSignature) {
        try {
            return twilio_1.default.validateRequest(this.authToken, twilioSignature, url, params);
        }
        catch (error) {
            return false;
        }
    }
    async checkConnection() {
        try {
            await this.twilioClient.api.accounts(this.accountSid).fetch();
            return true;
        }
        catch (error) {
            return false;
        }
    }
    async getCallRecordings(callSid) {
        try {
            return await this.twilioClient.recordings.list({ callSid });
        }
        catch (error) {
            throw new Error(`Failed to get call recordings: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }
    async createConferenceCall(participantNumbers, agentConfig) {
        try {
            const conference = await this.twilioClient.conferences.list({
                friendlyName: `agent-conference-${Date.now()}`,
                limit: 1
            });
            const conferenceName = `agent-conference-${Date.now()}`;
            for (const number of participantNumbers) {
                await this.twilioClient.calls.create({
                    to: number,
                    from: '+1234567890',
                    twiml: `<Response><Dial><Conference>${conferenceName}</Conference></Dial></Response>`
                });
            }
            return conferenceName;
        }
        catch (error) {
            throw new Error(`Failed to create conference call: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }
}
exports.TwilioService = TwilioService;
//# sourceMappingURL=twilio.js.map