import type { JWTPayload } from '../types';
export declare class JWTError extends Error {
    code: string;
    constructor(message: string, code: string);
}
export declare const validateJWTPayload: (payload: unknown) => JWTPayload;
export declare const extractTenantId: (payload: JWTPayload) => string;
export declare const extractUserId: (payload: JWTPayload) => string;
export declare const isTokenExpired: (payload: JWTPayload) => boolean;
export declare const validateTokenTiming: (payload: JWTPayload) => void;
export declare const createTenantContext: (payload: JWTPayload) => {
    tenantId: string;
    userId: string;
    companyId: string;
};
//# sourceMappingURL=jwt.d.ts.map