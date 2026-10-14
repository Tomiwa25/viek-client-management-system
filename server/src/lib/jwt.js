import jwt from 'jsonwebtoken';
import { loadEnv } from '../config/env.js';

const env = loadEnv();

/**
 * Sign a short-lived access token (default: 15 minutes)
 */
export function signAccessToken(payload) {
  return jwt.sign(
    {
      sub: payload.id,
      orgId: payload.organizationId,
      role: payload.role,
      email: payload.email,
    },
    env.JWT_SECRET,
    { expiresIn: env.JWT_EXPIRES_IN }
  );
}

/**
 * Verify and decode an access token
 */
export function verifyAccessToken(token) {
  return jwt.verify(token, env.JWT_SECRET);
}
