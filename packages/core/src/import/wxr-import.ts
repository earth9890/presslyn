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
import type { MediaService } from "../media/index.js";

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

export interface ParsedWxrAttachment {
  /** Source URL of the original file (wp:attachment_url, falling back to guid). */
  url: string;
  title: string;
  slug: string;
}

export interface ParsedWxr {
  authors: ParsedWxrAuthor[];
  categories: ParsedWxrTerm[];
  tags: ParsedWxrTerm[];
  items: ParsedWxrItem[];
  attachments: ParsedWxrAttachment[];
}

export interface ImportSummary {
  posts: number;
  pages: number;
  categories: number;
  tags: number;
  comments: number;
  media: number;
  skipped: number;
}

const POST_STATUSES = new Set(["draft", "publish", "pending", "private"]);

/** A parsed XML element from fast-xml-parser (untyped key/value bag). */
type XmlNode = Record<string, unknown>;

function toArray<T>(value: T | T[] | undefined | null): T[] {
  if (value === undefined || value === null) return [];
  return Array.isArray(value) ? value : [value];
}

/** Normalize a possibly-single/possibly-array XML child into an XmlNode[]. */
function asNodes(value: unknown): XmlNode[] {
  return toArray(value).filter(
    (v): v is XmlNode => typeof v === "object" && v !== null
  );
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

  const doc = parser.parse(xml) as Record<string, unknown>;
  const rss = doc?.rss as XmlNode | undefined;
  const channel = rss?.channel as XmlNode | undefined;
  if (!channel) {
    throw new Error("Invalid WXR: missing <rss><channel> root.");
  }

  const authors: ParsedWxrAuthor[] = asNodes(channel["wp:author"]).map((a) => ({
    login: textOf(a["wp:author_login"]),
    email: textOf(a["wp:author_email"]),
    displayName:
      textOf(a["wp:author_display_name"]) || textOf(a["wp:author_login"]),
  }));

  const categories: ParsedWxrTerm[] = asNodes(channel["wp:category"]).map(
    (c) => {
      const name = textOf(c["wp:cat_name"]);
      const parent = textOf(c["wp:category_parent"]);
      return {
        slug: textOf(c["wp:category_nicename"]) || slugify(name),
        name,
        parentSlug: parent || undefined,
      };
    }
  );

  const tags: ParsedWxrTerm[] = asNodes(channel["wp:tag"]).map((t) => {
    const name = textOf(t["wp:tag_name"]);
    return { slug: textOf(t["wp:tag_slug"]) || slugify(name), name };
  });

  const attachments: ParsedWxrAttachment[] = [];

  const items: ParsedWxrItem[] = [];
  for (const item of asNodes(channel.item)) {
    const itemType = textOf(item["wp:post_type"]) || "post";

    // Attachments carry the media URL; collect them separately and don't
    // treat them as content items.
    if (itemType === "attachment") {
      const url =
        textOf(item["wp:attachment_url"]) || textOf(item.guid) || "";
      if (url) {
        const title = textOf(item.title);
        attachments.push({
          url,
          title,
          slug: textOf(item["wp:post_name"]) || slugify(title),
        });
      }
      continue;
    }

    const cats: { slug: string; name: string }[] = [];
    const itemTags: { slug: string; name: string }[] = [];

    for (const cat of toArray(item.category)) {
      const name = textOf(cat);
      const attrs =
        cat && typeof cat === "object" ? (cat as XmlNode) : undefined;
      const domain = attrs?.["@_domain"];
      const nicename = attrs?.["@_nicename"];
      const entry = {
        slug: String(nicename ?? slugify(name)),
        name,
      };
      if (domain === "post_tag") itemTags.push(entry);
      else cats.push(entry);
    }

    const comments: ParsedWxrComment[] = asNodes(item["wp:comment"]).map(
      (cm) => ({
        authorName: textOf(cm["wp:comment_author"]),
        authorEmail: textOf(cm["wp:comment_author_email"]),
        content: textOf(cm["wp:comment_content"]),
        approved: textOf(cm["wp:comment_approved"]) === "1",
      })
    );

    const title = textOf(item.title);
    items.push({
      title,
      slug: textOf(item["wp:post_name"]) || slugify(title),
      content: textOf(item["content:encoded"]),
      excerpt: textOf(item["excerpt:encoded"]),
      status: textOf(item["wp:status"]) || "draft",
      type: itemType,
      authorLogin: textOf(item["dc:creator"]),
      commentStatus: textOf(item["wp:comment_status"]) || "open",
      categories: cats,
      tags: itemTags,
      comments,
    });
  }

  return { authors, categories, tags, items, attachments };
}

export interface ImportDeps {
  content: ContentService;
  taxonomy: TaxonomyService;
  comments: CommentsService;
  users: UsersService;
  /** Required only when {@link ImportOptions.importMedia} is enabled. */
  media?: MediaService;
}

/** Minimal fetch signature so tests can inject a stub downloader. */
export type FetchLike = (
  url: string
) => Promise<{
  ok: boolean;
  status: number;
  headers: { get(name: string): string | null };
  arrayBuffer(): Promise<ArrayBuffer>;
}>;

export interface ImportOptions {
  /** Author used when an item's author cannot be matched to a user. */
  defaultAuthorId: number;
  /**
   * Download attachment files referenced by the WXR and re-link their URLs in
   * imported content. Requires `deps.media`. Off by default.
   */
  importMedia?: boolean;
  /** Fetch implementation for downloads (defaults to global fetch). */
  fetch?: FetchLike;
  /** Per-file download cap in bytes (default 25MB). */
  maxMediaBytes?: number;
}

const DEFAULT_MAX_MEDIA_BYTES = 25 * 1024 * 1024;

/** Guess a MIME type from a URL's file extension. */
function mimeFromUrl(url: string): string | undefined {
  const ext = url.split(/[?#]/)[0]!.split(".").pop()?.toLowerCase();
  const map: Record<string, string> = {
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    png: "image/png",
    gif: "image/gif",
    webp: "image/webp",
    avif: "image/avif",
    pdf: "application/pdf",
    mp3: "audio/mpeg",
    ogg: "audio/ogg",
    wav: "audio/wav",
    mp4: "video/mp4",
    webm: "video/webm",
  };
  return ext ? map[ext] : undefined;
}

/**
 * SSRF guard for attacker-supplied attachment URLs. Allows only http(s) to
 * non-internal hosts, blocking loopback, private ranges, link-local, and the
 * cloud metadata endpoint (169.254.169.254). Literal-IP/hostname based — note
 * this does not defend against DNS rebinding, which would need resolve-time
 * checks; it stops the common metadata/localhost/private-literal exploits.
 */
function isSafePublicHostname(hostname: string): boolean {
  const h = hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (!h || h === "localhost" || h.endsWith(".localhost")) return false;
  if (h === "0.0.0.0" || h === "::" || h === "::1") return false;

  const v4 = h.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (v4) {
    const a = Number(v4[1]);
    const b = Number(v4[2]);
    if (a === 0 || a === 127) return false; // unspecified / loopback
    if (a === 10) return false; // private
    if (a === 172 && b >= 16 && b <= 31) return false; // private
    if (a === 192 && b === 168) return false; // private
    if (a === 169 && b === 254) return false; // link-local + metadata
  }

  // IPv6 loopback / link-local (fe80::/10) / unique-local (fc00::/7)
  if (h.startsWith("fe8") || h.startsWith("fe9") || h.startsWith("fea") ||
      h.startsWith("feb") || h.startsWith("fc") || h.startsWith("fd")) {
    return false;
  }
  return true;
}

/** Whether a remote attachment URL is safe for the importer to fetch. */
function isSafeRemoteUrl(raw: string): boolean {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return false;
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") return false;
  return isSafePublicHostname(url.hostname);
}

/** Filename (basename) from a URL path. */
function filenameFromUrl(url: string): string {
  try {
    const u = new URL(url);
    const base = u.pathname.split("/").filter(Boolean).pop();
    return base || "upload";
  } catch {
    const base = url.split(/[?#]/)[0]!.split("/").filter(Boolean).pop();
    return base || "upload";
  }
}

/**
 * Escape a string for safe use inside a RegExp.
 */
function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Replace every old attachment URL in `text` with its imported counterpart.
 * Longest URLs are replaced first so a URL that is a prefix of another doesn't
 * partially rewrite it.
 */
function relinkUrls(text: string, urlMap: Map<string, string>): string {
  if (!text || urlMap.size === 0) return text;
  let result = text;
  const entries = [...urlMap.entries()].sort(
    (a, b) => b[0].length - a[0].length
  );
  for (const [oldUrl, newUrl] of entries) {
    result = result.replace(new RegExp(escapeRegExp(oldUrl), "g"), newUrl);
  }
  return result;
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
    media: 0,
    skipped: 0,
  };

  // 0. Media — download attachments and build an old-URL → new-URL map used
  //    to re-link references inside imported content.
  const urlMap = new Map<string, string>();
  if (options.importMedia && deps.media && parsed.attachments.length > 0) {
    const fetchImpl: FetchLike =
      options.fetch ?? (globalThis.fetch as unknown as FetchLike);
    const maxBytes = options.maxMediaBytes ?? DEFAULT_MAX_MEDIA_BYTES;

    for (const attachment of parsed.attachments) {
      try {
        // SSRF guard: never fetch internal/metadata/private hosts.
        if (!isSafeRemoteUrl(attachment.url)) continue;

        const res = await fetchImpl(attachment.url);
        if (!res.ok) continue;

        // Reject oversized downloads up-front via Content-Length when present.
        const declared = Number(res.headers.get("content-length") ?? "");
        if (Number.isFinite(declared) && declared > maxBytes) continue;

        const buf = Buffer.from(await res.arrayBuffer());
        if (buf.length === 0 || buf.length > maxBytes) continue;

        const mimeType =
          res.headers.get("content-type")?.split(";")[0]?.trim() ||
          mimeFromUrl(attachment.url) ||
          "application/octet-stream";

        const record = await deps.media.upload({
          uploaderId: options.defaultAuthorId,
          filename: filenameFromUrl(attachment.url),
          mimeType,
          buffer: buf,
          title: attachment.title || undefined,
        });

        urlMap.set(attachment.url, record.url);
        summary.media++;
      } catch {
        /* unreachable URL, invalid file, etc. — skip this attachment */
      }
    }
  }

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
      content: relinkUrls(item.content, urlMap),
      excerpt: relinkUrls(item.excerpt, urlMap),
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
      try {
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
      } catch {
        // A single bad/blocked comment (e.g. the imported post has comments
        // closed) must not abort the whole import — skip it and continue.
        summary.skipped++;
      }
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
