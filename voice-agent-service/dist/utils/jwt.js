"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createTenantContext = exports.validateTokenTiming = exports.isTokenExpired = exports.extractUserId = exports.extractTenantId = exports.validateJWTPayload = exports.JWTError = void 0;
const zod_1 = require("zod");
// Zod schema for JWT payload validation
const JWTPayloadSchema = zod_1.z.object({
    sub: zod_1.z.string(),
    company_id: zod_1.z.string(),
    tenant_id: zod_1.z.string(),
    user_id: zod_1.z.string(),
    exp: zod_1.z.number(),
    iat: zod_1.z.number(),
    iss: zod_1.z.string(),
    aud: zod_1.z.string()
});
class JWTError extends Error {
    constructor(message, code) {
        super(message);
        this.code = code;
        this.name = 'JWTError';
    }
}
exports.JWTError = JWTError;
const validateJWTPayload = (payload) => {
    try {
        return JWTPayloadSchema.parse(payload);
    }
    catch (error) {
        throw new JWTError('Invalid JWT payload structure', 'INVALID_PAYLOAD');
    }
};
exports.validateJWTPayload = validateJWTPayload;
const extractTenantId = (payload) => {
    if (!payload.tenant_id) {
        throw new JWTError('Missing tenant_id in JWT payload', 'MISSING_TENANT_ID');
    }
    return payload.tenant_id;
};
exports.extractTenantId = extractTenantId;
const extractUserId = (payload) => {
    if (!payload.user_id) {
        throw new JWTError('Missing user_id in JWT payload', 'MISSING_USER_ID');
    }
    return payload.user_id;
};
exports.extractUserId = extractUserId;
const isTokenExpired = (payload) => {
    const now = Math.floor(Date.now() / 1000);
    return payload.exp < now;
};
exports.isTokenExpired = isTokenExpired;
const validateTokenTiming = (payload) => {
    const now = Math.floor(Date.now() / 1000);
    // Check if token is expired
    if (payload.exp < now) {
        throw new JWTError('Token has expired', 'TOKEN_EXPIRED');
    }
    // Check if token is not yet valid (future issued time)
    if (payload.iat > now + 60) { // Allow 60 seconds clock skew
        throw new JWTError('Token not yet valid', 'TOKEN_NOT_YET_VALID');
    }
};
exports.validateTokenTiming = validateTokenTiming;
const createTenantContext = (payload) => {
    return {
        tenantId: payload.tenant_id,
        userId: payload.user_id,
        companyId: payload.company_id
    };
};
exports.createTenantContext = createTenantContext;
//# sourceMappingURL=jwt.js.map