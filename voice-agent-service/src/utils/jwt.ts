import { z } from 'zod';
import type { JWTPayload } from '../types';

// Zod schema for JWT payload validation
const JWTPayloadSchema = z.object({
  sub: z.string(),
  company_id: z.string(),
  tenant_id: z.string(),
  user_id: z.string(),
  exp: z.number(),
  iat: z.number(),
  iss: z.string(),
  aud: z.string()
});

export class JWTError extends Error {
  constructor(message: string, public code: string) {
    super(message);
    this.name = 'JWTError';
  }
}

export const validateJWTPayload = (payload: unknown): JWTPayload => {
  try {
    return JWTPayloadSchema.parse(payload);
  } catch (error) {
    throw new JWTError('Invalid JWT payload structure', 'INVALID_PAYLOAD');
  }
};

export const extractTenantId = (payload: JWTPayload): string => {
  if (!payload.tenant_id) {
    throw new JWTError('Missing tenant_id in JWT payload', 'MISSING_TENANT_ID');
  }
  return payload.tenant_id;
};

export const extractUserId = (payload: JWTPayload): string => {
  if (!payload.user_id) {
    throw new JWTError('Missing user_id in JWT payload', 'MISSING_USER_ID');
  }
  return payload.user_id;
};

export const isTokenExpired = (payload: JWTPayload): boolean => {
  const now = Math.floor(Date.now() / 1000);
  return payload.exp < now;
};

export const validateTokenTiming = (payload: JWTPayload): void => {
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

export const createTenantContext = (payload: JWTPayload) => {
  return {
    tenantId: payload.tenant_id,
    userId: payload.user_id,
    companyId: payload.company_id
  };
}; 