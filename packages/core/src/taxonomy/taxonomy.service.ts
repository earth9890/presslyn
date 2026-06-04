/**
 * Taxonomy Service
 *
 * WordPress equivalent: wp-includes/taxonomy.php (5,159 lines)
 * Manages categories, tags, and custom taxonomies.
 */

import { eq, and, like, desc, asc, sql, isNull } from "drizzle-orm";
import { type Database } from "@presslyn/database";
import { taxonomies, terms, postTerms } from "@presslyn/database";
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

/**
 * Maximum number of terms that getTermTree will load.
 * Taxonomies exceeding this limit will cause an error to prevent
 * unbounded memory usage when building the in-memory tree.
 */
const TERM_TREE_MAX = 5000;

// ─── Service ───────────────────────────────────────────────

export class TaxonomyService {
  constructor(private db: Database) {}

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

  async createTerm(input: CreateTermInput) {
    // Validate input with Zod schema
    const parsed = CreateTermSchema.parse(input);

    const taxonomy = await this.getTaxonomy(parsed.taxonomySlug);

    if (parsed.parentId && !taxonomy.hierarchical) {
      throw new ValidationError(
        `Taxonomy "${parsed.taxonomySlug}" is not hierarchical — terms cannot have parents`
      );
    }

    const slug = parsed.slug || generateSlug(parsed.name);

    // Check uniqueness within taxonomy
    const [existing] = await this.db
      .select({ id: terms.id })
      .from(terms)
      .where(
        and(eq(terms.slug, slug), eq(terms.taxonomyId, taxonomy.id))
      )
      .limit(1);

    if (existing) throw new ValidationError(`Term slug "${slug}" already exists in this taxonomy`);

    const [term] = await this.db
      .insert(terms)
      .values({
        taxonomyId: taxonomy.id,
        name: parsed.name,
        slug,
        description: parsed.description ?? "",
        parentId: parsed.parentId,
      })
      .returning();

    await hooks.doAction("create_term", term, taxonomy);
    return term;
  }

  async getTermById(id: number) {
    const [term] = await this.db
      .select()
      .from(terms)
      .where(eq(terms.id, id))
      .limit(1);

    if (!term) throw new NotFoundError("Term", id);
    return term;
  }

  async getTermBySlug(slug: string, taxonomySlug: string) {
    const taxonomy = await this.getTaxonomy(taxonomySlug);

    const [term] = await this.db
      .select()
      .from(terms)
      .where(and(eq(terms.slug, slug), eq(terms.taxonomyId, taxonomy.id)))
      .limit(1);

    return term ?? null;
  }

  async updateTerm(id: number, input: UpdateTermInput) {
    // Validate input with Zod schema
    const parsed = UpdateTermSchema.parse(input);

    const existing = await this.getTermById(id); // Throws if not found

    // Validate slug uniqueness when slug is being changed
    if (parsed.slug !== undefined && parsed.slug !== existing.slug) {
      const [duplicate] = await this.db
        .select({ id: terms.id })
        .from(terms)
        .where(
          and(
            eq(terms.slug, parsed.slug),
            eq(terms.taxonomyId, existing.taxonomyId)
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
      .where(eq(terms.id, id))
      .returning();

    await hooks.doAction("edit_term", updated);
    return updated;
  }

  async deleteTerm(id: number) {
    const term = await this.getTermById(id);

    // Wrap all operations in a transaction for atomicity
    await this.db.transaction(async (tx) => {
      // Remove post associations
      await tx.delete(postTerms).where(eq(postTerms.termId, id));
      // Re-parent children to this term's parent
      await tx
        .update(terms)
        .set({ parentId: term.parentId })
        .where(eq(terms.parentId, id));
      // Delete term
      await tx.delete(terms).where(eq(terms.id, id));
    });

    await hooks.doAction("delete_term", term);
    return true;
  }

  async queryTerms(opts: TermQueryOptions) {
    // Validate input with Zod schema
    const parsed = TermQuerySchema.parse(opts);

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

    const rows = await this.db
      .select()
      .from(terms)
      .where(and(...conditions))
      .orderBy(orderFn(orderCol))
      .limit(limit)
      .offset(offset);

    const [countResult] = await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(terms)
      .where(and(...conditions));

    return { terms: rows, total: countResult.count };
  }

  /**
   * Get term with post count.
   */
  async getTermsWithCounts(taxonomySlug: string) {
    const taxonomy = await this.getTaxonomy(taxonomySlug);

    const result = await this.db
      .select({
        term: terms,
        count: sql<number>`count(${postTerms.postId})::int`,
      })
      .from(terms)
      .leftJoin(postTerms, eq(terms.id, postTerms.termId))
      .where(eq(terms.taxonomyId, taxonomy.id))
      .groupBy(terms.id)
      .orderBy(asc(terms.name));

    return result.map((r) => ({ ...r.term, count: r.count }));
  }

  /**
   * Get hierarchical tree (for categories).
   *
   * Loads all terms for the taxonomy into memory and assembles a tree.
   * Limited to TERM_TREE_MAX (5 000) terms — taxonomies exceeding this
   * limit will throw a ValidationError to prevent unbounded memory use.
   */
  async getTermTree(taxonomySlug: string) {
    // First, count terms to enforce the safety limit
    const taxonomy = await this.getTaxonomy(taxonomySlug);
    const [countResult] = await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(terms)
      .where(eq(terms.taxonomyId, taxonomy.id));

    if (countResult.count > TERM_TREE_MAX) {
      throw new ValidationError(
        `Taxonomy "${taxonomySlug}" has ${countResult.count} terms, exceeding the tree limit of ${TERM_TREE_MAX}. ` +
          `Use queryTerms with pagination instead.`
      );
    }

    const { terms: allTerms } = await this.queryTerms({
      taxonomySlug,
      limit: TERM_TREE_MAX,
    });

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
