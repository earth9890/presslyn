/**
 * Site-level helpers: cached site settings and small formatting utilities
 * shared across the public templates.
 */

import { services } from "./services";

export interface SiteSettings {
  title: string;
  description: string;
  url: string;
  postsPerPage: number;
  language: string;
}

/**
 * Resolve the site settings from the options store, falling back to sensible
 * defaults so the site renders even on a fresh install. Reads happen once per
 * request; the options service has its own autoload cache underneath.
 */
export async function getSiteSettings(): Promise<SiteSettings> {
  const [title, description, url, perPage] = await Promise.all([
    services.options.getOption("blogname").catch(() => null),
    services.options.getOption("blogdescription").catch(() => null),
    services.options.getOption("siteurl").catch(() => null),
    services.options.getOption("posts_per_page").catch(() => null),
  ]);

  const perPageNum = Number(perPage);

  return {
    title: title ? String(title) : "Presslyn",
    description: description ? String(description) : "Powered by Presslyn CMS",
    url: url ? String(url).replace(/\/$/, "") : "http://localhost:3000",
    postsPerPage: Number.isFinite(perPageNum) && perPageNum > 0 ? perPageNum : 10,
    language: "en-US",
  };
}

export function formatDate(value: Date | string | null): string {
  if (!value) return "";
  return new Date(value).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export function isoDate(value: Date | string | null): string {
  if (!value) return "";
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? "" : d.toISOString();
}

/** Build a plain-text excerpt from HTML content. */
export function excerptFrom(html: string, maxWords = 40): string {
  const text = html
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  const words = text.split(" ").filter(Boolean);
  if (words.length <= maxWords) return text;
  return words.slice(0, maxWords).join(" ") + "…";
}
