/**
 * Content REST Route Factory
 *
 * DRY factory that produces Hono route groups for "post" and "page" content types.
 * Ports the visibility filtering logic from the tRPC content-factory to REST.
 *
 * Exported: createContentRestRoutes("post" | "page")
 */

import { Hono } from "hono";
import { z } from "zod";
import {
  CreatePostSchema,
  UpdatePostSchema,
  PostQuerySchema,
  NotFoundError,
} from "@presslyn/core";
import type { RestEnv } from "../middleware.js";
import { parseId, requireCap, hasCap } from "../helpers.js";
import { handleRestError } from "../error-handler.js";

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

const UpdatePostTermsSchema = z
  .object({
    termIds: z.array(z.number().int().positive()).max(100),
  })
  .strict();

function parseStatusQuery(value: string | undefined) {
  if (!value) {
    return undefined;
  }

  const parts = value
    .split(",")
    .map((status) => status.trim())
    .filter(Boolean);

  return parts.length > 1 ? parts : parts[0];
}

// ─── Factory ─────────────────────────────────────────────────

export function createContentRestRoutes(postType: "post" | "page") {
  const caps = CAPABILITIES[postType];
  const label = postType === "page" ? "Page" : "Post";
  const app = new Hono<RestEnv>();

  /**
   * GET /
   * List content with filtering and pagination.
   *
   * - Anonymous: only published content.
   * - Authenticated without read_private_*: excludes private content.
   * - Authenticated with read_private_*: all statuses allowed.
   */
  app.get("/", async (c) => {
    try {
      const services = c.get("services");
      const userId = c.get("userId");
      const query = c.req.query();

      const canReadPrivate = await hasCap(c, caps.readPrivate);

      // Build query input — validate through PostQuerySchema
      const rawInput: Record<string, unknown> = { postType };
      if (query.search) rawInput.search = query.search;
      if (query.authorId) rawInput.authorId = Number(query.authorId);
      if (query.termId) rawInput.termId = Number(query.termId);
      if (query.year) rawInput.year = Number(query.year);
      if (query.month) rawInput.month = Number(query.month);
      if (query.slug) rawInput.slug = query.slug;
      if (query.orderBy) rawInput.orderBy = query.orderBy;
      if (query.order) rawInput.order = query.order;
      if (query.limit) rawInput.limit = Number(query.limit);
      if (query.offset) rawInput.offset = Number(query.offset);

      // Visibility filtering
      if (!userId) {
        // Anonymous: force published only
        rawInput.status = "publish";
      } else if (!canReadPrivate) {
        const requestedStatus = query.status;
        if (requestedStatus === undefined) {
          // No filter — exclude private and trash by showing common statuses
          rawInput.status = ["publish", "draft", "pending"];
        } else if (requestedStatus === "private") {
          // Explicitly requesting private — not allowed, force publish
          rawInput.status = "publish";
        } else {
          // Pass through but strip "private" if it appears in a comma-separated list
          const parts = requestedStatus.split(",").map((s) => s.trim());
          rawInput.status =
            parts.length > 1
              ? parts.filter((s) => s !== "private")
              : requestedStatus === "private"
                ? "publish"
                : requestedStatus;
        }
      } else {
        // Full access — pass through the requested status if any
        rawInput.status = parseStatusQuery(query.status);
      }

      const parsed = PostQuerySchema.parse(rawInput);
      const result = await services.content.queryPosts(parsed);
      return c.json(result, 200);
    } catch (err) {
      return handleRestError(err, c);
    }
  });

  /**
   * GET /:id
   * Get a single item by ID.
   *
   * - Anonymous: only published.
   * - Authenticated, own item: always visible.
   * - Authenticated, others' private/non-published item: requires read_private_*.
   */
  app.get("/:id", async (c) => {
    try {
      const services = c.get("services");
      const userId = c.get("userId");
      const id = parseId(c);

      const post = await services.content.getPostById(id);
      if (post.postType !== postType) throw new NotFoundError(label);

      // Published content is public
      if (post.status === "publish") {
        return c.json(post, 200);
      }

      // Non-published requires authentication
      if (!userId) {
        throw new NotFoundError(label);
      }

      // Owner can always see their own content
      if (post.authorId === userId) {
        return c.json(post, 200);
      }

      // Others need read_private capability for non-published content
      const canReadPrivate = await hasCap(c, caps.readPrivate);
      if (!canReadPrivate) {
        throw new NotFoundError(label);
      }

      return c.json(post, 200);
    } catch (err) {
      return handleRestError(err, c);
    }
  });

  /**
   * GET /:id/revisions
   * Get revision history for an item.
   *
   * Requires edit_* capability.
   * Reading others' items also requires edit_others_*.
   */
  app.get("/:id/revisions", async (c) => {
    try {
      const userId = await requireCap(c, caps.edit);
      const services = c.get("services");
      const id = parseId(c);

      const existing = await services.content.getPostById(id);
      if (existing.postType !== postType) throw new NotFoundError(label);
      if (existing.authorId !== userId) {
        await requireCap(c, caps.editOthers);
      }

      const revisions = await services.content.getRevisions(id);
      return c.json(revisions, 200);
    } catch (err) {
      return handleRestError(err, c);
    }
  });

  /**
   * GET /:id/terms
   * Get assigned taxonomy terms for an item.
   *
   * Requires edit_* capability.
   * Reading others' items also requires edit_others_*.
   */
  app.get("/:id/terms", async (c) => {
    try {
      const userId = await requireCap(c, caps.edit);
      const services = c.get("services");
      const id = parseId(c);

      const existing = await services.content.getPostById(id);
      if (existing.postType !== postType) throw new NotFoundError(label);
      if (existing.authorId !== userId) {
        await requireCap(c, caps.editOthers);
      }

      const [assignedTerms, registeredTaxonomies] = await Promise.all([
        services.content.getPostTerms(id),
        services.taxonomy.getAllTaxonomies(),
      ]);

      const taxonomyById = new Map(
        registeredTaxonomies.map((taxonomy) => [taxonomy.id, taxonomy.slug])
      );

      return c.json(
        assignedTerms.map((term) => ({
          ...term,
          taxonomySlug: taxonomyById.get(term.taxonomyId) ?? null,
        })),
        200
      );
    } catch (err) {
      return handleRestError(err, c);
    }
  });

  /**
   * POST /
   * Create a new item.
   *
   * Requires edit_* capability.
   * Forces authorId to userId unless the user has edit_others_* capability.
   */
  app.post("/", async (c) => {
    try {
      const userId = await requireCap(c, caps.edit);
      const services = c.get("services");
      const body = await c.req.json();

      // Author defaults to the authenticated user, so it remains optional here.
      const validated = CreatePostSchema.omit({ postType: true })
        .partial({ authorId: true })
        .parse(body);

      // Prevent authorId spoofing: force userId unless user can edit others
      let authorId = userId;
      if (validated.authorId && validated.authorId !== userId) {
        const canEditOthers = await hasCap(c, caps.editOthers);
        if (canEditOthers) {
          authorId = validated.authorId;
        }
      }

      const post = await services.content.createPost({
        ...validated,
        authorId,
        postType,
      });

      return c.json(post, 201);
    } catch (err) {
      return handleRestError(err, c);
    }
  });

  /**
   * PUT /:id
   * Update an existing item.
   *
   * Requires edit_* capability.
   * Editing others' items also requires edit_others_*.
   */
  app.put("/:id", async (c) => {
    try {
      const userId = await requireCap(c, caps.edit);
      const services = c.get("services");
      const id = parseId(c);
      const body = await c.req.json();

      const validated = UpdatePostSchema.parse(body);

      // Check ownership — if not the author, require edit_others
      const existing = await services.content.getPostById(id);
      if (existing.postType !== postType) throw new NotFoundError(label);
      if (existing.authorId !== userId) {
        await requireCap(c, caps.editOthers);
      }

      const updated = await services.content.updatePost(id, validated);
      return c.json(updated, 200);
    } catch (err) {
      return handleRestError(err, c);
    }
  });

  /**
   * PUT /:id/terms
   * Replace the editor-managed term assignments on an item.
   *
   * Requires edit_* capability.
   * Editing others' items also requires edit_others_*.
   */
  app.put("/:id/terms", async (c) => {
    try {
      const userId = await requireCap(c, caps.edit);
      const services = c.get("services");
      const id = parseId(c);
      const body = await c.req.json();
      const validated = UpdatePostTermsSchema.parse(body);

      const existing = await services.content.getPostById(id);
      if (existing.postType !== postType) throw new NotFoundError(label);
      if (existing.authorId !== userId) {
        await requireCap(c, caps.editOthers);
      }

      const [currentTerms, registeredTaxonomies] = await Promise.all([
        services.content.getPostTerms(id),
        services.taxonomy.getAllTaxonomies(),
      ]);

      const taxonomyById = new Map(
        registeredTaxonomies.map((taxonomy) => [taxonomy.id, taxonomy.slug])
      );

      const preservedTermIds = currentTerms
        .filter((term) => {
          const taxonomySlug = taxonomyById.get(term.taxonomyId);
          return taxonomySlug !== "category" && taxonomySlug !== "post_tag";
        })
        .map((term) => term.id);

      const nextTermIds = Array.from(
        new Set([...preservedTermIds, ...validated.termIds])
      );

      await services.content.setPostTerms(id, nextTermIds);

      return c.json({ termIds: nextTermIds }, 200);
    } catch (err) {
      return handleRestError(err, c);
    }
  });

  /**
   * DELETE /:id
   * Trash an item (soft-delete).
   *
   * Requires delete_* capability.
   * Trashing others' items also requires delete_others_*.
   */
  app.delete("/:id", async (c) => {
    try {
      const userId = await requireCap(c, caps.delete);
      const services = c.get("services");
      const id = parseId(c);

      const existing = await services.content.getPostById(id);
      if (existing.postType !== postType) throw new NotFoundError(label);
      if (existing.authorId !== userId) {
        await requireCap(c, caps.deleteOthers);
      }

      const trashed = await services.content.trashPost(id);
      return c.json(trashed, 200);
    } catch (err) {
      return handleRestError(err, c);
    }
  });

  /**
   * PUT /:id/restore
   * Restore an item from the trash.
   *
   * Requires delete_* capability.
   * Restoring others' items also requires delete_others_*.
   */
  app.put("/:id/restore", async (c) => {
    try {
      const userId = await requireCap(c, caps.delete);
      const services = c.get("services");
      const id = parseId(c);

      const existing = await services.content.getPostById(id);
      if (existing.postType !== postType) throw new NotFoundError(label);
      if (existing.authorId !== userId) {
        await requireCap(c, caps.deleteOthers);
      }

      const restored = await services.content.restorePost(id);
      return c.json(restored, 200);
    } catch (err) {
      return handleRestError(err, c);
    }
  });

  /**
   * DELETE /:id/permanent
   * Permanently delete an item.
   *
   * Requires delete_* capability.
   * Deleting others' items also requires delete_others_*.
   */
  app.delete("/:id/permanent", async (c) => {
    try {
      const userId = await requireCap(c, caps.delete);
      const services = c.get("services");
      const id = parseId(c);

      const existing = await services.content.getPostById(id);
      if (existing.postType !== postType) throw new NotFoundError(label);
      if (existing.authorId !== userId) {
        await requireCap(c, caps.deleteOthers);
      }

      await services.content.deletePost(id);
      return c.json({ message: `${label} deleted` }, 200);
    } catch (err) {
      return handleRestError(err, c);
    }
  });

  return app;
}
