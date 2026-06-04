/**
 * Taxonomies REST Routes
 *
 * GET    /taxonomies              — list all taxonomies
 * GET    /taxonomies/:slug        — get taxonomy by slug
 * GET    /taxonomies/:slug/terms  — list terms for taxonomy
 * POST   /taxonomies/:slug/terms  — create term (requires manage_categories)
 * PUT    /terms/:id               — update term (requires manage_categories)
 * DELETE /terms/:id               — delete term (requires manage_categories)
 */

import { Hono } from "hono";
import { CreateTermSchema, UpdateTermSchema } from "@presslyn/core";
import type { RestEnv } from "../middleware.js";
import { parseId, requireCap } from "../helpers.js";
import { handleRestError } from "../error-handler.js";

const taxonomies = new Hono<RestEnv>();

/**
 * GET /taxonomies
 * List all registered taxonomies.
 */
taxonomies.get("/", async (c) => {
  try {
    const services = c.get("services");
    const result = await services.taxonomy.getAllTaxonomies();
    return c.json(result, 200);
  } catch (err) {
    return handleRestError(err, c);
  }
});

/**
 * GET /taxonomies/:slug
 * Get a single taxonomy by slug.
 */
taxonomies.get("/:slug", async (c) => {
  try {
    const services = c.get("services");
    const slug = c.req.param("slug");

    // Avoid matching "terms" path segment as a slug
    if (slug === "terms") {
      return c.json({ error: "Taxonomy not found", code: "NOT_FOUND" }, 404);
    }

    const result = await services.taxonomy.getTaxonomy(slug);
    return c.json(result, 200);
  } catch (err) {
    return handleRestError(err, c);
  }
});

/**
 * GET /taxonomies/:slug/terms
 * List terms for a taxonomy with filtering and pagination.
 */
taxonomies.get("/:slug/terms", async (c) => {
  try {
    const services = c.get("services");
    const slug = c.req.param("slug");
    const query = c.req.query();

    const result = await services.taxonomy.queryTerms({
      taxonomySlug: slug,
      search: query.search as string | undefined,
      orderBy: query.orderBy as "id" | "name" | "slug" | undefined,
      order: query.order as "asc" | "desc" | undefined,
      limit: query.limit ? parseInt(query.limit, 10) : undefined,
      offset: query.offset ? parseInt(query.offset, 10) : undefined,
    });

    return c.json(result, 200);
  } catch (err) {
    return handleRestError(err, c);
  }
});

/**
 * POST /taxonomies/:slug/terms
 * Create a new term in a taxonomy. Requires manage_categories capability.
 */
taxonomies.post("/:slug/terms", async (c) => {
  try {
    await requireCap(c, "manage_categories");
    const services = c.get("services");
    const slug = c.req.param("slug");
    const body = await c.req.json();

    const validated = CreateTermSchema.parse({ ...body, taxonomySlug: slug });
    const term = await services.taxonomy.createTerm(validated);

    return c.json(term, 201);
  } catch (err) {
    return handleRestError(err, c);
  }
});

export { taxonomies as taxonomiesRoutes };

// ─── Separate Hono app for /terms routes ────────────────────

const termsApp = new Hono<RestEnv>();

/**
 * PUT /terms/:id
 * Update a term. Requires manage_categories capability.
 */
termsApp.put("/:id", async (c) => {
  try {
    await requireCap(c, "manage_categories");
    const services = c.get("services");
    const id = parseId(c);
    const body = await c.req.json();

    const validated = UpdateTermSchema.parse(body);
    const updated = await services.taxonomy.updateTerm(id, validated);
    return c.json(updated, 200);
  } catch (err) {
    return handleRestError(err, c);
  }
});

/**
 * DELETE /terms/:id
 * Delete a term. Requires manage_categories capability.
 */
termsApp.delete("/:id", async (c) => {
  try {
    await requireCap(c, "manage_categories");
    const services = c.get("services");
    const id = parseId(c);

    await services.taxonomy.deleteTerm(id);
    return c.json({ message: "Term deleted" }, 200);
  } catch (err) {
    return handleRestError(err, c);
  }
});

export { termsApp as termsRoutes };
