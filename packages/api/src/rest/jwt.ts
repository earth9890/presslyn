/**
 * JWT Authentication for REST API
 *
 * Issues and verifies JWT tokens for external API consumers.
 */

import jwt from "jsonwebtoken";

const TOKEN_EXPIRY = "14d";
const ALGORITHM = "HS256" as const;

/** Name of the auth cookie (HttpOnly, set server-side). */
export const SESSION_COOKIE = "presslyn_session";
const COOKIE_MAX_AGE_SECONDS = 14 * 24 * 60 * 60;

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

/** Extract the auth token from a raw Cookie header, or null. */
export function extractTokenFromCookie(cookieHeader: string | undefined): string | null {
  if (!cookieHeader) return null;
  for (const part of cookieHeader.split(";")) {
    const trimmed = part.trim();
    if (trimmed.startsWith(`${SESSION_COOKIE}=`)) {
      // Slice after the first "=" so a value containing "=" isn't truncated.
      return trimmed.slice(SESSION_COOKIE.length + 1) || null;
    }
  }
  return null;
}

/**
 * Build the Set-Cookie value for the session: HttpOnly (not JS-readable, so an
 * XSS can't steal it), SameSite=Lax, and Secure in production. Path-scoped to
 * the whole app so same-origin requests carry it automatically.
 */
export function buildSessionCookie(token: string): string {
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  return `${SESSION_COOKIE}=${token}; Path=/; Max-Age=${COOKIE_MAX_AGE_SECONDS}; HttpOnly; SameSite=Lax${secure}`;
}

/** Build the Set-Cookie value that clears the session (logout). */
export function buildClearSessionCookie(): string {
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  return `${SESSION_COOKIE}=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax${secure}`;
}
