/**
 * Options Router
 *
 * Key-value settings store — get, getAll, update, delete.
 * Most operations require the manage_options capability.
 */

import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, publicProcedure, protectedProcedure } from "../trpc.js";
import { handleServiceCall } from "./errors.js";
import { requireCapability, hasCapability } from "./auth-helpers.js";

/**
 * Options that are safe to read without authentication.
 * All other options require manage_options capability.
 */
const PUBLIC_OPTIONS = new Set([
  "blogname",
  "blogdescription",
  "siteurl",
  "home",
  "date_format",
  "time_format",
  "timezone_string",
  "start_of_week",
  "posts_per_page",
  "permalink_structure",
  "blog_public",
]);

export const optionsRouter = router({
  /**
   * Get a single option by key.
   * Public options are readable by anyone.
   * Non-public options require manage_options capability.
   */
  get: publicProcedure
    .input(z.object({ key: z.string().min(1).max(255) }))
    .query(async ({ ctx, input }) => {
      if (!PUBLIC_OPTIONS.has(input.key)) {
        const canManage = await hasCapability(ctx, "manage_options");
        if (!canManage) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: `Option "${input.key}" is not publicly readable`,
          });
        }
      }
      return handleServiceCall(() =>
        ctx.services.options.getOption(input.key)
      );
    }),

  /**
   * Get all options (requires manage_options capability).
   */
  getAll: protectedProcedure.query(async ({ ctx }) => {
    await requireCapability(ctx, "manage_options");
    return handleServiceCall(() =>
      ctx.services.options.getAllOptions()
    );
  }),

  /**
   * Update or create an option (requires manage_options capability).
   */
  update: protectedProcedure
    .input(
      z.object({
        key: z.string().min(1).max(255),
        value: z.unknown(),
        autoload: z.boolean().optional(),
      }).strict()
    )
    .mutation(async ({ ctx, input }) => {
      await requireCapability(ctx, "manage_options");
      return handleServiceCall(() =>
        ctx.services.options.updateOption(input.key, input.value, input.autoload)
      );
    }),

  /**
   * Delete an option (requires manage_options capability).
   */
  delete: protectedProcedure
    .input(z.object({ key: z.string().min(1).max(255) }))
    .mutation(async ({ ctx, input }) => {
      await requireCapability(ctx, "manage_options");
      return handleServiceCall(() =>
        ctx.services.options.deleteOption(input.key)
      );
    }),
});
