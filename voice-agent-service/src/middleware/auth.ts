import { FastifyRequest, FastifyReply } from 'fastify';
import jwt from 'jsonwebtoken';
import { logger } from '../utils/logger';

export interface AuthenticatedUser {
  companyId: string;
  userId: string;
  role: string;
  permissions: string[];
}

export async function authenticateRequest(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
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
      logger.error('JWT_SECRET environment variable not configured');
      reply.status(500).send({
        success: false,
        error: 'Server configuration error'
      });
      return;
    }

    try {
      const decoded = jwt.verify(token, jwtSecret) as any;
      
      // Extract user information from token
      const user: AuthenticatedUser = {
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
      (request as any).user = user;

      logger.info(`Authenticated request for user ${user.userId} in company ${user.companyId}`);

    } catch (jwtError) {
      logger.error('JWT verification failed:', jwtError);
      reply.status(401).send({
        success: false,
        error: 'Invalid or expired token'
      });
      return;
    }

  } catch (error) {
    logger.error('Authentication middleware error:', error);
    reply.status(500).send({
      success: false,
      error: 'Authentication error'
    });
  }
}

/**
 * Middleware to check if user has specific permissions
 */
export function requirePermission(permission: string) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    const user = (request as any).user as AuthenticatedUser;
    
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
export async function requireAdmin(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  const user = (request as any).user as AuthenticatedUser;
  
  if (!user || user.role !== 'admin') {
    reply.status(403).send({
      success: false,
      error: 'Admin access required'
    });
    return;
  }
} 