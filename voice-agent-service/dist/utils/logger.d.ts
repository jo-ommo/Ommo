import pino from 'pino';
export declare const logger: import("pino").Logger<never>;
export interface LogContext {
    tenantId?: string;
    userId?: string;
    sessionId?: string;
    agentId?: string;
    requestId?: string;
}
export declare const createContextualLogger: (context: LogContext) => pino.Logger<never>;
export declare function logVoiceInteraction(context: LogContext, interactionType: 'transcription' | 'llm_request' | 'llm_response' | 'tts_request' | 'tts_response' | 'call_started' | 'call_ended', data: any): void;
export declare const logError: (context: LogContext, error: Error, additionalData?: Record<string, any>) => void;
export declare const logSessionEvent: (context: LogContext, event: "session_start" | "session_end" | "session_error", data?: Record<string, any>) => void;
//# sourceMappingURL=logger.d.ts.map