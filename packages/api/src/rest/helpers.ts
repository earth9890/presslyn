/**
 * Shared helpers for REST route handlers.
 */

import type { Context as HonoContext } from "hono";
import { ValidationError, ForbiddenError } from "@presslyn/core";
import type { RestEnv } from "./middleware.js";

/**
 * Parse and validate an integer ID from route params.
 * Throws ValidationError (→ 400) for non-numeric or non-positive values.
 */
export function parseId(c: HonoContext<RestEnv>, param: string = "id"): number {
  const raw = c.req.param(param);
  const id = Number(raw);
  if (!Number.isInteger(id) || id <= 0) {
    throw new ValidationError(`Invalid ${param}: "${raw}"`);
  }
  return id;
}

/**
 * Require authentication. Returns userId or throws.
 */
export function requireAuth(c: HonoContext<RestEnv>): number {
  const userId = c.get("userId");
  if (!userId) {
    throw new ForbiddenError("Authentication required");
  }
  return userId;
}

/**
 * Reject a token issued before the user's most recent password change. This is
 * how a password reset/change revokes outstanding stateless JWTs — checked
 * wherever the user record is already loaded (no extra query).
 */
function assertTokenNotRevoked(
  c: HonoContext<RestEnv>,
  user: { meta?: Record<string, unknown> | null }
): void {
  const validAfter = Number((user.meta as Record<string, unknown> | null)?.tokensValidAfter);
  const iat = c.get("tokenIat");
  if (Number.isFinite(validAfter) && typeof iat === "number" && iat < validAfter) {
    throw new ForbiddenError("Session expired — please sign in again");
  }
}

/**
 * Require that the authenticated user has a specific capability.
 * Throws ForbiddenError (→ 403) if not.
 */
export async function requireCap(
  c: HonoContext<RestEnv>,
  capability: string
): Promise<number> {
  const userId = requireAuth(c);
  const services = c.get("services");
  const user = await services.users.getUserById(userId);
  assertTokenNotRevoked(c, user);
  if (!services.users.currentUserCan(user, capability)) {
    throw new ForbiddenError(`Missing capability: ${capability}`);
  }
  return userId;
}

/**
 * Check if authenticated user has a capability (returns boolean, never throws).
 */
export async function hasCap(
  c: HonoContext<RestEnv>,
  capability: string
): Promise<boolean> {
  const userId = c.get("userId");
  if (!userId) return false;
  try {
    const services = c.get("services");
    const user = await services.users.getUserById(userId);
    return services.users.currentUserCan(user, capability);
  } catch {
    return false;
  }
}
