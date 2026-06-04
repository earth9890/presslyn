/**
 * Taxonomies Router
 *
 * Manages taxonomies (categories, tags, custom) and their terms.
 */

import { z } from "zod";
import {
  CreateTermSchema,
  UpdateTermSchema,
  TermQuerySchema,
} from "@presslyn/core";
import { router, publicProcedure, protectedProcedure } from "../trpc.js";
import { handleServiceCall } from "./errors.js";
import { requireCapability } from "./auth-helpers.js";

export const taxonomiesRouter = router({
  /**
   * List all registered taxonomies.
   */
  list: publicProcedure.query(async ({ ctx }) => {
    return handleServiceCall(() =>
      ctx.services.taxonomy.getAllTaxonomies()
    );
  }),

  /**
   * Get a single taxonomy by slug.
   */
  get: publicProcedure
    .input(z.object({ slug: z.string().min(1).max(100) }))
    .query(async ({ ctx, input }) => {
      return handleServiceCall(() =>
        ctx.services.taxonomy.getTaxonomy(input.slug)
      );
    }),

  /**
   * Create a new term in a taxonomy.
   * Requires manage_categories capability.
   */
  createTerm: protectedProcedure
    .input(CreateTermSchema)
    .mutation(async ({ ctx, input }) => {
      await requireCapability(ctx, "manage_categories");
      return handleServiceCall(() =>
        ctx.services.taxonomy.createTerm(input)
      );
    }),

  /**
   * Update an existing term.
   * Requires manage_categories capability.
   */
  updateTerm: protectedProcedure
    .input(
      z.object({
        id: z.number().int().positive(),
        data: UpdateTermSchema,
      })
    )
    .mutation(async ({ ctx, input }) => {
      await requireCapability(ctx, "manage_categories");
      return handleServiceCall(() =>
        ctx.services.taxonomy.updateTerm(input.id, input.data)
      );
    }),

  /**
   * Delete a term.
   * Requires manage_categories capability.
   */
  deleteTerm: protectedProcedure
    .input(z.object({ id: z.number().int().positive() }))
    .mutation(async ({ ctx, input }) => {
      await requireCapability(ctx, "manage_categories");
      return handleServiceCall(() =>
        ctx.services.taxonomy.deleteTerm(input.id)
      );
    }),

  /**
   * Query terms with filtering and pagination.
   */
  queryTerms: publicProcedure
    .input(TermQuerySchema)
    .query(async ({ ctx, input }) => {
      return handleServiceCall(() =>
        ctx.services.taxonomy.queryTerms(input)
      );
    }),

  /**
   * Get a hierarchical term tree for a taxonomy.
   */
  termTree: publicProcedure
    .input(z.object({ taxonomySlug: z.string().min(1).max(100) }))
    .query(async ({ ctx, input }) => {
      return handleServiceCall(() =>
        ctx.services.taxonomy.getTermTree(input.taxonomySlug)
      );
    }),
});
