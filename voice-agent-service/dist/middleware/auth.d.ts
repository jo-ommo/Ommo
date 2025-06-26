import { FastifyRequest, FastifyReply } from 'fastify';
export interface AuthenticatedUser {
    companyId: string;
    userId: string;
    role: string;
    permissions: string[];
}
export declare function authenticateRequest(request: FastifyRequest, reply: FastifyReply): Promise<void>;
/**
 * Middleware to check if user has specific permissions
 */
export declare function requirePermission(permission: string): (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
/**
 * Middleware to check if user has admin role
 */
export declare function requireAdmin(request: FastifyRequest, reply: FastifyReply): Promise<void>;
//# sourceMappingURL=auth.d.ts.map