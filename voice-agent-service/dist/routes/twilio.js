"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.twilioRoutes = twilioRoutes;
const twilio_1 = require("../services/twilio");
const phoneController_1 = require("../controllers/phoneController");
const supabase_1 = require("../services/supabase");
const asr_1 = require("../services/asr");
const llm_1 = require("../services/llm");
const tts_1 = require("../services/tts");
const logger_1 = require("../utils/logger");
async function twilioRoutes(fastify) {
    const twilioService = new twilio_1.TwilioService();
    const supabaseService = new supabase_1.SupabaseService();
    const phoneController = new phoneController_1.PhoneController();
    const asrService = new asr_1.ASRService();
    const llmService = new llm_1.LLMService();
    const ttsService = new tts_1.TTSService();
    const activeStreams = new Map();
    fastify.post('/voice', async (request, reply) => {
        const logger = (0, logger_1.createContextualLogger)({
            requestId: `voice_${Date.now()}`
        });
        try {
            const webhookData = request.body;
            const { callSid, from, to, callStatus } = webhookData;
            logger.info({
                callSid,
                from,
                to,
                callStatus
            }, 'Incoming voice call');
            const mockAgentConfig = {
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
            const callSession = await supabaseService.createCallSession({
                callSid,
                phoneNumberId: to,
                agentId: mockAgentConfig.id,
                fromNumber: from,
                toNumber: to
            }, 1, {
                tenantId: mockAgentConfig.tenantId,
                requestId: `voice_${Date.now()}`
            });
            const twiml = twilioService.generateAnswerTwiML(callSid, mockAgentConfig);
            (0, logger_1.logVoiceInteraction)({ tenantId: mockAgentConfig.tenantId, sessionId: callSession.id }, 'call_started', { from, to, agentId: mockAgentConfig.id });
            reply.type('text/xml').send(twiml);
        }
        catch (error) {
            logger.error(error, 'Error handling voice webhook');
            const errorTwiml = twilioService.generateSayTwiML('I apologize, but I am experiencing technical difficulties. Please try calling again later.');
            reply.type('text/xml').send(errorTwiml);
        }
    });
    fastify.post('/status', async (request, reply) => {
        const logger = (0, logger_1.createContextualLogger)({
            requestId: `status_${Date.now()}`
        });
        try {
            const webhookData = request.body;
            const { callSid, callStatus } = webhookData;
            logger.info({ callSid, callStatus }, 'Call status update');
            if (callStatus === 'completed' || callStatus === 'failed' || callStatus === 'canceled') {
                const endTime = new Date();
                const status = callStatus === 'completed' ? 'completed' : 'failed';
                await supabaseService.updateCallSession(callSid, {
                    endTime,
                    status
                }, 1, {
                    tenantId: '1',
                    requestId: `status_${Date.now()}`
                });
                (0, logger_1.logVoiceInteraction)({ tenantId: '1', sessionId: callSid }, 'call_ended', {
                    status: callStatus
                });
                activeStreams.delete(callSid);
                logger.info({ callSid }, 'Call session completed');
            }
            reply.send('OK');
        }
        catch (error) {
            logger.error(error, 'Error handling status webhook');
            reply.send('OK');
        }
    });
    fastify.register(async function (fastify) {
        fastify.get('/stream/:callSid', { websocket: true }, async (connection, request) => {
            const params = request.params;
            const { callSid } = params;
            const logger = (0, logger_1.createContextualLogger)({
                tenantId: '1',
                requestId: `stream_${Date.now()}`
            });
            let dgConnection = null;
            let conversationHistory = [];
            try {
                logger.info({ callSid }, 'Media stream connected');
                const mockAgentConfig = {
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
                dgConnection = asrService.createLiveConnection({ tenantId: '1', sessionId: callSid }, async (transcriptionResult) => {
                    try {
                        await supabaseService.addCallTranscript(callSid, {
                            speaker: 'user',
                            text: transcriptionResult.text,
                            confidence: transcriptionResult.confidence
                        }, {
                            tenantId: '1',
                            sessionId: callSid,
                            requestId: `transcript_${Date.now()}`
                        });
                        logger.info({
                            callSid,
                            text: transcriptionResult.text,
                            confidence: transcriptionResult.confidence,
                            isFinal: transcriptionResult.isFinal
                        }, 'Transcription received');
                        if (transcriptionResult.isFinal && transcriptionResult.text.trim()) {
                            await processUserMessage(transcriptionResult.text, callSid, mockAgentConfig);
                        }
                    }
                    catch (error) {
                        logger.error(error, 'Error processing transcription');
                    }
                });
                activeStreams.set(callSid, { dgConnection, logger });
                const processUserMessage = async (text, sessionId, agentConfig) => {
                    try {
                        const llmResponse = await llmService.generateResponse(text, agentConfig, { tenantId: '1', sessionId }, conversationHistory);
                        conversationHistory.push({ role: 'user', content: text }, { role: 'assistant', content: llmResponse.text });
                        if (conversationHistory.length > 20) {
                            conversationHistory = conversationHistory.slice(-20);
                        }
                        await supabaseService.addCallTranscript(sessionId, {
                            speaker: 'agent',
                            text: llmResponse.text,
                            confidence: 1.0
                        }, {
                            tenantId: '1',
                            sessionId,
                            requestId: `agent_transcript_${Date.now()}`
                        });
                        const ttsResponse = await ttsService.synthesizeSpeech(llmResponse.text, { tenantId: '1', sessionId }, { voice: agentConfig.voice, language: agentConfig.language });
                        logger.info({
                            callSid,
                            responseText: llmResponse.text,
                            audioSize: ttsResponse.audioData.length
                        }, 'Generated agent response');
                    }
                    catch (error) {
                        logger.error(error, 'Error processing user message');
                    }
                };
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
                    }
                    catch (error) {
                        logger.error(error, 'Error processing media stream message');
                    }
                });
                connection.socket.on('close', () => {
                    logger.info({ callSid }, 'Media stream disconnected');
                    if (dgConnection) {
                        try {
                            dgConnection.finish();
                        }
                        catch (error) {
                            logger.error(error, 'Error closing Deepgram connection');
                        }
                    }
                    activeStreams.delete(callSid);
                });
            }
            catch (error) {
                logger.error(error, 'Error setting up media stream');
                connection.socket.close();
            }
        });
    });
    fastify.get('/analytics/calls', {
        preHandler: [fastify.authenticate]
    }, async (request, reply) => {
        try {
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
        }
        catch (error) {
            reply.code(500).send({
                success: false,
                error: 'Failed to retrieve analytics'
            });
        }
    });
    fastify.get('/calls/:callSid/transcripts', {
        preHandler: [fastify.authenticate]
    }, async (request, reply) => {
        try {
            const { callSid } = request.params;
            const mockTranscripts = [];
            reply.send({
                success: true,
                data: {
                    callSid,
                    transcripts: mockTranscripts
                }
            });
        }
        catch (error) {
            reply.code(500).send({
                success: false,
                error: 'Failed to retrieve transcripts'
            });
        }
    });
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
                    deepgram: 'unknown',
                    openai: 'unknown',
                    cartesia: 'unknown'
                }
            };
            const allHealthy = Object.values(health.services).every(status => status === 'connected' || status === 'unknown');
            reply.code(allHealthy ? 200 : 503).send(health);
        }
        catch (error) {
            reply.code(503).send({
                status: 'unhealthy',
                timestamp: Date.now(),
                error: error instanceof Error ? error.message : 'Unknown error'
            });
        }
    });
}
//# sourceMappingURL=twilio.js.map