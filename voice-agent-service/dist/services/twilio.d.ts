import type { PhoneNumber, TwilioCallData, VoiceAgentConfig } from '../types';
export declare class TwilioService {
    private twilioClient;
    private accountSid;
    private authToken;
    private baseUrl;
    constructor();
    purchasePhoneNumber(tenantId: string, agentId: string, areaCode?: string, country?: string): Promise<PhoneNumber>;
    updatePhoneNumberAgent(phoneNumberSid: string, agentId: string): Promise<void>;
    generateAnswerTwiML(callSid: string, agentConfig: VoiceAgentConfig): string;
    generateGatherTwiML(prompt: string, action: string, method?: 'GET' | 'POST', timeout?: number, speechTimeout?: number | 'auto'): string;
    generateSayTwiML(message: string, voice?: string, language?: string): string;
    generateHangupTwiML(message?: string): string;
    generateTransferTwiML(transferNumber: string, message?: string): string;
    getCallDetails(callSid: string): Promise<TwilioCallData>;
    endCall(callSid: string): Promise<void>;
    listPhoneNumbers(): Promise<any[]>;
    releasePhoneNumber(phoneNumberSid: string): Promise<void>;
    validateWebhookSignature(url: string, params: Record<string, any>, twilioSignature: string): boolean;
    checkConnection(): Promise<boolean>;
    getCallRecordings(callSid: string): Promise<any[]>;
    createConferenceCall(participantNumbers: string[], agentConfig: VoiceAgentConfig): Promise<string>;
}
//# sourceMappingURL=twilio.d.ts.map