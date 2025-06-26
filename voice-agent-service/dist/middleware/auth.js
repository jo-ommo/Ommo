"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.authenticateRequest = authenticateRequest;
exports.requirePermission = requirePermission;
exports.requireAdmin = requireAdmin;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const logger_1 = require("../utils/logger");
async function authenticateRequest(request, reply) {
    try {
        // Skip authentication for health checks
        if (request.url.includes('/health')) {
            return;
        }
        const authHeader = request.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            reply.status(401).send({
                success: false,
                error: 'Missing or invalid authorization header'
            });
            return;
        }
        const token = authHeader.substring(7); // Remove 'Bearer ' prefix
        const jwtSecret = process.env.JWT_SECRET;
        if (!jwtSecret) {
            logger_1.logger.error('JWT_SECRET environment variable not configured');
            reply.status(500).send({
                success: false,
                error: 'Server configuration error'
            });
            return;
        }
        try {
            const decoded = jsonwebtoken_1.default.verify(token, jwtSecret);
            // Extract user information from token
            const user = {
                companyId: decoded.companyId || decoded.company_id,
                userId: decoded.userId || decoded.user_id || decoded.sub,
                role: decoded.role || 'user',
                permissions: decoded.permissions || []
            };
            if (!user.companyId) {
                reply.status(401).send({
                    success: false,
                    error: 'Invalid token: missing company information'
                });
                return;
            }
            // Attach user to request
            request.user = user;
            logger_1.logger.info(`Authenticated request for user ${user.userId} in company ${user.companyId}`);
        }
        catch (jwtError) {
            logger_1.logger.error('JWT verification failed:', jwtError);
            reply.status(401).send({
                success: false,
                error: 'Invalid or expired token'
            });
            return;
        }
    }
    catch (error) {
        logger_1.logger.error('Authentication middleware error:', error);
        reply.status(500).send({
            success: false,
            error: 'Authentication error'
        });
    }
}
/**
 * Middleware to check if user has specific permissions
 */
function requirePermission(permission) {
    return async (request, reply) => {
        const user = request.user;
        if (!user) {
            reply.status(401).send({
                success: false,
                error: 'Authentication required'
            });
            return;
        }
        if (!user.permissions.includes(permission) && user.role !== 'admin') {
            reply.status(403).send({
                success: false,
                error: `Permission denied: ${permission} required`
            });
            return;
        }
    };
}
/**
 * Middleware to check if user has admin role
 */
async function requireAdmin(request, reply) {
    const user = request.user;
    if (!user || user.role !== 'admin') {
        reply.status(403).send({
            success: false,
            error: 'Admin access required'
        });
        return;
    }
}
//# sourceMappingURL=auth.js.map