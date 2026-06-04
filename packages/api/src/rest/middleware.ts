/**
 * Hono middleware for the Presslyn REST API.
 */

import { createMiddleware } from "hono/factory";
import type { Services } from "../trpc.js";
import { extractBearerToken, verifyJwt } from "./jwt.js";

/** Variables set by middleware, available in handlers via c.get() */
export interface RestEnv {
  Variables: {
    userId: number | null;
    services: Services;
  };
}

/**
 * Auth middleware — extracts JWT from Authorization header,
 * verifies it, and sets userId on the context.
 * Does NOT reject unauthenticated requests — that's up to each handler.
 */
export function authMiddleware(services: Services) {
  return createMiddleware<RestEnv>(async (c, next) => {
    c.set("services", services);

    const token = extractBearerToken(c.req.header("Authorization"));
    if (token) {
      const payload = verifyJwt(token);
      c.set("userId", payload?.userId ?? null);
    } else {
      c.set("userId", null);
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
