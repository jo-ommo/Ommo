// Load environment variables FIRST, before any other imports
import { config } from 'dotenv';
config();

import Fastify from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import jwt from '@fastify/jwt';
import websocket from '@fastify/websocket';
import { agentRoutes } from './routes/agents';
import { logger } from './utils/logger';
import { validateJWTPayload, extractTenantId, JWTError } from './utils/jwt';
import { coreRoutes } from './routes/core';
import { twilioPhoneRoutes } from './routes/twilio-phone.routes';

// Create Fastify instance
const fastify = Fastify({
  logger: logger as any,
  trustProxy: true
});

// Setup function to handle async operations
async function setup() {
  // Register security plugins
  await fastify.register(helmet, {
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false
  });

  await fastify.register(cors, {
    origin: true,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
  });

  // Register JWT plugin with enhanced configuration
  await fastify.register(jwt, {
    secret: process.env['JWT_SECRET'] || 'fallback-secret-key',
    verify: {
      extractToken: (request) => {
        // Support multiple token formats
        const authHeader = request.headers.authorization;
        if (authHeader && authHeader.startsWith('Bearer ')) {
          return authHeader.substring(7);
        }
        // Also check query parameter for WebSocket connections
        return (request.query as any)?.token as string;
      }
    }
  });

  // Register WebSocket support
  await fastify.register(websocket, {
    options: {
      maxPayload: 1048576, // 1MB
      verifyClient: (info: any) => {
        // Additional WebSocket verification can be added here
        return true;
      }
    }
  });

  // Enhanced JWT Authentication decorator with better error handling
  fastify.decorate('authenticate', async function (request: any, reply: any) {
    try {
      await request.jwtVerify();
      
      // Validate JWT payload structure
      const payload = validateJWTPayload(request.user);
      
      // Add tenant context to request
      request.tenantId = extractTenantId(payload);
      request.userId = payload.user_id;
      request.companyId = payload.company_id;
      
    } catch (err) {
      if (err instanceof JWTError) {
        reply.code(401).send({ 
          error: 'Authentication failed', 
          code: err.code,
          message: err.message,
          timestamp: Date.now()
        });
      } else {
        reply.code(401).send({ 
          error: 'Invalid token', 
          code: 'INVALID_TOKEN',
          timestamp: Date.now()
        });
      }
    }
  });

  // WebSocket authentication helper
  fastify.decorate('authenticateWS', async function (connection: any, request: any) {
    try {
      // Extract token from query or headers
      const token = request.query?.token || 
                   (request.headers.authorization?.startsWith('Bearer ') 
                     ? request.headers.authorization.substring(7) 
                     : null);

      if (!token) {
        throw new Error('No token provided');
      }

      // Verify token
      const decoded = fastify.jwt.verify(token);
      const payload = validateJWTPayload(decoded);
      
      return {
        tenantId: extractTenantId(payload),
        userId: payload.user_id,
        companyId: payload.company_id,
        payload
      };
    } catch (error) {
      connection.socket.close(1008, 'Authentication failed');
      throw error;
    }
  });

  // Register routes
  await fastify.register(coreRoutes, { prefix: '/api/v1' });

  // Register Twilio phone routes (public webhooks, no auth required)
  await fastify.register(twilioPhoneRoutes, { prefix: '/api/v1' });

  // Add simplified voice agent routes
  const { SimpleVoiceAgentController } = await import('./controllers/simple-voice-agent.controller');
  const simpleController = new SimpleVoiceAgentController();

  // Voice Agent CRUD Routes (with authentication)
  fastify.register(async function voiceAgentRoutes(fastify) {
    // Health check (no auth required)
    fastify.get('/health', async () => {
      return {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        service: 'voice-agents',
        version: '1.0.0',
        features: {
          livekit: 'pending',
          redis: 'pending',
          database: 'connected'
        }
      };
    });

    // CRUD operations (with auth)
    fastify.get('/', {
      preHandler: [(fastify as any).authenticate]
    }, async (request, reply) => {
      return simpleController.getVoiceAgents(request as any, reply);
    });

    fastify.post('/', {
      preHandler: [(fastify as any).authenticate]
    }, async (request, reply) => {
      return simpleController.createVoiceAgent(request as any, reply);
    });

    fastify.get('/:agentId', {
      preHandler: [(fastify as any).authenticate]
    }, async (request, reply) => {
      return simpleController.getVoiceAgent(request as any, reply);
    });

    fastify.put('/:agentId', {
      preHandler: [(fastify as any).authenticate]
    }, async (request, reply) => {
      return simpleController.updateVoiceAgent(request as any, reply);
    });

    fastify.delete('/:agentId', {
      preHandler: [(fastify as any).authenticate]
    }, async (request, reply) => {
      return simpleController.deleteVoiceAgent(request as any, reply);
    });

    // Deployment routes (simplified)
    fastify.post('/:agentId/deploy', {
      preHandler: [(fastify as any).authenticate]
    }, async (request, reply) => {
      return simpleController.deployAgent(request as any, reply);
    });

    fastify.post('/:agentId/stop', {
      preHandler: [(fastify as any).authenticate]
    }, async (request, reply) => {
      return simpleController.stopAgent(request as any, reply);
    });

    fastify.post('/:agentId/test', {
      preHandler: [(fastify as any).authenticate]
    }, async (request, reply) => {
      return simpleController.testAgent(request as any, reply);
    });

    // Metrics and monitoring
    fastify.get('/:agentId/metrics', {
      preHandler: [(fastify as any).authenticate]
    }, async (request, reply) => {
      return simpleController.getAgentMetrics(request as any, reply);
    });

    fastify.get('/sessions/active', {
      preHandler: [(fastify as any).authenticate]
    }, async (request, reply) => {
      return simpleController.getActiveSessions(request as any, reply);
    });

    fastify.get('/workers/stats', {
      preHandler: [(fastify as any).authenticate]
    }, async (request, reply) => {
      return simpleController.getWorkerStats(request as any, reply);
    });

  }, { prefix: '/api/v1/voice-agents' });

  // TODO: Add back Twilio routes after fixing compilation issues
  // const { twilioRoutes } = await import('./routes/twilio');
  // await fastify.register(twilioRoutes, { prefix: '/api/v1/twilio' });

  // Enhanced error handler
  fastify.setErrorHandler((error, request, reply) => {
    // Log error with request context
    logger.error({
      error: {
        message: error.message,
        stack: error.stack,
        code: error.code
      },
      request: {
        method: request.method,
        url: request.url,
        headers: request.headers,
        ip: request.ip
      },
      timestamp: new Date().toISOString()
    }, 'Unhandled error occurred');

    // Don't expose internal errors in production
    const isDevelopment = process.env.NODE_ENV === 'development';
    
    reply.status(error.statusCode || 500).send({
      error: isDevelopment ? error.message : 'Internal Server Error',
      code: error.code || 'INTERNAL_ERROR',
      timestamp: Date.now(),
      ...(isDevelopment && { stack: error.stack })
    });
  });

  // Health check endpoint with service status
  fastify.get('/health', async () => {
    return {
      status: 'healthy',
      timestamp: Date.now(),
      service: 'ommo-voice-agent-service',
      version: '1.0.0',
      environment: process.env.NODE_ENV || 'development',
      uptime: process.uptime()
    };
  });

  // Supabase connection test endpoint
  fastify.get('/test-db', async (request, reply) => {
    try {
      const { supabase } = await import('./services/supabase');
      
      // Test the connection by checking if we can access the database
      const connectionTest = await supabase.checkConnection();
      
      if (connectionTest) {
        return {
          status: 'success',
          message: 'Supabase database connection is working',
          timestamp: new Date().toISOString(),
          details: {
            supabaseUrl: process.env.SUPABASE_URL ? 'Set' : 'Not set',
            supabaseKey: process.env.SUPABASE_ANON_KEY ? 'Set' : 'Not set'
          }
        };
      } else {
        return reply.code(500).send({
          status: 'error',
          message: 'Supabase database connection failed',
          timestamp: new Date().toISOString()
        });
      }
    } catch (error: any) {
      return reply.code(500).send({
        status: 'error',
        message: 'Database connection test failed',
        error: error.message,
        timestamp: new Date().toISOString()
      });
    }
  });

  // Test database query endpoint
  fastify.get('/test-db-query', async (request, reply) => {
    try {
      const { supabase } = await import('./services/supabase');
      
      // Try to get voice agents for system company (this will test table access)
      const agents = await supabase.getVoiceAgents('system');
      
      return {
        status: 'success',
        message: 'Database query test successful',
        timestamp: new Date().toISOString(),
        data: {
          agentsCount: agents.length,
          canQueryDatabase: true,
          tableAccess: 'voice_agents table accessible'
        }
      };
    } catch (error: any) {
      return reply.code(500).send({
        status: 'error',
        message: 'Database query test failed',
        error: error.message,
        timestamp: new Date().toISOString()
      });
    }
  });

  // Test JWT token generation (for development only)
  fastify.post('/generate-test-token', async (request, reply) => {
    if (process.env.NODE_ENV === 'production') {
      return reply.code(403).send({
        error: 'Test token generation is not allowed in production'
      });
    }

    try {
      const payload = {
        user_id: 'test-user-123',
        company_id: 'system', 
        email: 'test@example.com',
        role: 'admin',
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + (24 * 60 * 60) // 24 hours
      };

      const token = await reply.jwtSign(payload);

      return {
        success: true,
        token,
        payload,
        usage: {
          header: `Authorization: Bearer ${token}`,
          expires: new Date((payload.exp) * 1000).toISOString()
        }
      };
    } catch (error: any) {
      return reply.code(500).send({
        success: false,
        error: 'Failed to generate test token',
        message: error.message
      });
    }
  });

  // Simple HTML test interface
  fastify.get('/test-interface', async (request, reply) => {
    const html = `
<!DOCTYPE html>
<html>
<head>
    <title>Voice Agent Test Interface</title>
    <style>
        body { font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px; }
        .section { background: #f5f5f5; padding: 15px; margin: 10px 0; border-radius: 5px; }
        button { background: #007cba; color: white; padding: 10px 20px; border: none; border-radius: 3px; cursor: pointer; }
        button:hover { background: #005a8b; }
        textarea { width: 100%; height: 100px; margin: 10px 0; }
        input { width: 100%; padding: 8px; margin: 5px 0; }
        .response { background: #e8f5e8; padding: 10px; margin: 10px 0; border-radius: 3px; }
        .error { background: #ffe6e6; padding: 10px; margin: 10px 0; border-radius: 3px; }
    </style>
</head>
<body>
    <h1>🎙️ Voice Agent Test Interface</h1>
    
    <div class="section">
        <h3>Step 1: Generate Test Token</h3>
        <button onclick="generateToken()">Generate JWT Token</button>
        <div id="tokenResponse"></div>
    </div>

    <div class="section">
        <h3>Step 2: Create Voice Agent</h3>
        <input type="text" id="agentName" placeholder="Agent Name" value="Test Support Agent">
        <textarea id="systemPrompt" placeholder="System Prompt">You are a helpful customer support agent. Be friendly and concise in your responses.</textarea>
        <button onclick="createAgent()">Create Voice Agent</button>
        <div id="createResponse"></div>
    </div>

    <div class="section">
        <h3>Step 3: List Agents</h3>
        <button onclick="listAgents()">List All Agents</button>
        <div id="listResponse"></div>
    </div>

    <div class="section">
        <h3>Step 4: Test Agent Conversation</h3>
        <input type="text" id="agentId" placeholder="Agent ID (from list above)">
        <textarea id="testMessage" placeholder="Test message">Hello, I need help with my account</textarea>
        <button onclick="testAgent()">Test Agent</button>
        <div id="testResponse"></div>
    </div>

    <script>
        let currentToken = '';

        async function generateToken() {
            try {
                const response = await fetch('/generate-test-token', { method: 'POST' });
                const data = await response.json();
                
                if (data.success) {
                    currentToken = data.token;
                    document.getElementById('tokenResponse').innerHTML = 
                        '<div class="response"><strong>Token Generated!</strong><br>' +
                        'Expires: ' + data.usage.expires + '<br>' +
                        'Token: ' + data.token.substring(0, 50) + '...</div>';
                } else {
                    document.getElementById('tokenResponse').innerHTML = 
                        '<div class="error">Error: ' + data.error + '</div>';
                }
            } catch (error) {
                document.getElementById('tokenResponse').innerHTML = 
                    '<div class="error">Error: ' + error.message + '</div>';
            }
        }

        async function createAgent() {
            if (!currentToken) {
                alert('Please generate a token first');
                return;
            }

            try {
                const response = await fetch('/api/v1/voice-agents', {
                    method: 'POST',
                    headers: {
                        'Authorization': 'Bearer ' + currentToken,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        name: document.getElementById('agentName').value,
                        description: 'Test agent created via interface',
                        model: 'gpt-4o-mini',
                        voice: 'alloy',
                        systemPrompt: document.getElementById('systemPrompt').value,
                        greeting: 'Hello! How can I help you today?',
                        active: true
                    })
                });

                const data = await response.json();
                
                if (response.ok) {
                    document.getElementById('createResponse').innerHTML = 
                        '<div class="response"><strong>Agent Created!</strong><br>' +
                        'ID: ' + data.id + '<br>' +
                        'Name: ' + data.name + '</div>';
                } else {
                    document.getElementById('createResponse').innerHTML = 
                        '<div class="error">Error: ' + JSON.stringify(data) + '</div>';
                }
            } catch (error) {
                document.getElementById('createResponse').innerHTML = 
                    '<div class="error">Error: ' + error.message + '</div>';
            }
        }

        async function listAgents() {
            if (!currentToken) {
                alert('Please generate a token first');
                return;
            }

            try {
                const response = await fetch('/api/v1/voice-agents', {
                    headers: { 'Authorization': 'Bearer ' + currentToken }
                });

                const data = await response.json();
                
                if (response.ok) {
                    let html = '<div class="response"><strong>Voice Agents:</strong><br>';
                    if (data.length > 0) {
                        data.forEach(agent => {
                            html += 'ID: ' + agent.id + ' | Name: ' + agent.name + '<br>';
                        });
                    } else {
                        html += 'No agents found. Create one first!';
                    }
                    html += '</div>';
                    document.getElementById('listResponse').innerHTML = html;
                } else {
                    document.getElementById('listResponse').innerHTML = 
                        '<div class="error">Error: ' + JSON.stringify(data) + '</div>';
                }
            } catch (error) {
                document.getElementById('listResponse').innerHTML = 
                    '<div class="error">Error: ' + error.message + '</div>';
            }
        }

        async function testAgent() {
            if (!currentToken) {
                alert('Please generate a token first');
                return;
            }

            const agentId = document.getElementById('agentId').value;
            if (!agentId) {
                alert('Please enter an Agent ID');
                return;
            }

            try {
                const response = await fetch('/api/v1/voice-agents/' + agentId + '/test', {
                    method: 'POST',
                    headers: {
                        'Authorization': 'Bearer ' + currentToken,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        message: document.getElementById('testMessage').value
                    })
                });

                const data = await response.json();
                
                if (response.ok) {
                    document.getElementById('testResponse').innerHTML = 
                        '<div class="response"><strong>Agent Response:</strong><br>' +
                        JSON.stringify(data, null, 2) + '</div>';
                } else {
                    document.getElementById('testResponse').innerHTML = 
                        '<div class="error">Error: ' + JSON.stringify(data) + '</div>';
                }
            } catch (error) {
                document.getElementById('testResponse').innerHTML = 
                    '<div class="error">Error: ' + error.message + '</div>';
            }
        }
    </script>
</body>
</html>`;

    reply.type('text/html').send(html);
  });

  // API Documentation endpoint
  fastify.get('/docs', async () => {
    return {
      title: 'Ommo Voice Agent Service API',
      version: '1.0.0',
      description: 'Production-grade SaaS Voice AI Pipeline with LiveKit, Twilio, and multi-tenant support',
      baseUrl: 'http://localhost:3000',
      endpoints: {
        health: {
          'GET /health': 'Service health check',
          'GET /ready': 'Service readiness check',
          'GET /api/v1/health': 'Core API health',
          'GET /api/v1/voice-agents/health': 'Voice agents health',
          'GET /api/v1/twilio/health': 'Twilio integration health'
        },
        voiceAgents: {
          'GET /api/v1/voice-agents': 'List voice agents (requires auth)',
          'POST /api/v1/voice-agents': 'Create voice agent (requires auth)',
          'GET /api/v1/voice-agents/:agentId': 'Get voice agent details (requires auth)',
          'PUT /api/v1/voice-agents/:agentId': 'Update voice agent (requires auth)',
          'DELETE /api/v1/voice-agents/:agentId': 'Delete voice agent (requires auth)',
          'POST /api/v1/voice-agents/:agentId/deploy': 'Deploy voice agent (requires auth)',
          'POST /api/v1/voice-agents/:agentId/stop': 'Stop voice agent (requires auth)',
          'POST /api/v1/voice-agents/:agentId/test': 'Test voice agent (requires auth)',
          'GET /api/v1/voice-agents/:agentId/metrics': 'Get agent metrics (requires auth)',
          'GET /api/v1/voice-agents/sessions/active': 'Get active sessions (requires auth)',
          'GET /api/v1/voice-agents/workers/stats': 'Get worker statistics (requires auth)'
        },
        twilioIntegration: {
          'POST /api/v1/twilio/incoming-call': 'Handle incoming calls from Twilio (webhook)',
          'POST /api/v1/twilio/call-status': 'Handle call status updates (webhook)', 
          'POST /api/v1/twilio/recording': 'Handle call recordings (webhook)',
          'POST /api/v1/twilio/audio-stream': 'Handle audio streaming',
          'GET /api/v1/twilio/stats': 'Get call statistics',
          'POST /api/v1/twilio/outbound-call': 'Make outbound call',
          'POST /api/v1/twilio/end-call/:callSid': 'End active call'
        },
        authentication: {
          note: 'Most endpoints require JWT Bearer token in Authorization header',
          format: 'Authorization: Bearer <your-jwt-token>',
          testTokenGeneration: 'POST /api/v1/auth/test-token (for development)'
        }
      },
      examples: {
        createVoiceAgent: {
          method: 'POST',
          url: '/api/v1/voice-agents',
          headers: {
            'Authorization': 'Bearer <your-jwt-token>',
            'Content-Type': 'application/json'
          },
          body: {
            name: 'Customer Support Agent',
            description: 'Helpful customer support agent',
            model: 'gpt-4o-mini',
            voice: 'alloy',
            systemPrompt: 'You are a helpful customer support agent.',
            greeting: 'Hello! How can I help you today?',
            active: true
          }
        },
        twilioWebhook: {
          method: 'POST',
          url: '/api/v1/twilio/incoming-call',
          description: 'This endpoint should be configured in your Twilio phone number webhook settings'
        }
      }
    };
  });

  // API endpoints listing (alternative format)
  fastify.get('/endpoints', async () => {
    const routes: any[] = [];
    
    // Get all registered routes (this is a simplified version)
    return {
      service: 'ommo-voice-agent-service',
      totalEndpoints: 20,
      categories: {
        'Health Checks': [
          'GET /health',
          'GET /ready', 
          'GET /api/v1/health',
          'GET /api/v1/voice-agents/health',
          'GET /api/v1/twilio/health'
        ],
        'Voice Agents (Authenticated)': [
          'GET /api/v1/voice-agents',
          'POST /api/v1/voice-agents', 
          'GET /api/v1/voice-agents/:agentId',
          'PUT /api/v1/voice-agents/:agentId',
          'DELETE /api/v1/voice-agents/:agentId',
          'POST /api/v1/voice-agents/:agentId/deploy',
          'POST /api/v1/voice-agents/:agentId/stop',
          'POST /api/v1/voice-agents/:agentId/test',
          'GET /api/v1/voice-agents/:agentId/metrics',
          'GET /api/v1/voice-agents/sessions/active',
          'GET /api/v1/voice-agents/workers/stats'
        ],
        'Twilio Integration': [
          'POST /api/v1/twilio/incoming-call',
          'POST /api/v1/twilio/call-status',
          'POST /api/v1/twilio/recording',
          'POST /api/v1/twilio/audio-stream',
          'GET /api/v1/twilio/stats',
          'POST /api/v1/twilio/outbound-call',
          'POST /api/v1/twilio/end-call/:callSid'
        ],
        'Documentation': [
          'GET /docs',
          'GET /endpoints'
        ]
      },
      note: 'Visit /docs for detailed API documentation'
    };
  });

  // Readiness check endpoint
  fastify.get('/ready', async () => {
    // Add actual service checks here
    const checks = {
      deepgram: true, // TODO: implement actual health checks
      openai: true,
      cartesia: true,
      livekit: true
    };

    const isReady = Object.values(checks).every(Boolean);

    return {
      ready: isReady,
      checks,
      timestamp: Date.now()
    };
  });
}

// Graceful shutdown with cleanup
const gracefulShutdown = async (signal: string) => {
  try {
    logger.info({ signal }, 'Received shutdown signal, shutting down gracefully...');
    
    // Close server and wait for existing connections to finish
    await fastify.close();
    
    logger.info('Server closed successfully');
    process.exit(0);
  } catch (error) {
    logger.error(error, 'Error during shutdown');
    process.exit(1);
  }
};

// Handle various shutdown signals
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('SIGUSR2', () => gracefulShutdown('SIGUSR2')); // For nodemon

// Start server
const start = async () => {
  try {
    await setup();
    
    const host = process.env['HOST'] || '0.0.0.0';
    const port = parseInt(process.env['PORT'] || '3000', 10);

    await fastify.listen({ host, port });
    
    logger.info({ 
      host, 
      port, 
      environment: process.env.NODE_ENV || 'development',
      pid: process.pid 
    }, 'Voice agent service started successfully');
    
  } catch (error) {
    logger.error(error, 'Failed to start server');
    process.exit(1);
  }
};

// Enhanced uncaught exception handling
process.on('uncaughtException', (error) => {
  logger.error({ error: error.message, stack: error.stack }, 'Uncaught exception');
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error({ reason, promise }, 'Unhandled rejection');
  process.exit(1);
});

start(); 