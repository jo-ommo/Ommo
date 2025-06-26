"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.logSessionEvent = exports.logError = exports.createContextualLogger = exports.logger = void 0;
exports.logVoiceInteraction = logVoiceInteraction;
const pino_1 = __importDefault(require("pino"));
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
exports.logger = (0, pino_1.default)({
    level: logLevel,
    transport: transportConfig,
    formatters: {
        level: (label) => {
            return { level: label };
        }
    },
    timestamp: pino_1.default.stdTimeFunctions.isoTime,
    base: {
        service: 'ommo-voice-agent'
    }
});
const createContextualLogger = (context) => {
    return exports.logger.child(context);
};
exports.createContextualLogger = createContextualLogger;
function logVoiceInteraction(context, interactionType, data) {
    const contextLogger = (0, exports.createContextualLogger)(context);
    contextLogger.info({
        interaction_type: interactionType,
        timestamp: new Date().toISOString(),
        ...data
    }, `Voice interaction: ${interactionType}`);
}
const logError = (context, error, additionalData) => {
    const contextLogger = (0, exports.createContextualLogger)(context);
    contextLogger.error({
        error: error.message,
        stack: error.stack,
        timestamp: new Date().toISOString(),
        ...additionalData
    }, `Error occurred: ${error.message}`);
};
exports.logError = logError;
const logSessionEvent = (context, event, data) => {
    const contextLogger = (0, exports.createContextualLogger)(context);
    contextLogger.info({
        event_type: event,
        timestamp: new Date().toISOString(),
        ...data
    }, `Session event: ${event}`);
};
exports.logSessionEvent = logSessionEvent;
//# sourceMappingURL=logger.js.map