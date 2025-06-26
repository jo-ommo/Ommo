"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const fastify_1 = __importDefault(require("fastify"));
const cors_1 = __importDefault(require("@fastify/cors"));
const helmet_1 = __importDefault(require("@fastify/helmet"));
const jwt_1 = __importDefault(require("@fastify/jwt"));
const websocket_1 = __importDefault(require("@fastify/websocket"));
const dotenv_1 = require("dotenv");
const logger_1 = require("./utils/logger");
const jwt_2 = require("./utils/jwt");
// Load environment variables
(0, dotenv_1.config)();
// Create Fastify instance
const fastify = (0, fastify_1.default)({
    logger: logger_1.logger,
    trustProxy: true
});
// Setup function to handle async operations
async function setup() {
    // Register security plugins
    await fastify.register(helmet_1.default, {
        contentSecurityPolicy: false,
        crossOriginEmbedderPolicy: false
    });
    await fastify.register(cors_1.default, {
        origin: true,
        credentials: true,
        methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
        allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
    });
    // Register JWT plugin with enhanced configuration
    await fastify.register(jwt_1.default, {
        secret: process.env['JWT_SECRET'] || 'fallback-secret-key',
        verify: {
            extractToken: (request) => {
                // Support multiple token formats
                const authHeader = request.headers.authorization;
                if (authHeader && authHeader.startsWith('Bearer ')) {
                    return authHeader.substring(7);
                }
                // Also check query parameter for WebSocket connections
                return request.query?.token;
            }
        }
    });
    // Register WebSocket support
    await fastify.register(websocket_1.default, {
        options: {
            maxPayload: 1048576, // 1MB
            verifyClient: (info) => {
                // Additional WebSocket verification can be added here
                return true;
            }
        }
    });
    // Enhanced JWT Authentication decorator with better error handling
    fastify.decorate('authenticate', async function (request, reply) {
        try {
            await request.jwtVerify();
            // Validate JWT payload structure
            const payload = (0, jwt_2.validateJWTPayload)(request.user);
            // Add tenant context to request
            request.tenantId = (0, jwt_2.extractTenantId)(payload);
            request.userId = payload.user_id;
            request.companyId = payload.company_id;
        }
        catch (err) {
            if (err instanceof jwt_2.JWTError) {
                reply.code(401).send({
                    error: 'Authentication failed',
                    code: err.code,
                    message: err.message,
                    timestamp: Date.now()
                });
            }
            else {
                reply.code(401).send({
                    error: 'Invalid token',
                    code: 'INVALID_TOKEN',
                    timestamp: Date.now()
                });
            }
        }
    });
    // WebSocket authentication helper
    fastify.decorate('authenticateWS', async function (connection, request) {
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
            const payload = (0, jwt_2.validateJWTPayload)(decoded);
            return {
                tenantId: (0, jwt_2.extractTenantId)(payload),
                userId: payload.user_id,
                companyId: payload.company_id,
                payload
            };
        }
        catch (error) {
            connection.socket.close(1008, 'Authentication failed');
            throw error;
        }
    });
    // Register routes
    const { coreRoutes } = await Promise.resolve().then(() => __importStar(require('./routes/core')));
    await fastify.register(coreRoutes, { prefix: '/api/v1' });
    // TODO: Add back Twilio routes after fixing compilation issues
    // const { twilioRoutes } = await import('./routes/twilio');
    // await fastify.register(twilioRoutes, { prefix: '/api/v1/twilio' });
    // Enhanced error handler
    fastify.setErrorHandler((error, request, reply) => {
        // Log error with request context
        logger_1.logger.error({
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
const gracefulShutdown = async (signal) => {
    try {
        logger_1.logger.info({ signal }, 'Received shutdown signal, shutting down gracefully...');
        // Close server and wait for existing connections to finish
        await fastify.close();
        logger_1.logger.info('Server closed successfully');
        process.exit(0);
    }
    catch (error) {
        logger_1.logger.error(error, 'Error during shutdown');
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
        logger_1.logger.info({
            host,
            port,
            environment: process.env.NODE_ENV || 'development',
            pid: process.pid
        }, 'Voice agent service started successfully');
    }
    catch (error) {
        logger_1.logger.error(error, 'Failed to start server');
        process.exit(1);
    }
};
// Enhanced uncaught exception handling
process.on('uncaughtException', (error) => {
    logger_1.logger.error({ error: error.message, stack: error.stack }, 'Uncaught exception');
    process.exit(1);
});
process.on('unhandledRejection', (reason, promise) => {
    logger_1.logger.error({ reason, promise }, 'Unhandled rejection');
    process.exit(1);
});
start();
//# sourceMappingURL=server.js.map