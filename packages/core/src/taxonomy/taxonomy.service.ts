/**
 * Taxonomy Service
 *
 * WordPress equivalent: wp-includes/taxonomy.php (5,159 lines)
 * Manages categories, tags, and custom taxonomies.
 */

import { eq, and, like, desc, asc, sql, isNull } from "drizzle-orm";
import { type Database } from "@presslyn/database";
import { taxonomies, terms, postTerms, posts, sites } from "@presslyn/database";
import { hooks } from "../hooks.js";
import { NotFoundError, ValidationError } from "../errors.js";
import {
  CreateTaxonomySchema,
  CreateTermSchema,
  UpdateTermSchema,
  TermQuerySchema,
} from "../schemas.js";
import { escapeLike, generateSlug } from "../utils.js";

// ─── Types ─────────────────────────────────────────────────

export interface CreateTaxonomyInput {
  name: string;
  slug: string;
  description?: string;
  hierarchical?: boolean;
}

export interface CreateTermInput {
  taxonomySlug: string;
  name: string;
  slug?: string;
  description?: string;
  parentId?: number;
}

export interface UpdateTermInput {
  name?: string;
  slug?: string;
  description?: string;
  parentId?: number | null;
}

export type TermTreeNode = {
  id: number;
  name: string;
  slug: string;
  description: string;
  parentId: number | null;
  children: TermTreeNode[];
};

export interface TermQueryOptions {
  taxonomySlug: string;
  parentId?: number | null;
  search?: string;
  orderBy?: "id" | "name" | "slug";
  order?: "asc" | "desc";
  limit?: number;
  offset?: number;
}

export interface TaxonomyScope {
  siteId?: number;
}

type TermRow = typeof terms.$inferSelect;
type CreateTermRow = typeof terms.$inferInsert;

/**
 * Maximum number of terms that getTermTree will load.
 * Taxonomies exceeding this limit will cause an error to prevent
 * unbounded memory usage when building the in-memory tree.
 */
const TERM_TREE_MAX = 5000;

// ─── Service ───────────────────────────────────────────────

export class TaxonomyService {
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
    if (this.legacySingleSiteMode) return 1;
    if (this.primarySiteId !== null) return this.primarySiteId;

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

  private async resolveSiteId(scope?: TaxonomyScope): Promise<number> {
    if (scope?.siteId !== undefined) return scope.siteId;
    return this.getPrimarySiteId();
  }

  /** Explicit term columns with synthetic siteId — for legacy single-site mode. */
  private legacyTermColumns() {
    return {
      id: terms.id,
      siteId: sql<number>`1`,
      taxonomyId: terms.taxonomyId,
      name: terms.name,
      slug: terms.slug,
      description: terms.description,
      parentId: terms.parentId,
      meta: terms.meta,
    };
  }

  private selectLegacyTerms() {
    return this.db.select(this.legacyTermColumns());
  }

  private async validateParentTerm(
    parentId: number | undefined | null,
    taxonomyId: number,
    scope?: TaxonomyScope
  ): Promise<void> {
    if (parentId === undefined || parentId === null) {
      return;
    }

    const parent = await this.getTermById(parentId, scope);
    if (parent.taxonomyId !== taxonomyId) {
      throw new ValidationError("Parent term must belong to the same taxonomy");
    }
  }

  // ─── Taxonomies ────────────────────────────────────────

  async getTaxonomy(slug: string) {
    const [tax] = await this.db
      .select()
      .from(taxonomies)
      .where(eq(taxonomies.slug, slug))
      .limit(1);

    if (!tax) throw new NotFoundError("Taxonomy", slug);
    return tax;
  }

  async getAllTaxonomies() {
    return this.db.select().from(taxonomies);
  }

  async createTaxonomy(input: CreateTaxonomyInput) {
    // Validate input with Zod schema
    const parsed = CreateTaxonomySchema.parse(input);

    const [existing] = await this.db
      .select({ id: taxonomies.id })
      .from(taxonomies)
      .where(eq(taxonomies.slug, parsed.slug))
      .limit(1);

    if (existing) throw new ValidationError(`Taxonomy "${parsed.slug}" already exists`);

    const [tax] = await this.db
      .insert(taxonomies)
      .values({
        name: parsed.name,
        slug: parsed.slug,
        description: parsed.description ?? "",
        hierarchical: parsed.hierarchical ?? false,
      })
      .returning();

    return tax;
  }

  // ─── Terms ─────────────────────────────────────────────

  async createTerm(input: CreateTermInput, scope?: TaxonomyScope): Promise<TermRow> {
    // Validate input with Zod schema
    const parsed = CreateTermSchema.parse(input);
    const siteId = await this.resolveSiteId(scope);

    const taxonomy = await this.getTaxonomy(parsed.taxonomySlug);

    if (parsed.parentId && !taxonomy.hierarchical) {
      throw new ValidationError(
        `Taxonomy "${parsed.taxonomySlug}" is not hierarchical — terms cannot have parents`
      );
    }

    await this.validateParentTerm(parsed.parentId, taxonomy.id, scope);

    const slug = parsed.slug || generateSlug(parsed.name);

    // Check uniqueness within taxonomy
    let existing;
    try {
      [existing] = await this.db
        .select({ id: terms.id })
        .from(terms)
        .where(
          and(
            eq(terms.slug, slug),
            eq(terms.taxonomyId, taxonomy.id),
            ...(this.legacySingleSiteMode ? [] : [eq(terms.siteId, siteId)])
          )
        )
        .limit(1);
    } catch (error) {
      if (!this.legacySingleSiteMode && this.isMissingMultisiteSchemaError(error)) {
        this.legacySingleSiteMode = true;
        return this.createTerm(input, scope);
      }
      throw error;
    }

    if (existing) throw new ValidationError(`Term slug "${slug}" already exists in this taxonomy`);

    const values = {
      siteId,
      taxonomyId: taxonomy.id,
      name: parsed.name,
      slug,
      description: parsed.description ?? "",
      parentId: parsed.parentId,
    } satisfies CreateTermRow;

    const [term] = await this.db
      .insert(terms)
      .values(
        this.legacySingleSiteMode
          ? ({
              taxonomyId: taxonomy.id,
              name: parsed.name,
              slug,
              description: parsed.description ?? "",
              parentId: parsed.parentId,
            } as never)
          : values
      )
      .returning();

    await hooks.doAction("create_term", term, taxonomy);
    return term;
  }

  async getTermById(id: number, scope?: TaxonomyScope) {
    const siteId = await this.resolveSiteId(scope);
    let term;
    try {
      [term] = this.legacySingleSiteMode
        ? await this.selectLegacyTerms().from(terms).where(eq(terms.id, id)).limit(1)
        : await this.db
            .select()
            .from(terms)
            .where(and(eq(terms.id, id), eq(terms.siteId, siteId)))
            .limit(1);
    } catch (error) {
      if (!this.legacySingleSiteMode && this.isMissingMultisiteSchemaError(error)) {
        this.legacySingleSiteMode = true;
        [term] = await this.selectLegacyTerms().from(terms).where(eq(terms.id, id)).limit(1);
      } else {
        throw error;
      }
    }

    if (!term) throw new NotFoundError("Term", id);
    return term;
  }

  async getTermBySlug(
    slug: string,
    taxonomySlug: string,
    scope?: TaxonomyScope
  ): Promise<TermRow | null> {
    const siteId = await this.resolveSiteId(scope);
    const taxonomy = await this.getTaxonomy(taxonomySlug);

    let term;
    try {
      [term] = this.legacySingleSiteMode
        ? await this.selectLegacyTerms()
            .from(terms)
            .where(and(eq(terms.slug, slug), eq(terms.taxonomyId, taxonomy.id)))
            .limit(1)
        : await this.db
            .select()
            .from(terms)
            .where(
              and(eq(terms.slug, slug), eq(terms.taxonomyId, taxonomy.id), eq(terms.siteId, siteId))
            )
            .limit(1);
    } catch (error) {
      if (!this.legacySingleSiteMode && this.isMissingMultisiteSchemaError(error)) {
        this.legacySingleSiteMode = true;
        [term] = await this.selectLegacyTerms()
          .from(terms)
          .where(and(eq(terms.slug, slug), eq(terms.taxonomyId, taxonomy.id)))
          .limit(1);
      } else {
        throw error;
      }
    }

    return term ?? null;
  }

  async updateTerm(id: number, input: UpdateTermInput, scope?: TaxonomyScope) {
    // Validate input with Zod schema
    const parsed = UpdateTermSchema.parse(input);

    const existing = await this.getTermById(id, scope); // Throws if not found

    if (parsed.parentId === id) {
      throw new ValidationError("Term cannot be its own parent");
    }

    await this.validateParentTerm(parsed.parentId, existing.taxonomyId, scope);

    // Validate slug uniqueness when slug is being changed
    if (parsed.slug !== undefined && parsed.slug !== existing.slug) {
      const [duplicate] = await this.db
        .select({ id: terms.id })
        .from(terms)
        .where(
          and(
            eq(terms.slug, parsed.slug),
            eq(terms.taxonomyId, existing.taxonomyId),
            ...(this.legacySingleSiteMode ? [] : [eq(terms.siteId, existing.siteId)])
          )
        )
        .limit(1);

      if (duplicate) {
        throw new ValidationError(
          `Term slug "${parsed.slug}" already exists in this taxonomy`
        );
      }
    }

    const updates: Record<string, unknown> = {};
    if (parsed.name !== undefined) updates.name = parsed.name;
    if (parsed.slug !== undefined) updates.slug = parsed.slug;
    if (parsed.description !== undefined) updates.description = parsed.description;
    if (parsed.parentId !== undefined) updates.parentId = parsed.parentId;

    const [updated] = await this.db
      .update(terms)
      .set(updates)
      .where(
        this.legacySingleSiteMode
          ? eq(terms.id, id)
          : and(eq(terms.id, id), eq(terms.siteId, existing.siteId))
      )
      .returning();

    await hooks.doAction("edit_term", updated);
    return updated;
  }

  async deleteTerm(id: number, scope?: TaxonomyScope) {
    const term = await this.getTermById(id, scope);

    // Wrap all operations in a transaction for atomicity
    await this.db.transaction(async (tx) => {
      // Remove post associations
      await tx.delete(postTerms).where(eq(postTerms.termId, id));
      // Re-parent children to this term's parent
      await tx
        .update(terms)
        .set({ parentId: term.parentId })
        .where(
          this.legacySingleSiteMode
            ? eq(terms.parentId, id)
            : and(eq(terms.parentId, id), eq(terms.siteId, term.siteId))
        );
      // Delete term
      await tx
        .delete(terms)
        .where(
          this.legacySingleSiteMode
            ? eq(terms.id, id)
            : and(eq(terms.id, id), eq(terms.siteId, term.siteId))
        );
    });

    await hooks.doAction("delete_term", term);
    return true;
  }

  async queryTerms(
    opts: TermQueryOptions,
    scope?: TaxonomyScope
  ): Promise<{ terms: TermRow[]; total: number }> {
    // Validate input with Zod schema
    const parsed = TermQuerySchema.parse(opts);
    const siteId = await this.resolveSiteId(scope);

    const {
      taxonomySlug,
      parentId,
      search,
      orderBy = "name",
      order = "asc",
      offset = 0,
    } = parsed;

    // Cap limit to 1000
    const limit = Math.min(parsed.limit ?? 100, 1000);

    const taxonomy = await this.getTaxonomy(taxonomySlug);
    const conditions = [eq(terms.taxonomyId, taxonomy.id)];
    if (!this.legacySingleSiteMode) {
      conditions.push(eq(terms.siteId, siteId));
    }

    if (parentId !== undefined) {
      if (parentId === null) {
        conditions.push(isNull(terms.parentId));
      } else {
        conditions.push(eq(terms.parentId, parentId));
      }
    }
    if (search) {
      conditions.push(like(terms.name, `%${escapeLike(search)}%`));
    }

    const orderCol = {
      id: terms.id,
      name: terms.name,
      slug: terms.slug,
    }[orderBy] ?? terms.name;

    const orderFn = order === "desc" ? desc : asc;

    let rows;
    let countResult;
    try {
      rows = await this.db
        .select()
        .from(terms)
        .where(and(...conditions))
        .orderBy(orderFn(orderCol))
        .limit(limit)
        .offset(offset);

      [countResult] = await this.db
        .select({ count: sql<number>`count(*)::int` })
        .from(terms)
        .where(and(...conditions));
    } catch (error) {
      if (!this.legacySingleSiteMode && this.isMissingMultisiteSchemaError(error)) {
        this.legacySingleSiteMode = true;
        return this.queryTerms(opts, scope);
      }
      throw error;
    }

    return { terms: rows, total: countResult.count };
  }

  /**
   * Get term with post count.
   */
  async getTermsWithCounts(
    taxonomySlug: string,
    scope?: TaxonomyScope
  ): Promise<Array<TermRow & { count: number }>> {
    const siteId = await this.resolveSiteId(scope);
    const taxonomy = await this.getTaxonomy(taxonomySlug);

    let result;
    try {
      result = await this.db
        .select({
          term: this.legacySingleSiteMode ? this.legacyTermColumns() : terms,
          count: sql<number>`count(${posts.id})::int`,
        })
        .from(terms)
        .leftJoin(postTerms, eq(terms.id, postTerms.termId))
        .leftJoin(
          posts,
          this.legacySingleSiteMode
            ? eq(postTerms.postId, posts.id)
            : and(eq(postTerms.postId, posts.id), eq(posts.siteId, siteId))
        )
        .where(
          and(
            eq(terms.taxonomyId, taxonomy.id),
            ...(this.legacySingleSiteMode ? [] : [eq(terms.siteId, siteId)])
          )
        )
        .groupBy(terms.id)
        .orderBy(asc(terms.name));
    } catch (error) {
      if (!this.legacySingleSiteMode && this.isMissingMultisiteSchemaError(error)) {
        this.legacySingleSiteMode = true;
        return this.getTermsWithCounts(taxonomySlug, scope);
      }
      throw error;
    }

    return result.map((r) => ({ ...r.term, count: r.count }));
  }

  /**
   * Get hierarchical tree (for categories).
   *
   * Loads all terms for the taxonomy into memory and assembles a tree.
   * Limited to TERM_TREE_MAX (5 000) terms — taxonomies exceeding this
   * limit will throw a ValidationError to prevent unbounded memory use.
   */
  async getTermTree(
    taxonomySlug: string,
    scope?: TaxonomyScope
  ): Promise<TermTreeNode[]> {
    const siteId = await this.resolveSiteId(scope);
    // First, count terms to enforce the safety limit
    const taxonomy = await this.getTaxonomy(taxonomySlug);
    let countResult;
    try {
      [countResult] = await this.db
        .select({ count: sql<number>`count(*)::int` })
        .from(terms)
        .where(
          and(
            eq(terms.taxonomyId, taxonomy.id),
            ...(this.legacySingleSiteMode ? [] : [eq(terms.siteId, siteId)])
          )
        );
    } catch (error) {
      if (!this.legacySingleSiteMode && this.isMissingMultisiteSchemaError(error)) {
        this.legacySingleSiteMode = true;
        return this.getTermTree(taxonomySlug, scope);
      }
      throw error;
    }

    if (countResult.count > TERM_TREE_MAX) {
      throw new ValidationError(
        `Taxonomy "${taxonomySlug}" has ${countResult.count} terms, exceeding the tree limit of ${TERM_TREE_MAX}. ` +
          `Use queryTerms with pagination instead.`
      );
    }

    const { terms: allTerms } = await this.queryTerms({
      taxonomySlug,
      limit: TERM_TREE_MAX,
    }, scope);

    const nodeMap = new Map<number, TermTreeNode>();
    const roots: TermTreeNode[] = [];

    for (const t of allTerms) {
      nodeMap.set(t.id, { ...t, children: [] });
    }

    for (const t of allTerms) {
      const node = nodeMap.get(t.id)!;
      if (t.parentId && nodeMap.has(t.parentId)) {
        nodeMap.get(t.parentId)!.children.push(node);
      } else {
        roots.push(node);
      }
    }

    return roots;
  }
}
