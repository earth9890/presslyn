/**
 * WordPress eXtended RSS (WXR) generator.
 *
 * Produces an XML document compatible with the WordPress importer so
 * Presslyn content can be migrated into (or out of) WordPress installs.
 * This module is a PURE function over already-fetched data — it performs no
 * I/O — which keeps it trivially testable and reusable by both the REST
 * export endpoint and the CLI.
 *
 * WXR is RSS 2.0 extended with the WordPress namespaces (wp:, content:,
 * dc:, excerpt:). Human-authored text (titles, content, excerpts) is wrapped
 * in CDATA; attribute and element values outside CDATA are XML-escaped.
 */

export const WXR_VERSION = "1.2";

export interface WxrAuthor {
  id: number;
  login: string;
  email: string;
  displayName: string;
}

export interface WxrTermRef {
  slug: string;
  name: string;
}

export interface WxrCategory extends WxrTermRef {
  parentSlug?: string;
}

export interface WxrComment {
  id: number;
  authorName: string;
  authorEmail: string;
  content: string;
  date: string; // ISO
  approved: boolean;
}

export interface WxrItem {
  postId: number;
  title: string;
  link: string;
  date: string; // ISO
  authorLogin: string;
  content: string;
  excerpt: string;
  status: string;
  type: string; // post | page
  slug: string;
  commentStatus: string; // open | closed
  categories: WxrTermRef[];
  tags: WxrTermRef[];
  comments: WxrComment[];
}

export interface WxrData {
  site: {
    title: string;
    description: string;
    link: string;
    language?: string;
  };
  authors: WxrAuthor[];
  categories: WxrCategory[];
  tags: WxrTermRef[];
  items: WxrItem[];
  /** Stamped into the export header; pass from the caller (no clock in core). */
  generatedAt: string;
}

/** Escape text for use in XML element/attribute content (outside CDATA). */
export function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/**
 * Wrap text in a CDATA section, defusing the only sequence that can close
 * one (`]]>`) by splitting it across two CDATA blocks.
 */
export function cdata(value: string): string {
  return `<![CDATA[${value.replace(/]]>/g, "]]]]><![CDATA[>")}]]>`;
}

function rfc822(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toUTCString();
}

/** WordPress stores post_date as "YYYY-MM-DD HH:MM:SS". */
function sqlDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toISOString().slice(0, 19).replace("T", " ");
}

/**
 * Build a complete WXR document from already-fetched site data.
 */
export function buildWxr(data: WxrData): string {
  const { site, authors, categories, tags, items } = data;

  const lines: string[] = [];
  lines.push('<?xml version="1.0" encoding="UTF-8"?>');
  lines.push(
    `<!-- Presslyn WXR export — generated ${escapeXml(data.generatedAt)} -->`
  );
  lines.push(
    '<rss version="2.0"' +
      ' xmlns:excerpt="http://wordpress.org/export/1.2/excerpt/"' +
      ' xmlns:content="http://purl.org/rss/1.0/modules/content/"' +
      ' xmlns:wfw="http://wellformedweb.org/CommentAPI/"' +
      ' xmlns:dc="http://purl.org/dc/elements/1.1/"' +
      ' xmlns:wp="http://wordpress.org/export/1.2/">'
  );
  lines.push("<channel>");
  lines.push(`  <title>${escapeXml(site.title)}</title>`);
  lines.push(`  <link>${escapeXml(site.link)}</link>`);
  lines.push(`  <description>${escapeXml(site.description)}</description>`);
  lines.push(`  <pubDate>${rfc822(data.generatedAt)}</pubDate>`);
  lines.push(`  <language>${escapeXml(site.language ?? "en-US")}</language>`);
  lines.push(`  <wp:wxr_version>${WXR_VERSION}</wp:wxr_version>`);
  lines.push(`  <wp:base_site_url>${escapeXml(site.link)}</wp:base_site_url>`);
  lines.push(`  <wp:base_blog_url>${escapeXml(site.link)}</wp:base_blog_url>`);

  // Authors
  for (const a of authors) {
    lines.push("  <wp:author>");
    lines.push(`    <wp:author_id>${a.id}</wp:author_id>`);
    lines.push(`    <wp:author_login>${cdata(a.login)}</wp:author_login>`);
    lines.push(`    <wp:author_email>${cdata(a.email)}</wp:author_email>`);
    lines.push(
      `    <wp:author_display_name>${cdata(a.displayName)}</wp:author_display_name>`
    );
    lines.push("  </wp:author>");
  }

  // Categories
  for (const cat of categories) {
    lines.push("  <wp:category>");
    lines.push(`    <wp:category_nicename>${cdata(cat.slug)}</wp:category_nicename>`);
    lines.push(
      `    <wp:category_parent>${cdata(cat.parentSlug ?? "")}</wp:category_parent>`
    );
    lines.push(`    <wp:cat_name>${cdata(cat.name)}</wp:cat_name>`);
    lines.push("  </wp:category>");
  }

  // Tags
  for (const tag of tags) {
    lines.push("  <wp:tag>");
    lines.push(`    <wp:tag_slug>${cdata(tag.slug)}</wp:tag_slug>`);
    lines.push(`    <wp:tag_name>${cdata(tag.name)}</wp:tag_name>`);
    lines.push("  </wp:tag>");
  }

  // Items (posts + pages)
  for (const item of items) {
    lines.push("  <item>");
    lines.push(`    <title>${cdata(item.title)}</title>`);
    lines.push(`    <link>${escapeXml(item.link)}</link>`);
    lines.push(`    <pubDate>${rfc822(item.date)}</pubDate>`);
    lines.push(`    <dc:creator>${cdata(item.authorLogin)}</dc:creator>`);
    lines.push(`    <content:encoded>${cdata(item.content)}</content:encoded>`);
    lines.push(`    <excerpt:encoded>${cdata(item.excerpt)}</excerpt:encoded>`);
    lines.push(`    <wp:post_id>${item.postId}</wp:post_id>`);
    lines.push(`    <wp:post_date>${cdata(sqlDate(item.date))}</wp:post_date>`);
    lines.push(`    <wp:post_name>${cdata(item.slug)}</wp:post_name>`);
    lines.push(`    <wp:status>${cdata(item.status)}</wp:status>`);
    lines.push(`    <wp:post_type>${cdata(item.type)}</wp:post_type>`);
    lines.push(`    <wp:comment_status>${cdata(item.commentStatus)}</wp:comment_status>`);

    for (const cat of item.categories) {
      lines.push(
        `    <category domain="category" nicename="${escapeXml(cat.slug)}">${cdata(cat.name)}</category>`
      );
    }
    for (const tag of item.tags) {
      lines.push(
        `    <category domain="post_tag" nicename="${escapeXml(tag.slug)}">${cdata(tag.name)}</category>`
      );
    }

    for (const comment of item.comments) {
      lines.push("    <wp:comment>");
      lines.push(`      <wp:comment_id>${comment.id}</wp:comment_id>`);
      lines.push(`      <wp:comment_author>${cdata(comment.authorName)}</wp:comment_author>`);
      lines.push(
        `      <wp:comment_author_email>${cdata(comment.authorEmail)}</wp:comment_author_email>`
      );
      lines.push(`      <wp:comment_date>${cdata(sqlDate(comment.date))}</wp:comment_date>`);
      lines.push(`      <wp:comment_content>${cdata(comment.content)}</wp:comment_content>`);
      lines.push(
        `      <wp:comment_approved>${cdata(comment.approved ? "1" : "0")}</wp:comment_approved>`
      );
      lines.push("    </wp:comment>");
    }

    lines.push("  </item>");
  }

  lines.push("</channel>");
  lines.push("</rss>");
  return lines.join("\n");
}
