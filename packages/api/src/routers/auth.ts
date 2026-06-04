/**
 * Auth Router
 *
 * Handles login, logout, current user, and password changes.
 */

import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { LoginSchema, verifyPassword } from "@presslyn/core";
import { users } from "@presslyn/database";
import { eq } from "drizzle-orm";
import { router, publicProcedure, protectedProcedure } from "../trpc.js";
import { handleServiceCall } from "./errors.js";

export const authRouter = router({
  /**
   * Login with email/username and password.
   * Returns the user, a session token, and the token expiry.
   */
  login: publicProcedure
    .input(LoginSchema)
    .mutation(async ({ ctx, input }) => {
      return handleServiceCall(() =>
        ctx.services.users.authenticate(input.login, input.password)
      );
    }),

  /**
   * Logout — invalidate the given session token.
   */
  logout: protectedProcedure
    .input(z.object({ token: z.string().min(1) }).strict())
    .mutation(async ({ ctx, input }) => {
      return handleServiceCall(() =>
        ctx.services.users.logout(input.token)
      );
    }),

  /**
   * Get the currently authenticated user.
   */
  me: protectedProcedure.query(async ({ ctx }) => {
    return handleServiceCall(() =>
      ctx.services.users.getUserById(ctx.userId)
    );
  }),

  /**
   * Change the current user's password.
   * Requires the current password for verification.
   * Invalidates all existing sessions.
   */
  changePassword: protectedProcedure
    .input(
      z.object({
        currentPassword: z.string().min(1),
        newPassword: z.string().min(8).max(128),
      }).strict()
    )
    .mutation(async ({ ctx, input }) => {
      // Fetch the stored password hash directly from the database
      const [row] = await ctx.db
        .select({ passwordHash: users.passwordHash })
        .from(users)
        .where(eq(users.id, ctx.userId))
        .limit(1);

      if (!row) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "User not found",
        });
      }

      // Verify the current password before allowing the change
      const isValid = await verifyPassword(input.currentPassword, row.passwordHash);
      if (!isValid) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Current password is incorrect",
        });
      }

      return handleServiceCall(() =>
        ctx.services.users.changePassword(ctx.userId, input.newPassword)
      );
    }),
});
