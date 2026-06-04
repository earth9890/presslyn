/**
 * JWT Authentication for REST API
 *
 * Issues and verifies JWT tokens for external API consumers.
 */

import jwt from "jsonwebtoken";

const TOKEN_EXPIRY = "14d";
const ALGORITHM = "HS256" as const;

function getSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("JWT_SECRET environment variable is required in production");
    }
    return "presslyn-dev-secret-change-in-production";
  }
  return secret;
}

export interface JwtPayload {
  userId: number;
  iat?: number;
  exp?: number;
}

/**
 * Generate a JWT token for a user. Pinned to HS256.
 */
export function signJwt(userId: number): string {
  return jwt.sign({ userId } satisfies JwtPayload, getSecret(), {
    expiresIn: TOKEN_EXPIRY,
    algorithm: ALGORITHM,
  });
}

/**
 * Verify and decode a JWT token. Only accepts HS256.
 * Returns the payload or null if invalid/expired.
 */
export function verifyJwt(token: string): JwtPayload | null {
  try {
    const payload = jwt.verify(token, getSecret(), {
      algorithms: [ALGORITHM],
    }) as JwtPayload;
    return payload;
  } catch {
    return null;
  }
}

/**
 * Extract Bearer token from Authorization header.
 */
export function extractBearerToken(authHeader: string | undefined): string | null {
  if (!authHeader) return null;
  const parts = authHeader.split(" ");
  if (parts.length !== 2 || parts[0] !== "Bearer") return null;
  return parts[1];
}
