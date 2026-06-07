/**
 * Comments REST Routes
 *
 * GET    /comments              — list approved comments (public), all if moderate_comments
 * POST   /comments              — create comment (public, guests can comment)
 * PUT    /comments/:id/approve  — approve comment (requires moderate_comments)
 * PUT    /comments/:id/unapprove — unapprove comment (requires moderate_comments)
 * DELETE /comments/:id          — delete comment (requires moderate_comments)
 */

import { Hono } from "hono";
import type { RestEnv } from "../middleware.js";
import { parseId, requireCap, hasCap } from "../helpers.js";
import { handleRestError } from "../error-handler.js";
import {
  assertPublicCommentTarget,
  PublicCommentSubmissionSchema,
} from "../../comments/public-comment.js";

const comments = new Hono<RestEnv>();

/**
 * GET /comments
 * List comments. Anonymous users only see approved comments.
 * Users with moderate_comments can see all.
 */
comments.get("/", async (c) => {
  try {
    const services = c.get("services");
    const query = c.req.query();

    const canModerate = await hasCap(c, "moderate_comments");

    const opts: {
      postId?: number;
      approved?: boolean;
      orderBy?: "id" | "date";
      order?: "asc" | "desc";
      limit?: number;
      offset?: number;
    } = {};

    if (query.postId) opts.postId = parseInt(query.postId, 10);
    if (query.orderBy) opts.orderBy = query.orderBy as "id" | "date";
    if (query.order) opts.order = query.order as "asc" | "desc";
    if (query.limit) opts.limit = parseInt(query.limit, 10);
    if (query.offset) opts.offset = parseInt(query.offset, 10);

    // Anonymous / unprivileged users can only see approved comments
    if (!canModerate) {
      opts.approved = true;
    }

    const result = await services.comments.queryComments(opts);
    return c.json(result, 200);
  } catch (err) {
    return handleRestError(err, c);
  }
});

/**
 * POST /comments
 * Create a new comment. Public — guests can comment.
 */
comments.post("/", async (c) => {
  try {
    const services = c.get("services");
    const body = await c.req.json();

    const validated = PublicCommentSubmissionSchema.parse(body);
    await assertPublicCommentTarget(services.content, services.comments, validated);
    const { website: _website, ...commentInput } = validated;
    const comment = await services.comments.createComment(commentInput);
    return c.json(comment, 201);
  } catch (err) {
    return handleRestError(err, c);
  }
});

/**
 * PUT /comments/:id/approve
 * Approve a comment. Requires moderate_comments capability.
 */
comments.put("/:id/approve", async (c) => {
  try {
    await requireCap(c, "moderate_comments");
    const services = c.get("services");
    const id = parseId(c);

    const approved = await services.comments.approveComment(id);
    return c.json(approved, 200);
  } catch (err) {
    return handleRestError(err, c);
  }
});

/**
 * PUT /comments/:id/unapprove
 * Unapprove a comment. Requires moderate_comments capability.
 */
comments.put("/:id/unapprove", async (c) => {
  try {
    await requireCap(c, "moderate_comments");
    const services = c.get("services");
    const id = parseId(c);

    const unapproved = await services.comments.unapproveComment(id);
    return c.json(unapproved, 200);
  } catch (err) {
    return handleRestError(err, c);
  }
});

/**
 * DELETE /comments/:id
 * Delete a comment. Requires moderate_comments capability.
 */
comments.delete("/:id", async (c) => {
  try {
    await requireCap(c, "moderate_comments");
    const services = c.get("services");
    const id = parseId(c);

    await services.comments.deleteComment(id);
    return c.json({ message: "Comment deleted" }, 200);
  } catch (err) {
    return handleRestError(err, c);
  }
});

export { comments as commentsRoutes };
