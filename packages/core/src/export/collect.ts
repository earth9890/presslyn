/**
 * Assemble {@link WxrData} from the live core services. Shared by the REST
 * export endpoint and the CLI so the export shape stays in one place.
 */

import type { ContentService } from "../content/index.js";
import type { TaxonomyService } from "../taxonomy/index.js";
import type { CommentsService } from "../comments/index.js";
import type { UsersService } from "../users/index.js";
import type { OptionsService } from "../options/index.js";
import type { WxrData, WxrItem, WxrComment } from "./wxr.js";

export interface CollectDeps {
  options: OptionsService;
  content: ContentService;
  taxonomy: TaxonomyService;
  comments: CommentsService;
  users: UsersService;
}

const EXPORT_STATUSES = ["publish", "draft", "pending", "private"];
/** List endpoints cap `limit` at 100, so gather large sets page by page. */
const PAGE_SIZE = 100;
const MAX_ITEMS = 5000;

/**
 * Page through a list endpoint (whose `limit` is capped at 100) until the
 * full set is collected or {@link MAX_ITEMS} is reached.
 */
async function fetchAll<T>(
  fetchPage: (limit: number, offset: number) => Promise<{ rows: T[]; total: number }>
): Promise<T[]> {
  const out: T[] = [];
  let offset = 0;
  // First page also tells us the total.
  while (out.length < MAX_ITEMS) {
    const { rows, total } = await fetchPage(PAGE_SIZE, offset);
    out.push(...rows);
    offset += PAGE_SIZE;
    if (out.length >= total || rows.length < PAGE_SIZE) break;
  }
  return out.slice(0, MAX_ITEMS);
}

function toIso(value: Date | string | null): string {
  if (!value) return new Date(0).toISOString();
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/**
 * Build the complete WXR data set for an export. `generatedAt` is passed in
 * (the core has no clock access) so callers stamp the timestamp.
 */
export async function collectWxrData(
  deps: CollectDeps,
  generatedAt: string
): Promise<WxrData> {
  const [blogname, blogdescription, siteurl, categories, tags, users] =
    await Promise.all([
      deps.options.getOption("blogname").catch(() => "Presslyn"),
      deps.options.getOption("blogdescription").catch(() => ""),
      deps.options.getOption("siteurl").catch(() => ""),
      deps.taxonomy.getTermsWithCounts("category").catch(() => []),
      deps.taxonomy.getTermsWithCounts("post_tag").catch(() => []),
      fetchAll((limit, offset) =>
        deps.users
          .listUsers({ limit, offset })
          .then((r) => ({ rows: r.users, total: r.total }))
          .catch(() => ({ rows: [], total: 0 }))
      ),
    ]);

  const catById = new Map(categories.map((t) => [t.id, t]));
  const catSlugByName = new Map(categories.map((t) => [t.name, t.slug]));
  const tagSlugByName = new Map(tags.map((t) => [t.name, t.slug]));
  const authorLoginById = new Map(users.map((u) => [u.id, u.username]));

  const [postRows, pageRows] = await Promise.all([
    fetchAll((limit, offset) =>
      deps.content
        .queryPosts({
          postType: "post",
          status: EXPORT_STATUSES,
          limit,
          offset,
          orderBy: "id",
          order: "asc",
        })
        .then((r) => ({ rows: r.posts, total: r.total }))
    ),
    fetchAll((limit, offset) =>
      deps.content
        .queryPosts({
          postType: "page",
          status: EXPORT_STATUSES,
          limit,
          offset,
          orderBy: "id",
          order: "asc",
        })
        .then((r) => ({ rows: r.posts, total: r.total }))
    ),
  ]);

  const allPosts = [...postRows, ...pageRows];
  const details = await deps.content.getListDetails(allPosts.map((p) => p.id));
  const base = String(siteurl ?? "").replace(/\/$/, "");

  const items: WxrItem[] = [];
  for (const post of allPosts) {
    const termNames = details.terms[post.id] ?? { categories: [], tags: [] };
    const commentCount = details.comments[post.id] ?? 0;

    let comments: WxrComment[] = [];
    if (commentCount > 0) {
      const rows = await fetchAll((limit, offset) =>
        deps.comments
          .queryComments({
            postId: post.id,
            orderBy: "date",
            order: "asc",
            limit,
            offset,
          })
          .then((r) => ({ rows: r.comments, total: r.total }))
      );
      comments = rows.map((cm) => ({
        id: cm.id,
        authorName: cm.authorName ?? "",
        authorEmail: cm.authorEmail ?? "",
        content: cm.content,
        date: toIso(cm.createdAt),
        approved: cm.approved,
      }));
    }

    items.push({
      postId: post.id,
      title: post.title,
      link: `${base}/${post.slug}`,
      date: toIso(post.publishedAt ?? post.createdAt),
      authorLogin: authorLoginById.get(post.authorId) ?? "admin",
      content: post.content,
      excerpt: post.excerpt,
      status: post.status,
      type: post.postType,
      slug: post.slug,
      commentStatus: post.commentStatus ?? "open",
      categories: termNames.categories.map((name) => ({
        slug: catSlugByName.get(name) ?? slugify(name),
        name,
      })),
      tags: termNames.tags.map((name) => ({
        slug: tagSlugByName.get(name) ?? slugify(name),
        name,
      })),
      comments,
    });
  }

  return {
    site: {
      title: String(blogname ?? "Presslyn"),
      description: String(blogdescription ?? ""),
      link: base,
      language: "en-US",
    },
    authors: users.map((u) => ({
      id: u.id,
      login: u.username,
      email: u.email,
      displayName: u.displayName,
    })),
    categories: categories.map((t) => ({
      slug: t.slug,
      name: t.name,
      parentSlug: t.parentId ? catById.get(t.parentId)?.slug : undefined,
    })),
    tags: tags.map((t) => ({ slug: t.slug, name: t.name })),
    items,
    generatedAt,
  };
}
