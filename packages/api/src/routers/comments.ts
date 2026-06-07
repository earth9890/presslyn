/**
 * Comments Router
 *
 * Comment CRUD, moderation (approve/unapprove), and counts.
 */

import { z } from "zod";
import { CommentQuerySchema } from "@presslyn/core";
import { router, publicProcedure, protectedProcedure } from "../trpc.js";
import { handleServiceCall } from "./errors.js";
import { requireCapability, hasCapability } from "./auth-helpers.js";
import {
  assertPublicCommentTarget,
  PublicCommentSubmissionSchema,
} from "../comments/public-comment.js";

export const commentsRouter = router({
  /**
   * List comments with filtering and pagination.
   * Anonymous users can only see approved comments.
   * Users with moderate_comments can see all comments.
   */
  list: publicProcedure
    .input(CommentQuerySchema.optional())
    .query(async ({ ctx, input }) => {
      const canModerate = await hasCapability(ctx, "moderate_comments");
      const query = { ...(input ?? {}) };

      // Anonymous / unprivileged users can only see approved comments
      if (!canModerate) {
        query.approved = true;
      }

      return handleServiceCall(() =>
        ctx.services.comments.queryComments(query)
      );
    }),

  /**
   * Create a new comment (public — guests can comment).
   */
  create: publicProcedure
    .input(PublicCommentSubmissionSchema)
    .mutation(async ({ ctx, input }) => {
      return handleServiceCall(async () => {
        await assertPublicCommentTarget(
          ctx.services.content,
          ctx.services.comments,
          input
        );
        const { website: _website, ...commentInput } = input;
        return ctx.services.comments.createComment(commentInput);
      });
    }),

  /**
   * Approve a comment (moderation).
   * Requires moderate_comments capability.
   */
  approve: protectedProcedure
    .input(z.object({ id: z.number().int().positive() }))
    .mutation(async ({ ctx, input }) => {
      await requireCapability(ctx, "moderate_comments");
      return handleServiceCall(() =>
        ctx.services.comments.approveComment(input.id)
      );
    }),

  /**
   * Unapprove a comment (moderation).
   * Requires moderate_comments capability.
   */
  unapprove: protectedProcedure
    .input(z.object({ id: z.number().int().positive() }))
    .mutation(async ({ ctx, input }) => {
      await requireCapability(ctx, "moderate_comments");
      return handleServiceCall(() =>
        ctx.services.comments.unapproveComment(input.id)
      );
    }),

  /**
   * Delete a comment.
   * Requires moderate_comments capability.
   */
  delete: protectedProcedure
    .input(z.object({ id: z.number().int().positive() }))
    .mutation(async ({ ctx, input }) => {
      await requireCapability(ctx, "moderate_comments");
      return handleServiceCall(() =>
        ctx.services.comments.deleteComment(input.id)
      );
    }),

  /**
   * Get comment counts (approved, pending, total).
   * Anonymous / unprivileged users only see approved count (pending hidden).
   */
  counts: publicProcedure.query(async ({ ctx }) => {
    const counts = await handleServiceCall(() =>
      ctx.services.comments.getCommentCounts()
    );

    const canModerate = await hasCapability(ctx, "moderate_comments");
    if (!canModerate) {
      // Hide pending counts from anonymous / unprivileged users
      return { approved: counts.approved, pending: 0, total: counts.approved };
    }

    return counts;
  }),
});
