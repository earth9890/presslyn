/**
 * Comments Service
 *
 * WordPress equivalent: wp-includes/comment.php (4,195 lines)
 */

import { eq, and, desc, asc, sql } from "drizzle-orm";
import { type Database } from "@presslyn/database";
import { comments, posts } from "@presslyn/database";
import { hooks } from "../hooks.js";
import { NotFoundError, ValidationError } from "../errors.js";
import { CreateCommentSchema, CommentQuerySchema } from "../schemas.js";

export interface CreateCommentInput {
  postId: number;
  authorId?: number;
  authorName?: string;
  authorEmail?: string;
  content: string;
  parentId?: number;
}

export interface CommentQueryOptions {
  postId?: number;
  approved?: boolean;
  orderBy?: "id" | "date";
  order?: "asc" | "desc";
  limit?: number;
  offset?: number;
}

export class CommentsService {
  constructor(private db: Database) {}

  /**
   * Create a new comment on a post.
   *
   * Validates input via Zod, confirms the referenced post exists and accepts
   * comments (commentStatus === "open"), applies the `comment_text` filter,
   * inserts the row, and fires the `comment_post` action.
   */
  async createComment(input: CreateCommentInput) {
    // Validate input with Zod schema
    const parsed = CreateCommentSchema.parse(input);

    // Verify the referenced post exists and has comments open
    const [post] = await this.db
      .select({ id: posts.id, commentStatus: posts.commentStatus })
      .from(posts)
      .where(eq(posts.id, parsed.postId))
      .limit(1);

    if (!post) {
      throw new NotFoundError("Post", parsed.postId);
    }
    if (post.commentStatus !== "open") {
      throw new ValidationError("Comments are closed for this post");
    }

    const content = await hooks.applyFilters("comment_text", parsed.content);

    const [comment] = await this.db
      .insert(comments)
      .values({
        postId: parsed.postId,
        authorId: parsed.authorId ?? null,
        authorName: parsed.authorName ?? "",
        authorEmail: parsed.authorEmail ?? "",
        content,
        parentId: parsed.parentId ?? null,
        approved: false, // Pending by default
      })
      .returning();

    await hooks.doAction("comment_post", comment);
    return comment;
  }

  /**
   * Retrieve a single comment by its id.
   *
   * @throws {NotFoundError} when no comment matches the given id.
   */
  async getCommentById(id: number) {
    const [comment] = await this.db
      .select()
      .from(comments)
      .where(eq(comments.id, id))
      .limit(1);

    if (!comment) throw new NotFoundError("Comment", id);
    return comment;
  }

  /**
   * Mark a comment as approved and fire the `transition_comment_status` action.
   */
  async approveComment(id: number) {
    const comment = await this.getCommentById(id);
    const [updated] = await this.db
      .update(comments)
      .set({ approved: true })
      .where(eq(comments.id, id))
      .returning();

    await hooks.doAction("transition_comment_status", "approved", comment.approved ? "approved" : "pending", updated);
    return updated;
  }

  /**
   * Mark a comment as unapproved (pending).
   */
  async unapproveComment(id: number) {
    const [updated] = await this.db
      .update(comments)
      .set({ approved: false })
      .where(eq(comments.id, id))
      .returning();
    return updated;
  }

  /**
   * Delete a comment.
   *
   * Re-parents any child comments to the deleted comment's parent so the
   * thread structure stays intact, then removes the comment row.  Both
   * operations run inside a transaction for atomicity.
   */
  async deleteComment(id: number) {
    const comment = await this.getCommentById(id);

    await this.db.transaction(async (tx) => {
      // Re-parent children to the deleted comment's parent
      await tx
        .update(comments)
        .set({ parentId: comment.parentId })
        .where(eq(comments.parentId, id));

      await tx.delete(comments).where(eq(comments.id, id));
    });

    await hooks.doAction("delete_comment", comment);
    return true;
  }

  /**
   * Query comments with filtering, ordering, and pagination.
   *
   * Validates options via Zod and caps the page size to 100.
   */
  async queryComments(opts: CommentQueryOptions = {}) {
    // Validate input with Zod schema
    const parsed = CommentQuerySchema.parse(opts);

    const {
      postId,
      approved,
      orderBy = "date",
      order = "desc",
      offset = 0,
    } = parsed;

    // Cap limit to 100 even though schema allows up to 100 — defence in depth
    const limit = Math.min(parsed.limit ?? 20, 100);

    const conditions = [];
    if (postId) conditions.push(eq(comments.postId, postId));
    if (approved !== undefined) conditions.push(eq(comments.approved, approved));

    const orderCol = orderBy === "id" ? comments.id : comments.createdAt;
    const orderFn = order === "desc" ? desc : asc;

    const where = conditions.length > 0 ? and(...conditions) : undefined;

    const rows = await this.db
      .select()
      .from(comments)
      .where(where)
      .orderBy(orderFn(orderCol))
      .limit(limit)
      .offset(offset);

    const [countResult] = await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(comments)
      .where(where);

    return { comments: rows, total: countResult.count };
  }

  /**
   * Return aggregate counts of approved, pending, and total comments.
   *
   * Handles the empty-table case gracefully (all zeros).
   */
  async getCommentCounts() {
    const result = await this.db
      .select({
        approved: comments.approved,
        count: sql<number>`count(*)::int`,
      })
      .from(comments)
      .groupBy(comments.approved);

    const counts = { approved: 0, pending: 0, total: 0 };

    if (result.length === 0) {
      return counts;
    }

    for (const row of result) {
      if (row.approved) {
        counts.approved = row.count;
      } else {
        counts.pending = row.count;
      }
      counts.total += row.count;
    }
    return counts;
  }
}
