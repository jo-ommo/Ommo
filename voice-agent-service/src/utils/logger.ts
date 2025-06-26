import pino from 'pino';

const isDevelopment = process.env['NODE_ENV'] === 'development';
const logLevel = process.env['LOG_LEVEL'] || 'info';
const usePretty = process.env['LOG_PRETTY'] === 'true' || isDevelopment;

const transportConfig = usePretty ? {
  target: 'pino-pretty',
  options: {
    colorize: true,
    translateTime: 'SYS:standard',
    ignore: 'pid,hostname'
  }
} : undefined;

export const logger = pino({
  level: logLevel,
  transport: transportConfig,
  formatters: {
    level: (label: string) => {
      return { level: label };
    }
  },
  timestamp: pino.stdTimeFunctions.isoTime,
  base: {
    service: 'ommo-voice-agent'
  }
});

export interface LogContext {
  tenantId?: string;
  userId?: string;
  sessionId?: string;
  agentId?: string;
  requestId?: string;
}

export const createContextualLogger = (context: LogContext) => {
  return logger.child(context);
};

export function logVoiceInteraction(
  context: LogContext,
  interactionType: 'transcription' | 'llm_request' | 'llm_response' | 'tts_request' | 'tts_response' | 'call_started' | 'call_ended',
  data: any
): void {
  const contextLogger = createContextualLogger(context);
  contextLogger.info({
    interaction_type: interactionType,
    timestamp: new Date().toISOString(),
    ...data
  }, `Voice interaction: ${interactionType}`);
}

export const logError = (
  context: LogContext,
  error: Error,
  additionalData?: Record<string, any>
) => {
  const contextLogger = createContextualLogger(context);
  contextLogger.error({
    error: error.message,
    stack: error.stack,
    timestamp: new Date().toISOString(),
    ...additionalData
  }, `Error occurred: ${error.message}`);
};

export const logSessionEvent = (
  context: LogContext,
  event: 'session_start' | 'session_end' | 'session_error',
  data?: Record<string, any>
) => {
  const contextLogger = createContextualLogger(context);
  contextLogger.info({
    event_type: event,
    timestamp: new Date().toISOString(),
    ...data
  }, `Session event: ${event}`);
}; 