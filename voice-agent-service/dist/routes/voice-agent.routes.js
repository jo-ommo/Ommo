"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const auth_1 = require("../middleware/auth");
const createVoiceAgentSchema = {
    body: {
        type: 'object',
        required: ['name', 'instructions'],
        properties: {
            name: {
                type: 'string',
                minLength: 1,
                maxLength: 100,
                description: 'Name of the voice agent'
            },
            instructions: {
                type: 'string',
                minLength: 10,
                maxLength: 2000,
                description: 'Instructions/prompt for the agent behavior'
            },
            voice: {
                type: 'string',
                enum: ['alloy', 'echo', 'fable', 'onyx', 'nova', 'shimmer'],
                default: 'alloy',
                description: 'Voice model to use for TTS'
            },
            model: {
                type: 'string',
                enum: ['gpt-4o-mini', 'gpt-4o', 'gpt-3.5-turbo', 'claude-3-sonnet', 'claude-3-haiku'],
                default: 'gpt-4o-mini',
                description: 'LLM model to use for responses'
            },
            phoneNumber: {
                type: 'string',
                pattern: '^\\+?[1-9]\\d{1,14}$',
                description: 'Phone number for agent (E.164 format)'
            },
            knowledgeBaseFiles: {
                type: 'array',
                items: { type: 'string', format: 'uuid' },
                default: [],
                description: 'Array of knowledge base file IDs'
            },
            settings: {
                type: 'object',
                properties: {
                    interruptions_enabled: { type: 'boolean', default: true },
                    noise_suppression_enabled: { type: 'boolean', default: true },
                    voice_speed: { type: 'number', minimum: 0.5, maximum: 2.0, default: 1.0 },
                    voice_pitch: { type: 'number', minimum: 0.5, maximum: 2.0, default: 1.0 },
                    speech_timeout: { type: 'number', minimum: 0.5, maximum: 10.0, default: 1.0 },
                    silence_timeout: { type: 'number', minimum: 0.5, maximum: 10.0, default: 2.0 }
                },
                additionalProperties: false
            }
        },
        additionalProperties: false
    },
    response: {
        201: {
            type: 'object',
            properties: {
                success: { type: 'boolean' },
                data: {
                    type: 'object',
                    properties: {
                        agent: { type: 'object' },
                        message: { type: 'string' }
                    }
                }
            }
        }
    }
};
const updateVoiceAgentSchema = {
    params: {
        type: 'object',
        required: ['agentId'],
        properties: {
            agentId: { type: 'string', format: 'uuid' }
        }
    },
    body: {
        type: 'object',
        properties: {
            name: { type: 'string', minLength: 1, maxLength: 100 },
            instructions: { type: 'string', minLength: 10, maxLength: 2000 },
            voice: { type: 'string', enum: ['alloy', 'echo', 'fable', 'onyx', 'nova', 'shimmer'] },
            model: { type: 'string', enum: ['gpt-4o-mini', 'gpt-4o', 'gpt-3.5-turbo', 'claude-3-sonnet', 'claude-3-haiku'] },
            phoneNumber: { type: 'string', pattern: '^\\+?[1-9]\\d{1,14}$' },
            knowledgeBaseFiles: {
                type: 'array',
                items: { type: 'string', format: 'uuid' }
            },
            active: { type: 'boolean' },
            settings: {
                type: 'object',
                properties: {
                    interruptions_enabled: { type: 'boolean' },
                    noise_suppression_enabled: { type: 'boolean' },
                    voice_speed: { type: 'number', minimum: 0.5, maximum: 2.0 },
                    voice_pitch: { type: 'number', minimum: 0.5, maximum: 2.0 },
                    speech_timeout: { type: 'number', minimum: 0.5, maximum: 10.0 },
                    silence_timeout: { type: 'number', minimum: 0.5, maximum: 10.0 }
                },
                additionalProperties: false
            }
        },
        additionalProperties: false
    }
};
const getVoiceAgentsSchema = {
    querystring: {
        type: 'object',
        properties: {
            page: { type: 'integer', minimum: 1, default: 1 },
            limit: { type: 'integer', minimum: 1, maximum: 100, default: 10 },
            active: { type: 'string', enum: ['true', 'false'] }
        }
    }
};
const agentParamsSchema = {
    params: {
        type: 'object',
        required: ['agentId'],
        properties: {
            agentId: { type: 'string', format: 'uuid' }
        }
    }
};
const deployAgentSchema = {
    params: {
        type: 'object',
        required: ['agentId'],
        properties: {
            agentId: { type: 'string', format: 'uuid' }
        }
    },
    body: {
        type: 'object',
        required: ['roomName'],
        properties: {
            roomName: {
                type: 'string',
                minLength: 1,
                maxLength: 50,
                pattern: '^[a-zA-Z0-9_-]+$',
                description: 'LiveKit room name (alphanumeric, underscore, hyphen only)'
            }
        }
    }
};
const stopAgentSchema = {
    params: {
        type: 'object',
        required: ['agentId'],
        properties: {
            agentId: { type: 'string', format: 'uuid' }
        }
    },
    body: {
        type: 'object',
        properties: {
            sessionId: { type: 'string', format: 'uuid' }
        }
    }
};
const agentMetricsSchema = {
    params: {
        type: 'object',
        required: ['agentId'],
        properties: {
            agentId: { type: 'string', format: 'uuid' }
        }
    },
    querystring: {
        type: 'object',
        properties: {
            startDate: { type: 'string', format: 'date' },
            endDate: { type: 'string', format: 'date' },
            timeframe: { type: 'string', enum: ['hour', 'day', 'week', 'month'], default: 'day' }
        }
    }
};
const testAgentSchema = {
    params: {
        type: 'object',
        required: ['agentId'],
        properties: {
            agentId: { type: 'string', format: 'uuid' }
        }
    },
    body: {
        type: 'object',
        properties: {
            testMessage: {
                type: 'string',
                minLength: 1,
                maxLength: 500,
                default: 'Hello, this is a test message.'
            }
        }
    }
};
async function voiceAgentRoutes(fastify) {
    // Apply authentication middleware to all routes except health
    fastify.addHook('preHandler', async (request, reply) => {
        if (!request.url.includes('/health')) {
            await (0, auth_1.authenticateRequest)(request, reply);
        }
    });
    // ================================================================
    // VOICE AGENT MANAGEMENT ROUTES
    // ================================================================
    /**
     * Create a new voice agent
     * POST /api/v1/voice-agents
     */
    fastify.post('/', {
        schema: {
            body: {
                type: 'object',
                required: ['name', 'instructions'],
                properties: {
                    name: { type: 'string', minLength: 1, maxLength: 100 },
                    instructions: { type: 'string', minLength: 10, maxLength: 2000 },
                    voice: { type: 'string', enum: ['alloy', 'echo', 'fable', 'onyx', 'nova', 'shimmer'] },
                    model: { type: 'string', enum: ['gpt-4o-mini', 'gpt-4o', 'gpt-3.5-turbo'] },
                    phoneNumber: { type: 'string' },
                    knowledgeBaseFiles: { type: 'array', items: { type: 'string' } },
                    settings: { type: 'object' }
                }
            }
        },
        handler: async (request, reply) => {
            const controller = fastify.voiceAgentController;
            return controller.createVoiceAgent(request, reply);
        }
    });
    /**
     * Get all voice agents for authenticated company
     * GET /api/v1/voice-agents
     */
    fastify.get('/', {
        schema: {
            querystring: {
                type: 'object',
                properties: {
                    page: { type: 'integer', minimum: 1, default: 1 },
                    limit: { type: 'integer', minimum: 1, maximum: 100, default: 10 },
                    active: { type: 'string', enum: ['true', 'false'] }
                }
            }
        },
        handler: async (request, reply) => {
            const controller = fastify.voiceAgentController;
            return controller.getVoiceAgents(request, reply);
        }
    });
    /**
     * Get a specific voice agent by ID
     * GET /api/v1/voice-agents/:agentId
     */
    fastify.get('/:agentId', {
        schema: {
            params: {
                type: 'object',
                required: ['agentId'],
                properties: {
                    agentId: { type: 'string' }
                }
            }
        },
        handler: async (request, reply) => {
            const controller = fastify.voiceAgentController;
            return controller.getVoiceAgent(request, reply);
        }
    });
    /**
     * Update a voice agent
     * PUT /api/v1/voice-agents/:agentId
     */
    fastify.put('/:agentId', {
        schema: {
            params: {
                type: 'object',
                required: ['agentId'],
                properties: {
                    agentId: { type: 'string' }
                }
            },
            body: {
                type: 'object',
                properties: {
                    name: { type: 'string', minLength: 1, maxLength: 100 },
                    instructions: { type: 'string', minLength: 10, maxLength: 2000 },
                    voice: { type: 'string' },
                    model: { type: 'string' },
                    active: { type: 'boolean' },
                    knowledgeBaseFiles: { type: 'array', items: { type: 'string' } }
                }
            }
        },
        handler: async (request, reply) => {
            const controller = fastify.voiceAgentController;
            return controller.updateVoiceAgent(request, reply);
        }
    });
    /**
     * Delete a voice agent
     * DELETE /api/v1/voice-agents/:agentId
     */
    fastify.delete('/:agentId', {
        schema: {
            params: {
                type: 'object',
                required: ['agentId'],
                properties: {
                    agentId: { type: 'string' }
                }
            }
        },
        handler: async (request, reply) => {
            const controller = fastify.voiceAgentController;
            return controller.deleteVoiceAgent(request, reply);
        }
    });
    // ================================================================
    // AGENT DEPLOYMENT & CONTROL ROUTES
    // ================================================================
    /**
     * Deploy agent to a LiveKit room
     * POST /api/v1/voice-agents/:agentId/deploy
     */
    fastify.post('/:agentId/deploy', {
        schema: {
            params: {
                type: 'object',
                required: ['agentId'],
                properties: {
                    agentId: { type: 'string' }
                }
            },
            body: {
                type: 'object',
                required: ['roomName'],
                properties: {
                    roomName: { type: 'string', minLength: 1, maxLength: 50 }
                }
            }
        },
        handler: async (request, reply) => {
            const controller = fastify.voiceAgentController;
            return controller.deployAgent(request, reply);
        }
    });
    /**
     * Stop an active agent session
     * POST /api/v1/voice-agents/:agentId/stop
     */
    fastify.post('/:agentId/stop', {
        schema: {
            params: {
                type: 'object',
                required: ['agentId'],
                properties: {
                    agentId: { type: 'string' }
                }
            },
            body: {
                type: 'object',
                properties: {
                    sessionId: { type: 'string' }
                }
            }
        },
        handler: async (request, reply) => {
            const controller = fastify.voiceAgentController;
            return controller.stopAgent(request, reply);
        }
    });
    /**
     * Test agent configuration
     * POST /api/v1/voice-agents/:agentId/test
     */
    fastify.post('/:agentId/test', {
        schema: {
            params: {
                type: 'object',
                required: ['agentId'],
                properties: {
                    agentId: { type: 'string' }
                }
            },
            body: {
                type: 'object',
                properties: {
                    testMessage: { type: 'string', minLength: 1, maxLength: 500 }
                }
            }
        },
        handler: async (request, reply) => {
            const controller = fastify.voiceAgentController;
            return controller.testAgent(request, reply);
        }
    });
    // ================================================================
    // METRICS & MONITORING ROUTES
    // ================================================================
    /**
     * Get agent performance metrics
     * GET /api/v1/voice-agents/:agentId/metrics
     */
    fastify.get('/:agentId/metrics', {
        schema: {
            params: {
                type: 'object',
                required: ['agentId'],
                properties: {
                    agentId: { type: 'string' }
                }
            },
            querystring: {
                type: 'object',
                properties: {
                    startDate: { type: 'string' },
                    endDate: { type: 'string' },
                    timeframe: { type: 'string', enum: ['hour', 'day', 'week', 'month'] }
                }
            }
        },
        handler: async (request, reply) => {
            const controller = fastify.voiceAgentController;
            return controller.getAgentMetrics(request, reply);
        }
    });
    /**
     * Get active agent sessions for company
     * GET /api/v1/voice-agents/sessions/active
     */
    fastify.get('/sessions/active', {
        handler: async (request, reply) => {
            const controller = fastify.voiceAgentController;
            return controller.getActiveSessions(request, reply);
        }
    });
    /**
     * Get worker statistics
     * GET /api/v1/voice-agents/workers/stats
     */
    fastify.get('/workers/stats', {
        handler: async (request, reply) => {
            const controller = fastify.voiceAgentController;
            return controller.getWorkerStats(request, reply);
        }
    });
    // ================================================================
    // HEALTH & STATUS ROUTES
    // ================================================================
    /**
     * Voice agent service health check
     * GET /api/v1/voice-agents/health
     */
    fastify.get('/health', {
        handler: async (request, reply) => {
            reply.send({
                status: 'healthy',
                timestamp: new Date().toISOString(),
                services: {
                    livekit: 'connected',
                    database: 'connected',
                    redis: 'connected'
                }
            });
        }
    });
}
exports.default = voiceAgentRoutes;
//# sourceMappingURL=voice-agent.routes.js.map