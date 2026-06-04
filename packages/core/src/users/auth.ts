/**
 * Authentication
 *
 * WordPress equivalent: wp-includes/pluggable.php (wp_authenticate, wp_set_auth_cookie, etc.)
 * Handles password hashing, verification, and session tokens.
 *
 * Uses argon2id (OWASP recommendation) for password hashing.
 * Session tokens use crypto.randomBytes with 48 bytes (384 bits) of entropy.
 */

import argon2 from "argon2";
import { createHash, randomBytes } from "crypto";

/**
 * Hash a password using argon2id.
 * argon2id is resistant to both side-channel and GPU attacks.
 */
export async function hashPassword(password: string): Promise<string> {
  return argon2.hash(password, {
    type: argon2.argon2id,
    memoryCost: 65536, // 64 MB
    timeCost: 3,
    parallelism: 4,
  });
}

/**
 * Verify a password against a stored argon2id hash.
 * argon2.verify is inherently timing-safe.
 */
export async function verifyPassword(
  password: string,
  storedHash: string
): Promise<boolean> {
  try {
    return await argon2.verify(storedHash, password);
  } catch {
    return false;
  }
}

/**
 * Generate a cryptographically secure session token.
 * 48 bytes = 384 bits of entropy.
 */
export function generateSessionToken(): string {
  return randomBytes(48).toString("hex");
}

/**
 * Hash a session token for storage.
 * We store SHA-256 of the token in the database so that a DB leak
 * does not directly expose valid session tokens.
 */
export function hashSessionToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/**
 * Generate a session expiry date.
 * @param daysFromNow Must be positive. Default: 14 days.
 */
export function getSessionExpiry(daysFromNow: number = 14): Date {
  if (daysFromNow <= 0) {
    throw new Error("Session expiry must be a positive number of days");
  }
  const expiry = new Date();
  expiry.setDate(expiry.getDate() + daysFromNow);
  return expiry;
}
