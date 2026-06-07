/**
 * Content Service
 *
 * WordPress equivalent: wp-includes/post.php (8,700 lines)
 * CRUD for posts, pages, and custom post types.
 */

import { eq, and, or, desc, asc, like, sql, inArray, isNull } from "drizzle-orm";
import { type Database } from "@presslyn/database";
import {
  posts,
  postRevisions,
  postTerms,
  terms,
  taxonomies,
  users,
  comments,
  postStatusEnum,
  sites,
} from "@presslyn/database";
import { hooks } from "../hooks.js";
import { NotFoundError, ValidationError } from "../errors.js";
import {
  CreatePostSchema,
  UpdatePostSchema,
  PostQuerySchema,
} from "../schemas.js";
import { escapeLike, generateSlug } from "../utils.js";
import { getPostType } from "./post-types.js";

// ─── Types ─────────────────────────────────────────────────

/** The set of valid post status values from the database enum. */
type PostStatus = (typeof postStatusEnum.enumValues)[number];

/** Statuses that a post can be restored to from trash (excludes internal statuses). */
const RESTORABLE_STATUSES: ReadonlySet<string> = new Set<PostStatus>([
  "draft",
  "publish",
  "pending",
  "private",
]);

export interface CreatePostInput {
  siteId?: number;
  authorId: number;
  postType?: string;
  title: string;
  content?: string;
  excerpt?: string;
  status?: "draft" | "publish" | "pending" | "private";
  slug?: string;
  parentId?: number;
  menuOrder?: number;
  commentStatus?: "open" | "closed";
  meta?: Record<string, unknown>;
  publishedAt?: Date;
}

export interface UpdatePostInput {
  title?: string;
  content?: string;
  excerpt?: string;
  status?: "draft" | "publish" | "pending" | "private";
  slug?: string;
  parentId?: number | null;
  menuOrder?: number;
  commentStatus?: "open" | "closed";
  meta?: Record<string, unknown>;
  publishedAt?: Date;
}

export interface PostQueryOptions {
  postType?: string;
  status?: string | string[];
  authorId?: number;
  termId?: number;
  year?: number;
  month?: number;
  search?: string;
  slug?: string;
  parentId?: number | null;
  orderBy?: "id" | "title" | "date" | "menu_order";
  order?: "asc" | "desc";
  limit?: number;
  offset?: number;
}

export interface ContentScope {
  siteId?: number;
}

type PostRow = typeof posts.$inferSelect;

// ─── Service ───────────────────────────────────────────────

export class ContentService {
  private primarySiteId: number | null = null;
  private legacySingleSiteMode = false;

  constructor(private db: Database) {}

  private isMissingMultisiteSchemaError(error: unknown): boolean {
    const message = error instanceof Error ? error.message : String(error);
    const causeMessage =
      error instanceof Error && error.cause
        ? error.cause instanceof Error
          ? error.cause.message
          : String(error.cause)
        : "";
    const text = `${message}\n${causeMessage}`;
    return (
      text.includes('relation "sites" does not exist') ||
      text.includes('column "site_id" does not exist')
    );
  }

  private async getPrimarySiteId(): Promise<number> {
    if (this.legacySingleSiteMode) {
      return 1;
    }
    if (this.primarySiteId !== null) {
      return this.primarySiteId;
    }

    let primary;
    try {
      [primary] = await this.db
        .select({ id: sites.id })
        .from(sites)
        .where(eq(sites.isPrimary, true))
        .limit(1);
    } catch (error) {
      if (this.isMissingMultisiteSchemaError(error)) {
        this.legacySingleSiteMode = true;
        return 1;
      }
      throw error;
    }

    if (!primary) {
      throw new Error("Primary site is not configured");
    }

    this.primarySiteId = primary.id;
    return primary.id;
  }

  private async resolveSiteId(
    input?: { siteId?: number } | undefined,
    scope?: ContentScope
  ): Promise<number> {
    if (scope?.siteId !== undefined) {
      return scope.siteId;
    }
    if (input?.siteId !== undefined) {
      return input.siteId;
    }
    return this.getPrimarySiteId();
  }

  private selectLegacyPosts() {
    return this.db.select({
      id: posts.id,
      siteId: sql<number>`1`,
      authorId: posts.authorId,
      postType: posts.postType,
      title: posts.title,
      slug: posts.slug,
      content: posts.content,
      excerpt: posts.excerpt,
      status: posts.status,
      commentStatus: posts.commentStatus,
      parentId: posts.parentId,
      menuOrder: posts.menuOrder,
      meta: posts.meta,
      publishedAt: posts.publishedAt,
      createdAt: posts.createdAt,
      updatedAt: posts.updatedAt,
    });
  }

  // ─── Create ────────────────────────────────────────────

  async createPost(input: CreatePostInput, scope?: ContentScope) {
    // Validate input with Zod schema
    const siteId = await this.resolveSiteId(input, scope);
    const { siteId: _siteId, ...inputWithoutSiteId } = input;
    const parsed = CreatePostSchema.parse(inputWithoutSiteId);

    const postType = parsed.postType ?? "post";

    if (!getPostType(postType)) {
      throw new ValidationError(`Post type "${postType}" is not registered`);
    }

    const slug = parsed.slug || generateSlug(parsed.title);
    const uniqueSlug = await this.ensureUniqueSlug(slug, postType, siteId);

    // Apply filters to content before saving
    const title = await hooks.applyFilters("the_title", parsed.title);
    const content = await hooks.applyFilters(
      "the_content",
      parsed.content ?? ""
    );

    const status: PostStatus = parsed.status ?? "draft";

    const postValues = {
      authorId: parsed.authorId,
      postType,
      title,
      slug: uniqueSlug,
      content,
      excerpt: parsed.excerpt ?? "",
      status,
      commentStatus: parsed.commentStatus ?? "open",
      parentId: parsed.parentId,
      menuOrder: parsed.menuOrder ?? 0,
      meta: parsed.meta ?? {},
      publishedAt:
        status === "publish" ? parsed.publishedAt ?? new Date() : null,
    };

    const [post] = await this.db
      .insert(posts)
      .values(
        this.legacySingleSiteMode
          ? (postValues as never)
          : ({ siteId, ...postValues } as never)
      )
      .returning();

    await hooks.doAction("save_post", post, true /* isNew */);

    if (post.status === "publish") {
      await hooks.doAction("publish_post", post);
    }

    return post;
  }

  // ─── Read ──────────────────────────────────────────────

  async getPostById(id: number, scope?: ContentScope) {
    const siteId = await this.resolveSiteId(undefined, scope);
    let post;
    try {
      [post] = this.legacySingleSiteMode
        ? await this.selectLegacyPosts().from(posts).where(eq(posts.id, id)).limit(1)
        : await this.db
            .select()
            .from(posts)
            .where(and(eq(posts.id, id), eq(posts.siteId, siteId)))
            .limit(1);
    } catch (error) {
      if (!this.legacySingleSiteMode && this.isMissingMultisiteSchemaError(error)) {
        this.legacySingleSiteMode = true;
        [post] = await this.selectLegacyPosts().from(posts).where(eq(posts.id, id)).limit(1);
      } else {
        throw error;
      }
    }

    if (!post) throw new NotFoundError("Post", id);
    return post;
  }

  async getPostBySlug(slug: string, postType: string = "post", scope?: ContentScope) {
    const siteId = await this.resolveSiteId(undefined, scope);
    let post;
    try {
      [post] = this.legacySingleSiteMode
        ? await this.selectLegacyPosts()
            .from(posts)
            .where(and(eq(posts.slug, slug), eq(posts.postType, postType)))
            .limit(1)
        : await this.db
            .select()
            .from(posts)
            .where(
              and(
                eq(posts.slug, slug),
                eq(posts.postType, postType),
                eq(posts.siteId, siteId)
              )
            )
            .limit(1);
    } catch (error) {
      if (!this.legacySingleSiteMode && this.isMissingMultisiteSchemaError(error)) {
        this.legacySingleSiteMode = true;
        [post] = await this.selectLegacyPosts()
          .from(posts)
          .where(and(eq(posts.slug, slug), eq(posts.postType, postType)))
          .limit(1);
      } else {
        throw error;
      }
    }

    return post ?? null;
  }

  async queryPosts(
    opts: PostQueryOptions = {},
    scope?: ContentScope
  ): Promise<{ posts: PostRow[]; total: number; limit: number; offset: number }> {
    // Validate input with Zod schema
    const parsed = PostQuerySchema.parse(opts);
    const siteId = await this.resolveSiteId(undefined, scope);

    const {
      postType = "post",
      status,
      authorId,
      termId,
      year,
      month,
      search,
      slug,
      parentId,
      orderBy = "date",
      order = "desc",
      offset = 0,
    } = parsed;

    // Cap limit to 100
    const limit = Math.min(parsed.limit ?? 20, 100);

    const conditions = [eq(posts.postType, postType)];
    if (!this.legacySingleSiteMode) {
      conditions.push(eq(posts.siteId, siteId));
    }

    if (status) {
      if (Array.isArray(status)) {
        // Drizzle's inArray expects the enum's value type; status strings are
        // validated by PostQuerySchema but arrive as string[]. The cast is
        // required because Drizzle's pgEnum column type is narrower than string.
        conditions.push(
          inArray(posts.status, status as [PostStatus, ...PostStatus[]])
        );
      } else {
        conditions.push(eq(posts.status, status as PostStatus));
      }
    }
    if (authorId) conditions.push(eq(posts.authorId, authorId));
    if (termId) conditions.push(eq(postTerms.termId, termId));
    if (slug) conditions.push(eq(posts.slug, slug));
    if (search) {
      const pattern = `%${escapeLike(search)}%`;
      const searchCondition = or(
        like(posts.title, pattern),
        like(posts.content, pattern),
        like(posts.excerpt, pattern)
      );
      if (searchCondition) conditions.push(searchCondition);
    }
    if (parentId !== undefined) {
      if (parentId === null) {
        conditions.push(isNull(posts.parentId));
      } else {
        conditions.push(eq(posts.parentId, parentId));
      }
    }
    if (year !== undefined) {
      conditions.push(
        sql`EXTRACT(YEAR FROM COALESCE(${posts.publishedAt}, ${posts.createdAt})) = ${year}`
      );
    }
    if (month !== undefined) {
      conditions.push(
        sql`EXTRACT(MONTH FROM COALESCE(${posts.publishedAt}, ${posts.createdAt})) = ${month}`
      );
    }

    const orderCol = {
      id: posts.id,
      title: posts.title,
      date: posts.publishedAt,
      menu_order: posts.menuOrder,
    }[orderBy] ?? posts.publishedAt;

    const orderFn = order === "desc" ? desc : asc;

    let rows;
    let countResult;
    try {
      rows = await this.db
        .selectDistinct({ post: posts })
        .from(posts)
        .leftJoin(postTerms, eq(posts.id, postTerms.postId))
        .where(and(...conditions))
        .orderBy(orderFn(orderCol))
        .limit(limit)
        .offset(offset);

      [countResult] = await this.db
        .select({ count: sql<number>`count(distinct ${posts.id})::int` })
        .from(posts)
        .leftJoin(postTerms, eq(posts.id, postTerms.postId))
        .where(and(...conditions));
    } catch (error) {
      if (!this.legacySingleSiteMode && this.isMissingMultisiteSchemaError(error)) {
        this.legacySingleSiteMode = true;
        return this.queryPosts(opts, scope);
      }
      throw error;
    }

    return {
      posts: rows.map((row) => row.post),
      total: countResult.count,
      limit,
      offset,
    };
  }

  // ─── Update ────────────────────────────────────────────

  async updatePost(id: number, input: UpdatePostInput, scope?: ContentScope) {
    // Validate input with Zod schema
    const parsed = UpdatePostSchema.parse(input);

    const existing = await this.getPostById(id, scope);

    // Create revision before updating
    await this.createRevision(existing);

    const updates: Record<string, unknown> = { updatedAt: new Date() };

    if (parsed.title !== undefined) {
      updates.title = await hooks.applyFilters("the_title", parsed.title);
    }
    if (parsed.content !== undefined) {
      updates.content = await hooks.applyFilters("the_content", parsed.content);
    }
    if (parsed.excerpt !== undefined) updates.excerpt = parsed.excerpt;
    if (parsed.status !== undefined) {
      const status: PostStatus = parsed.status;
      updates.status = status;
      if (status === "publish" && existing.status !== "publish") {
        updates.publishedAt = parsed.publishedAt ?? new Date();
      }
    }
    if (parsed.slug !== undefined) {
      updates.slug = await this.ensureUniqueSlug(
        parsed.slug,
        existing.postType,
        existing.siteId,
        id
      );
    }
    if (parsed.parentId !== undefined) updates.parentId = parsed.parentId;
    if (parsed.menuOrder !== undefined) updates.menuOrder = parsed.menuOrder;
    if (parsed.commentStatus !== undefined)
      updates.commentStatus = parsed.commentStatus;
    if (parsed.meta !== undefined) updates.meta = parsed.meta;

    const [updated] = await this.db
      .update(posts)
      .set(updates)
      .where(
        this.legacySingleSiteMode
          ? eq(posts.id, id)
          : and(eq(posts.id, id), eq(posts.siteId, existing.siteId))
      )
      .returning();

    await hooks.doAction("save_post", updated, false /* isNew */);

    // Fire transition hooks
    if (parsed.status && parsed.status !== existing.status) {
      await hooks.doAction(
        "transition_post_status",
        parsed.status,
        existing.status,
        updated
      );
      if (parsed.status === "publish") {
        await hooks.doAction("publish_post", updated);
      }
    }

    return updated;
  }

  // ─── Delete / Trash ────────────────────────────────────

  async trashPost(id: number, scope?: ContentScope) {
    const post = await this.getPostById(id, scope);
    if (post.status === "trash") return post;

    // Store original status in meta so we can restore
    const meta = (post.meta as Record<string, unknown>) ?? {};
    meta._pre_trash_status = post.status;

    const [trashed] = await this.db
      .update(posts)
      .set({
        status: "trash" as PostStatus,
        meta,
        updatedAt: new Date(),
      })
      .where(
        this.legacySingleSiteMode
          ? eq(posts.id, id)
          : and(eq(posts.id, id), eq(posts.siteId, post.siteId))
      )
      .returning();

    await hooks.doAction("trash_post", trashed);
    return trashed;
  }

  async restorePost(id: number, scope?: ContentScope) {
    const post = await this.getPostById(id, scope);
    if (post.status !== "trash") return post;

    const meta = (post.meta as Record<string, unknown>) ?? {};
    const rawStatus = (meta._pre_trash_status as string) ?? "draft";

    // Validate restored status is one of the allowed post statuses
    if (!RESTORABLE_STATUSES.has(rawStatus)) {
      throw new ValidationError(
        `Cannot restore post: stored status "${rawStatus}" is not a valid restorable status`
      );
    }
    const originalStatus = rawStatus as PostStatus;

    delete meta._pre_trash_status;

    const [restored] = await this.db
      .update(posts)
      .set({ status: originalStatus, meta, updatedAt: new Date() })
      .where(
        this.legacySingleSiteMode
          ? eq(posts.id, id)
          : and(eq(posts.id, id), eq(posts.siteId, post.siteId))
      )
      .returning();

    await hooks.doAction("untrash_post", restored);
    return restored;
  }

  async deletePost(id: number, scope?: ContentScope) {
    const post = await this.getPostById(id, scope);
    await hooks.doAction("before_delete_post", post);

    // Wrap all deletes in a transaction for atomicity
    await this.db.transaction(async (tx) => {
      // Delete term relationships
      await tx.delete(postTerms).where(eq(postTerms.postId, id));
      // Delete revisions
      await tx.delete(postRevisions).where(eq(postRevisions.postId, id));
      // Delete post
      await tx.delete(posts).where(eq(posts.id, id));
    });

    await hooks.doAction("delete_post", post);
    return true;
  }

  // ─── Revisions ─────────────────────────────────────────

  private async createRevision(post: typeof posts.$inferSelect) {
    await this.db.insert(postRevisions).values({
      postId: post.id,
      authorId: post.authorId,
      title: post.title,
      content: post.content,
      excerpt: post.excerpt,
      meta: post.meta as Record<string, unknown>,
    });
  }

  async getRevisions(postId: number) {
    return this.db
      .select()
      .from(postRevisions)
      .where(eq(postRevisions.postId, postId))
      .orderBy(desc(postRevisions.createdAt));
  }

  // ─── Terms ─────────────────────────────────────────────

  async setPostTerms(postId: number, termIds: number[]) {
    // Wrap delete + insert in a transaction for atomicity
    await this.db.transaction(async (tx) => {
      // Remove existing
      await tx.delete(postTerms).where(eq(postTerms.postId, postId));

      // Insert new
      if (termIds.length > 0) {
        await tx.insert(postTerms).values(
          termIds.map((termId) => ({ postId, termId }))
        );
      }
    });
  }

  async getPostTerms(postId: number) {
    const rows = await this.db
      .select({ term: terms })
      .from(postTerms)
      .innerJoin(terms, eq(postTerms.termId, terms.id))
      .where(eq(postTerms.postId, postId));

    return rows.map((r) => r.term);
  }

  // ─── Status Counts ─────────────────────────────────────

  async getStatusCounts(
    postType: string = "post",
    scope?: ContentScope
  ): Promise<Record<string, number>> {
    const siteId = await this.resolveSiteId(undefined, scope);
    let result;
    try {
      result = await this.db
        .select({
          status: posts.status,
          count: sql<number>`count(*)::int`,
        })
        .from(posts)
        .where(
          this.legacySingleSiteMode
            ? eq(posts.postType, postType)
            : and(eq(posts.postType, postType), eq(posts.siteId, siteId))
        )
        .groupBy(posts.status);
    } catch (error) {
      if (!this.legacySingleSiteMode && this.isMissingMultisiteSchemaError(error)) {
        this.legacySingleSiteMode = true;
        return this.getStatusCounts(postType, scope);
      }
      throw error;
    }

    const counts: Record<string, number> = {};
    for (const row of result) {
      counts[row.status] = row.count;
    }
    return counts;
  }

  async getArchiveOptions(
    postType: string = "post",
    scope?: ContentScope
  ): Promise<Array<{ value: string; label: string; count: number }>> {
    const siteId = await this.resolveSiteId(undefined, scope);
    let rows;
    try {
      rows = await this.db
        .select({
          value: sql<string>`to_char(coalesce(${posts.publishedAt}, ${posts.createdAt}), 'YYYY-MM')`,
          label: sql<string>`to_char(coalesce(${posts.publishedAt}, ${posts.createdAt}), 'Mon YYYY')`,
          count: sql<number>`count(*)::int`,
        })
        .from(posts)
        .where(
          and(
            eq(posts.postType, postType),
            sql`${posts.status} <> 'trash'`,
            ...(this.legacySingleSiteMode ? [] : [eq(posts.siteId, siteId)])
          )
        )
        .groupBy(
          sql`to_char(coalesce(${posts.publishedAt}, ${posts.createdAt}), 'YYYY-MM')`,
          sql`to_char(coalesce(${posts.publishedAt}, ${posts.createdAt}), 'Mon YYYY')`
        )
        .orderBy(
          desc(sql`to_char(coalesce(${posts.publishedAt}, ${posts.createdAt}), 'YYYY-MM')`)
        );
    } catch (error) {
      if (!this.legacySingleSiteMode && this.isMissingMultisiteSchemaError(error)) {
        this.legacySingleSiteMode = true;
        return this.getArchiveOptions(postType, scope);
      }
      throw error;
    }

    return rows;
  }

  async getListDetails(postIds: number[]) {
    if (postIds.length === 0) {
      return {
        authors: {} as Record<number, string>,
        comments: {} as Record<number, number>,
        terms: {} as Record<number, { categories: string[]; tags: string[] }>,
      };
    }

    const [authorRows, commentRows, termRows] = await Promise.all([
      this.db
        .select({
          postId: posts.id,
          authorName: users.displayName,
        })
        .from(posts)
        .innerJoin(users, eq(posts.authorId, users.id))
        .where(inArray(posts.id, postIds)),
      this.db
        .select({
          postId: comments.postId,
          count: sql<number>`count(*)::int`,
        })
        .from(comments)
        .where(inArray(comments.postId, postIds))
        .groupBy(comments.postId),
      this.db
        .select({
          postId: postTerms.postId,
          termName: terms.name,
          taxonomySlug: taxonomies.slug,
        })
        .from(postTerms)
        .innerJoin(terms, eq(postTerms.termId, terms.id))
        .innerJoin(taxonomies, eq(terms.taxonomyId, taxonomies.id))
        .where(inArray(postTerms.postId, postIds)),
    ]);

    const authors = Object.fromEntries(
      authorRows.map((row) => [row.postId, row.authorName])
    ) as Record<number, string>;

    const commentCounts = Object.fromEntries(
      commentRows.map((row) => [row.postId, row.count])
    ) as Record<number, number>;

    const termsByPost: Record<number, { categories: string[]; tags: string[] }> = {};

    for (const row of termRows) {
      const current = termsByPost[row.postId] ?? {
        categories: [],
        tags: [],
      };

      if (row.taxonomySlug === "category") {
        current.categories.push(row.termName);
      } else if (row.taxonomySlug === "post_tag") {
        current.tags.push(row.termName);
      }

      termsByPost[row.postId] = current;
    }

    return {
      authors,
      comments: commentCounts,
      terms: termsByPost,
    };
  }

  // ─── Helpers ───────────────────────────────────────────

  /** Maximum iterations when searching for a unique slug suffix. */
  private static readonly MAX_SLUG_ATTEMPTS = 100;

  private async ensureUniqueSlug(
    slug: string,
    postType: string,
    siteId: number,
    excludeId?: number
  ): Promise<string> {
    let candidate = slug;
    let suffix = 2;

    for (
      let attempt = 0;
      attempt < ContentService.MAX_SLUG_ATTEMPTS;
      attempt++
    ) {
      const conditions = [
        eq(posts.slug, candidate),
        eq(posts.postType, postType),
        ...(this.legacySingleSiteMode ? [] : [eq(posts.siteId, siteId)]),
      ];

      let existing;
      try {
        [existing] = await this.db
          .select({ id: posts.id })
          .from(posts)
          .where(and(...conditions))
          .limit(1);
      } catch (error) {
        if (!this.legacySingleSiteMode && this.isMissingMultisiteSchemaError(error)) {
          this.legacySingleSiteMode = true;
          return this.ensureUniqueSlug(slug, postType, siteId, excludeId);
        }
        throw error;
      }

      if (!existing || (excludeId !== undefined && existing.id === excludeId)) {
        return candidate;
      }

      candidate = `${slug}-${suffix}`;
      suffix++;
    }

    throw new ValidationError(
      `Could not generate a unique slug for "${slug}" after ${ContentService.MAX_SLUG_ATTEMPTS} attempts`
    );
  }
}
