/**
 * Media Router
 *
 * Media library — query, get, update, delete.
 * Note: File upload is handled via Hono REST route since tRPC
 * doesn't handle multipart file uploads well.
 */

import { z } from "zod";
import { router, publicProcedure, protectedProcedure } from "../trpc.js";
import { handleServiceCall } from "./errors.js";
import { requireCapability } from "./auth-helpers.js";

const MediaQueryInput = z
  .object({
    mimeType: z.string().max(100).optional(),
    search: z.string().max(200).optional(),
    orderBy: z.enum(["id", "date", "title"]).optional(),
    order: z.enum(["asc", "desc"]).optional(),
    limit: z.number().int().min(1).max(100).optional(),
    offset: z.number().int().min(0).optional(),
  })
  .strict();

const UpdateMediaInput = z
  .object({
    alt: z.string().max(500).optional(),
    title: z.string().max(500).optional(),
    meta: z.record(z.unknown()).optional(),
  })
  .strict();

export const mediaRouter = router({
  /**
   * List media with filtering and pagination.
   */
  list: publicProcedure
    .input(MediaQueryInput.optional())
    .query(async ({ ctx, input }) => {
      return handleServiceCall(() =>
        ctx.services.media.query(input ?? {})
      );
    }),

  /**
   * Get a single media record by ID.
   */
  byId: publicProcedure
    .input(z.object({ id: z.number().int().positive() }))
    .query(async ({ ctx, input }) => {
      return handleServiceCall(() =>
        ctx.services.media.getById(input.id)
      );
    }),

  /**
   * Update media metadata (alt, title, meta).
   * Requires upload_files capability.
   */
  update: protectedProcedure
    .input(
      z.object({
        id: z.number().int().positive(),
        data: UpdateMediaInput,
      })
    )
    .mutation(async ({ ctx, input }) => {
      await requireCapability(ctx, "upload_files");
      return handleServiceCall(() =>
        ctx.services.media.update(input.id, input.data)
      );
    }),

  /**
   * Delete a media record and its files.
   * Requires upload_files capability.
   */
  delete: protectedProcedure
    .input(z.object({ id: z.number().int().positive() }))
    .mutation(async ({ ctx, input }) => {
      await requireCapability(ctx, "upload_files");
      return handleServiceCall(() =>
        ctx.services.media.delete(input.id)
      );
    }),
});
