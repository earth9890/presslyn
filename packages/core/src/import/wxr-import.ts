/**
 * WordPress eXtended RSS (WXR) importer.
 *
 * `parseWxr` is a pure function that turns a WXR XML string into a normalized
 * structure (easily unit-tested). `importWxr` orchestrates the core services
 * to persist that structure, mapping authors to existing users and creating
 * any missing terms. Imports are idempotent at the item level: an item whose
 * slug already exists for its post type is skipped.
 */

import { XMLParser } from "fast-xml-parser";
import type { ContentService } from "../content/index.js";
import type { TaxonomyService } from "../taxonomy/index.js";
import type { CommentsService } from "../comments/index.js";
import type { UsersService } from "../users/index.js";

export interface ParsedWxrAuthor {
  login: string;
  email: string;
  displayName: string;
}

export interface ParsedWxrTerm {
  slug: string;
  name: string;
  parentSlug?: string;
}

export interface ParsedWxrComment {
  authorName: string;
  authorEmail: string;
  content: string;
  approved: boolean;
}

export interface ParsedWxrItem {
  title: string;
  slug: string;
  content: string;
  excerpt: string;
  status: string;
  type: string;
  authorLogin: string;
  commentStatus: string;
  categories: { slug: string; name: string }[];
  tags: { slug: string; name: string }[];
  comments: ParsedWxrComment[];
}

export interface ParsedWxr {
  authors: ParsedWxrAuthor[];
  categories: ParsedWxrTerm[];
  tags: ParsedWxrTerm[];
  items: ParsedWxrItem[];
}

export interface ImportSummary {
  posts: number;
  pages: number;
  categories: number;
  tags: number;
  comments: number;
  skipped: number;
}

const POST_STATUSES = new Set(["draft", "publish", "pending", "private"]);

function toArray<T>(value: T | T[] | undefined | null): T[] {
  if (value === undefined || value === null) return [];
  return Array.isArray(value) ? value : [value];
}

/** Resolve the text content of a node that may be a string or `{ "#text" }`. */
function textOf(node: unknown): string {
  if (node === undefined || node === null) return "";
  if (typeof node === "string") return node;
  if (typeof node === "number" || typeof node === "boolean") return String(node);
  if (typeof node === "object" && "#text" in (node as Record<string, unknown>)) {
    const t = (node as Record<string, unknown>)["#text"];
    return t === undefined || t === null ? "" : String(t);
  }
  return "";
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/**
 * Parse a WXR XML string into a normalized structure. Throws if the document
 * is not a recognizable RSS/WXR envelope.
 */
export function parseWxr(xml: string): ParsedWxr {
  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: "@_",
    parseTagValue: false,
    trimValues: true,
  });

  const doc = parser.parse(xml) as Record<string, any>;
  const channel = doc?.rss?.channel;
  if (!channel) {
    throw new Error("Invalid WXR: missing <rss><channel> root.");
  }

  const authors: ParsedWxrAuthor[] = toArray(channel["wp:author"]).map((a: any) => ({
    login: textOf(a["wp:author_login"]),
    email: textOf(a["wp:author_email"]),
    displayName:
      textOf(a["wp:author_display_name"]) || textOf(a["wp:author_login"]),
  }));

  const categories: ParsedWxrTerm[] = toArray(channel["wp:category"]).map(
    (c: any) => {
      const name = textOf(c["wp:cat_name"]);
      const parent = textOf(c["wp:category_parent"]);
      return {
        slug: textOf(c["wp:category_nicename"]) || slugify(name),
        name,
        parentSlug: parent || undefined,
      };
    }
  );

  const tags: ParsedWxrTerm[] = toArray(channel["wp:tag"]).map((t: any) => {
    const name = textOf(t["wp:tag_name"]);
    return { slug: textOf(t["wp:tag_slug"]) || slugify(name), name };
  });

  const items: ParsedWxrItem[] = toArray(channel.item).map((item: any) => {
    const cats: { slug: string; name: string }[] = [];
    const itemTags: { slug: string; name: string }[] = [];

    for (const cat of toArray(item.category)) {
      const name = textOf(cat);
      const domain = typeof cat === "object" ? cat["@_domain"] : undefined;
      const nicename = typeof cat === "object" ? cat["@_nicename"] : undefined;
      const entry = { slug: String(nicename ?? slugify(name)), name };
      if (domain === "post_tag") itemTags.push(entry);
      else cats.push(entry);
    }

    const comments: ParsedWxrComment[] = toArray(item["wp:comment"]).map(
      (cm: any) => ({
        authorName: textOf(cm["wp:comment_author"]),
        authorEmail: textOf(cm["wp:comment_author_email"]),
        content: textOf(cm["wp:comment_content"]),
        approved: textOf(cm["wp:comment_approved"]) === "1",
      })
    );

    const title = textOf(item.title);
    return {
      title,
      slug: textOf(item["wp:post_name"]) || slugify(title),
      content: textOf(item["content:encoded"]),
      excerpt: textOf(item["excerpt:encoded"]),
      status: textOf(item["wp:status"]) || "draft",
      type: textOf(item["wp:post_type"]) || "post",
      authorLogin: textOf(item["dc:creator"]),
      commentStatus: textOf(item["wp:comment_status"]) || "open",
      categories: cats,
      tags: itemTags,
      comments,
    };
  });

  return { authors, categories, tags, items };
}

export interface ImportDeps {
  content: ContentService;
  taxonomy: TaxonomyService;
  comments: CommentsService;
  users: UsersService;
}

export interface ImportOptions {
  /** Author used when an item's author cannot be matched to a user. */
  defaultAuthorId: number;
}

/**
 * Import parsed WXR data through the core services. Only "post" and "page"
 * item types are imported; statuses outside the supported set fall back to
 * "draft". Existing slugs are skipped so re-running is safe.
 */
export async function importWxr(
  parsed: ParsedWxr,
  deps: ImportDeps,
  options: ImportOptions
): Promise<ImportSummary> {
  const summary: ImportSummary = {
    posts: 0,
    pages: 0,
    categories: 0,
    tags: 0,
    comments: 0,
    skipped: 0,
  };

  // 1. Terms — ensure every category/tag exists; build name->id maps.
  const categoryIdByName = new Map<string, number>();
  const tagIdByName = new Map<string, number>();

  await ensureTerms(deps.taxonomy, "category", parsed.categories, categoryIdByName, () => {
    summary.categories++;
  });
  await ensureTerms(deps.taxonomy, "post_tag", parsed.tags, tagIdByName, () => {
    summary.tags++;
  });

  // 2. Author map — match existing users by login (username).
  const authorIdByLogin = new Map<string, number>();
  for (const a of parsed.authors) {
    if (!a.login) continue;
    try {
      const user = await deps.users.getUserByUsername(a.login);
      if (user) authorIdByLogin.set(a.login, user.id);
    } catch {
      /* unmatched author — will fall back to defaultAuthorId */
    }
  }

  // 3. Items.
  for (const item of parsed.items) {
    if (item.type !== "post" && item.type !== "page") {
      summary.skipped++;
      continue;
    }

    // Idempotency: skip if the slug already exists for this type.
    try {
      const existing = await deps.content.getPostBySlug(item.slug, item.type);
      if (existing) {
        summary.skipped++;
        continue;
      }
    } catch {
      /* not found — proceed to create */
    }

    const status = POST_STATUSES.has(item.status) ? item.status : "draft";
    const authorId =
      authorIdByLogin.get(item.authorLogin) ?? options.defaultAuthorId;

    const created = await deps.content.createPost({
      authorId,
      postType: item.type,
      title: item.title,
      content: item.content,
      excerpt: item.excerpt,
      status: status as "draft" | "publish" | "pending" | "private",
      slug: item.slug,
      commentStatus: item.commentStatus === "closed" ? "closed" : "open",
    });

    if (item.type === "page") summary.pages++;
    else summary.posts++;

    // Assign terms (creating any item-level terms not declared at channel level).
    const termIds: number[] = [];
    for (const cat of item.categories) {
      const id = await resolveTerm(deps.taxonomy, "category", cat, categoryIdByName);
      if (id) termIds.push(id);
    }
    for (const tag of item.tags) {
      const id = await resolveTerm(deps.taxonomy, "post_tag", tag, tagIdByName);
      if (id) termIds.push(id);
    }
    if (termIds.length > 0) {
      await deps.content.setPostTerms(created.id, termIds);
    }

    // Comments.
    for (const cm of item.comments) {
      if (!cm.content) continue;
      const comment = await deps.comments.createComment({
        postId: created.id,
        authorName: cm.authorName || "Anonymous",
        authorEmail: cm.authorEmail || undefined,
        content: cm.content,
      });
      if (cm.approved) {
        await deps.comments.approveComment(comment.id);
      }
      summary.comments++;
    }
  }

  return summary;
}

async function ensureTerms(
  taxonomy: TaxonomyService,
  taxonomySlug: string,
  terms: ParsedWxrTerm[],
  idByName: Map<string, number>,
  onCreate: () => void
): Promise<void> {
  // Seed the map with existing terms so we don't recreate them.
  const existing = await taxonomy.getTermsWithCounts(taxonomySlug).catch(() => []);
  for (const t of existing) idByName.set(t.name, t.id);

  for (const term of terms) {
    if (idByName.has(term.name)) continue;
    try {
      const created = await taxonomy.createTerm({
        taxonomySlug,
        name: term.name,
        slug: term.slug,
      });
      idByName.set(term.name, created.id);
      onCreate();
    } catch {
      /* slug collision or invalid — skip this term */
    }
  }
}

async function resolveTerm(
  taxonomy: TaxonomyService,
  taxonomySlug: string,
  term: { slug: string; name: string },
  idByName: Map<string, number>
): Promise<number | null> {
  const existing = idByName.get(term.name);
  if (existing) return existing;
  try {
    const created = await taxonomy.createTerm({
      taxonomySlug,
      name: term.name,
      slug: term.slug,
    });
    idByName.set(term.name, created.id);
    return created.id;
  } catch {
    return null;
  }
}
