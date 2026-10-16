import crypto from 'node:crypto';
import { promisify } from 'node:util';

const scryptAsync = promisify(crypto.scrypt);

/**
 * Modern secure password hashing using Node.js native crypto scrypt with per-user salt and timing-safe comparison.
 */
export async function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const derivedKey = await scryptAsync(password, salt, 64);
  return `${salt}:${derivedKey.toString('hex')}`;
}

export async function verifyPassword(password, storedHash) {
  const [salt, key] = storedHash.split(':');
  if (!salt || !key) return false;

  const keyBuffer = Buffer.from(key, 'hex');
  const derivedKey = await scryptAsync(password, salt, 64);

  return crypto.timingSafeEqual(keyBuffer, derivedKey);
}

/**
 * Generate a random 6-digit numeric OTP (e.g. "849201")
 */
export function generateOtp() {
  return crypto.randomInt(100000, 999999).toString();
}

/**
 * Generate a cryptographically secure random token (64 hex chars)
 */
export function generateInvitationToken() {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * SHA-256 hash helper for tokens/OTPs before storing in the database
 */
export function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

