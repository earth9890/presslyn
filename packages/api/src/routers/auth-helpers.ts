/**
 * Shared authorization helpers for tRPC routers.
 *
 * Extracts the common pattern of checking user capabilities
 * to avoid duplication across all routers.
 */

import { TRPCError } from "@trpc/server";
import type { Context } from "../trpc.js";

/**
 * Require that the current user has a specific capability.
 * Throws FORBIDDEN if the user lacks the capability.
 *
 * Must only be called from protectedProcedure (ctx.userId is non-null).
 */
export async function requireCapability(
  ctx: { userId: number; services: Context["services"] },
  capability: string
): Promise<void> {
  const user = await ctx.services.users.getUserById(ctx.userId);
  if (!ctx.services.users.currentUserCan(user, capability)) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: `You do not have the "${capability}" capability`,
    });
  }
}

/**
 * Check if the current user has a specific capability.
 * Returns true/false without throwing. Useful for conditional logic.
 */
export async function hasCapability(
  ctx: { userId: number | null; services: Context["services"] },
  capability: string
): Promise<boolean> {
  if (!ctx.userId) return false;
  try {
    const user = await ctx.services.users.getUserById(ctx.userId);
    return ctx.services.users.currentUserCan(user, capability);
  } catch {
    return false;
  }
}
