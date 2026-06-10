/**
 * Hono middleware for the Presslyn REST API.
 */

import { createMiddleware } from "hono/factory";
import type { Services } from "../trpc.js";
import { extractBearerToken, extractTokenFromCookie, verifyJwt } from "./jwt.js";

/** Variables set by middleware, available in handlers via c.get() */
export interface RestEnv {
  Variables: {
    userId: number | null;
    /** JWT issued-at (epoch seconds); used to reject tokens older than a password change. */
    tokenIat: number | null;
    services: Services;
  };
}

/**
 * Auth middleware — resolves the JWT from the Authorization header (external
 * API clients) or the HttpOnly session cookie (browser/admin), verifies it,
 * and sets userId on the context. Does NOT reject unauthenticated requests —
 * that's up to each handler.
 */
export function authMiddleware(services: Services) {
  return createMiddleware<RestEnv>(async (c, next) => {
    c.set("services", services);

    const token =
      extractBearerToken(c.req.header("Authorization")) ??
      extractTokenFromCookie(c.req.header("Cookie"));
    if (token) {
      const payload = verifyJwt(token);
      c.set("userId", payload?.userId ?? null);
      c.set("tokenIat", payload?.iat ?? null);
    } else {
      c.set("userId", null);
      c.set("tokenIat", null);
    }

    await next();
  });
}

/**
 * Helper to require authentication in a handler.
 * Returns 401 if not authenticated.
 */
export function requireAuth(c: { get: (key: "userId") => number | null }): number {
  const userId = c.get("userId");
  if (!userId) {
    throw new Error("UNAUTHORIZED");
  }
  return userId;
}
