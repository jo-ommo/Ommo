import type { FastifyRequest, FastifyReply } from 'fastify';
interface AuthenticatedRequest extends FastifyRequest {
    tenantId: string;
    userId: string;
}
interface PurchasePhoneRequest extends AuthenticatedRequest {
    Body: {
        agentId: string;
        areaCode?: string;
        country?: string;
    };
}
interface UpdatePhoneRequest extends AuthenticatedRequest {
    Params: {
        phoneId: string;
    };
    Body: {
        agentId?: string;
        active?: boolean;
    };
}
export declare class PhoneController {
    private twilioService;
    constructor();
    purchasePhoneNumber: (request: PurchasePhoneRequest, reply: FastifyReply) => Promise<void>;
    listPhoneNumbers: (request: AuthenticatedRequest, reply: FastifyReply) => Promise<void>;
    updatePhoneNumber: (request: UpdatePhoneRequest, reply: FastifyReply) => Promise<void>;
    releasePhoneNumber: (request: UpdatePhoneRequest, reply: FastifyReply) => Promise<void>;
}
export {};
//# sourceMappingURL=phoneController.d.ts.map