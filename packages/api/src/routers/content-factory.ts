/**
 * Content Router Factory
 *
 * Shared factory that produces tRPC routers for "post" and "page" content types.
 * Eliminates duplication between posts.ts and pages.ts while enforcing
 * capability checks on all mutations and proper visibility filtering on queries.
 */

import { z } from "zod";
import { TRPCError } from "@trpc/server";
import {
  CreatePostSchema,
  UpdatePostSchema,
  PostQuerySchema,
} from "@presslyn/core";
import { router, publicProcedure, protectedProcedure } from "../trpc.js";
import { handleServiceCall } from "./errors.js";
import { requireCapability, hasCapability } from "./auth-helpers.js";

// ─── Capability Map ──────────────────────────────────────────

interface ContentCapabilities {
  edit: string;
  editOthers: string;
  delete: string;
  deleteOthers: string;
  readPrivate: string;
  publish: string;
}

const CAPABILITIES: Record<"post" | "page", ContentCapabilities> = {
  post: {
    edit: "edit_posts",
    editOthers: "edit_others_posts",
    delete: "delete_posts",
    deleteOthers: "delete_others_posts",
    readPrivate: "read_private_posts",
    publish: "publish_posts",
  },
  page: {
    edit: "edit_pages",
    editOthers: "edit_others_pages",
    delete: "delete_pages",
    deleteOthers: "delete_others_pages",
    readPrivate: "read_private_pages",
    publish: "publish_pages",
  },
};

// ─── Factory ─────────────────────────────────────────────────

export function createContentRouter(postType: "post" | "page") {
  const caps = CAPABILITIES[postType];

  return router({
    /**
     * List content with filtering and pagination.
     *
     * - Anonymous users: only published content.
     * - Authenticated without read_private: excludes private content.
     * - Authenticated with read_private: full access.
     */
    list: publicProcedure
      .input(PostQuerySchema.omit({ postType: true }).optional())
      .query(async ({ ctx, input }) => {
        const canReadPrivate = await hasCapability(ctx, caps.readPrivate);

        let queryInput = { ...input, postType };

        if (!ctx.userId) {
          // Anonymous: force published only
          queryInput = { ...queryInput, status: "publish" };
        } else if (!canReadPrivate) {
          // Authenticated but can't read private: if no explicit status filter,
          // exclude private posts. If explicit filter includes "private", strip it.
          const requestedStatus = queryInput.status;
          if (requestedStatus === undefined) {
            // No filter — exclude private and trash by showing common statuses
            queryInput = {
              ...queryInput,
              status: ["publish", "draft", "pending"],
            };
          } else if (requestedStatus === "private") {
            // Explicitly requesting private — not allowed, force publish
            queryInput = { ...queryInput, status: "publish" };
          } else if (Array.isArray(requestedStatus)) {
            queryInput = {
              ...queryInput,
              status: requestedStatus.filter((s) => s !== "private"),
            };
          }
          // If it's a single string that isn't "private", leave it alone
        }

        return handleServiceCall(() =>
          ctx.services.content.queryPosts(queryInput)
        );
      }),

    /**
     * Get a single item by ID.
     *
     * - Anonymous: only published.
     * - Authenticated, own item: always visible.
     * - Authenticated, others' private item: require read_private capability.
     * - Trashed items: only visible to the owner or users with read_private.
     */
    byId: publicProcedure
      .input(z.object({ id: z.number().int().positive() }))
      .query(async ({ ctx, input }) => {
        const post = await handleServiceCall(() =>
          ctx.services.content.getPostById(input.id)
        );

        // This router only serves its own post type.
        if (post.postType !== postType) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: `${postType === "page" ? "Page" : "Post"} not found`,
          });
        }

        // Visibility filtering
        if (post.status === "publish") {
          return post;
        }

        // Non-published content requires authentication
        if (!ctx.userId) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: `${postType === "page" ? "Page" : "Post"} not found`,
          });
        }

        // Owner can always see their own content
        if (post.authorId === ctx.userId) {
          return post;
        }

        // Others need read_private capability for non-published content
        const canReadPrivate = await hasCapability(ctx, caps.readPrivate);
        if (!canReadPrivate) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: `${postType === "page" ? "Page" : "Post"} not found`,
          });
        }

        return post;
      }),

    /**
     * Get a single item by slug.
     *
     * Same visibility rules as byId.
     */
    bySlug: publicProcedure
      .input(z.object({ slug: z.string().min(1).max(500) }))
      .query(async ({ ctx, input }) => {
        const post = await handleServiceCall(() =>
          ctx.services.content.getPostBySlug(input.slug, postType)
        );

        if (!post) {
          return null;
        }

        // Visibility filtering
        if (post.status === "publish") {
          return post;
        }

        // Non-published content requires authentication
        if (!ctx.userId) {
          return null;
        }

        // Owner can always see their own content
        if (post.authorId === ctx.userId) {
          return post;
        }

        // Others need read_private capability for non-published content
        const canReadPrivate = await hasCapability(ctx, caps.readPrivate);
        if (!canReadPrivate) {
          return null;
        }

        return post;
      }),

    /**
     * Create a new item.
     *
     * Requires `edit_posts`/`edit_pages`.
     * Overrides authorId with ctx.userId unless the user has edit_others capability.
     */
    create: protectedProcedure
      .input(
        CreatePostSchema.omit({ postType: true }).partial({ authorId: true })
      )
      .mutation(async ({ ctx, input }) => {
        await requireCapability(ctx, caps.edit);

        // Prevent authorId spoofing: force ctx.userId unless user can edit others
        let authorId = ctx.userId;
        if (input.authorId && input.authorId !== ctx.userId) {
          const canEditOthers = await hasCapability(ctx, caps.editOthers);
          if (!canEditOthers) {
            authorId = ctx.userId;
          } else {
            authorId = input.authorId;
          }
        }

        return handleServiceCall(() =>
          ctx.services.content.createPost({
            ...input,
            authorId,
            postType,
          })
        );
      }),

    /**
     * Update an existing item.
     *
     * Requires `edit_posts`/`edit_pages`.
     * If the item is not owned by the current user, also requires `edit_others`.
     */
    update: protectedProcedure
      .input(
        z.object({
          id: z.number().int().positive(),
          data: UpdatePostSchema,
        })
      )
      .mutation(async ({ ctx, input }) => {
        await requireCapability(ctx, caps.edit);

        // Check ownership — if not the author, require edit_others
        const existing = await handleServiceCall(() =>
          ctx.services.content.getPostById(input.id)
        );
        // Guard against cross-type access: the pages router must not touch
        // posts (and vice-versa), since the two have separate capabilities.
        if (existing.postType !== postType) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: `${postType === "page" ? "Page" : "Post"} not found`,
          });
        }
        if (existing.authorId !== ctx.userId) {
          await requireCapability(ctx, caps.editOthers);
        }

        return handleServiceCall(() =>
          ctx.services.content.updatePost(input.id, input.data)
        );
      }),

    /**
     * Move an item to the trash.
     *
     * Requires `delete_posts`/`delete_pages`.
     * If not owned, also requires `delete_others`.
     */
    trash: protectedProcedure
      .input(z.object({ id: z.number().int().positive() }))
      .mutation(async ({ ctx, input }) => {
        await requireCapability(ctx, caps.delete);

        const existing = await handleServiceCall(() =>
          ctx.services.content.getPostById(input.id)
        );
        // Guard against cross-type access: the pages router must not touch
        // posts (and vice-versa), since the two have separate capabilities.
        if (existing.postType !== postType) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: `${postType === "page" ? "Page" : "Post"} not found`,
          });
        }
        if (existing.authorId !== ctx.userId) {
          await requireCapability(ctx, caps.deleteOthers);
        }

        return handleServiceCall(() =>
          ctx.services.content.trashPost(input.id)
        );
      }),

    /**
     * Restore an item from the trash.
     *
     * Same capability requirements as trash.
     */
    restore: protectedProcedure
      .input(z.object({ id: z.number().int().positive() }))
      .mutation(async ({ ctx, input }) => {
        await requireCapability(ctx, caps.delete);

        const existing = await handleServiceCall(() =>
          ctx.services.content.getPostById(input.id)
        );
        // Guard against cross-type access: the pages router must not touch
        // posts (and vice-versa), since the two have separate capabilities.
        if (existing.postType !== postType) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: `${postType === "page" ? "Page" : "Post"} not found`,
          });
        }
        if (existing.authorId !== ctx.userId) {
          await requireCapability(ctx, caps.deleteOthers);
        }

        return handleServiceCall(() =>
          ctx.services.content.restorePost(input.id)
        );
      }),

    /**
     * Permanently delete an item.
     *
     * Requires `delete_posts`/`delete_pages`.
     * If not owned, also requires `delete_others`.
     */
    delete: protectedProcedure
      .input(z.object({ id: z.number().int().positive() }))
      .mutation(async ({ ctx, input }) => {
        await requireCapability(ctx, caps.delete);

        const existing = await handleServiceCall(() =>
          ctx.services.content.getPostById(input.id)
        );
        // Guard against cross-type access: the pages router must not touch
        // posts (and vice-versa), since the two have separate capabilities.
        if (existing.postType !== postType) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: `${postType === "page" ? "Page" : "Post"} not found`,
          });
        }
        if (existing.authorId !== ctx.userId) {
          await requireCapability(ctx, caps.deleteOthers);
        }

        return handleServiceCall(() =>
          ctx.services.content.deletePost(input.id)
        );
      }),

    /**
     * Get status counts (e.g., { draft: 5, publish: 12, trash: 2 }).
     */
    statusCounts: publicProcedure.query(async ({ ctx }) => {
      return handleServiceCall(() =>
        ctx.services.content.getStatusCounts(postType)
      );
    }),
  });
}
