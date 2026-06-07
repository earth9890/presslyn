/**
 * Site-level helpers: cached site settings and small formatting utilities
 * shared across the public templates.
 */

import { cache } from "react";
import { headers } from "next/headers";
import { services } from "./services";

export interface SiteSettings {
  title: string;
  description: string;
  url: string;
  postsPerPage: number;
  language: string;
}

interface ResolvedSiteMeta {
  title?: string;
  siteTitle?: string;
  blogname?: string;
  description?: string;
  blogdescription?: string;
  siteurl?: string;
  home?: string;
  url?: string;
  language?: string;
  activeTheme?: string;
  activeThemeId?: string;
  themeStyleVariationId?: string;
}

export interface ResolvedSiteContext {
  id: number;
  name: string;
  domain: string;
  path: string;
  meta: ResolvedSiteMeta;
  url: string;
}

function firstMetaString(meta: ResolvedSiteMeta, keys: Array<keyof ResolvedSiteMeta>) {
  for (const key of keys) {
    const value = meta[key];
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }
  return null;
}

function normalizePublicUrl(url: string) {
  return url.replace(/\/$/, "");
}

function buildSiteUrl(domain: string, path: string, protocol: string) {
  const base = `${protocol}://${domain}`;
  if (path === "/") {
    return base;
  }
  return `${base}${path.replace(/\/$/, "")}`;
}

const getRequestSiteInput = cache(async () => {
  const headerStore = await headers();
  const rawHost =
    headerStore.get("x-presslyn-host") ??
    headerStore.get("x-forwarded-host") ??
    headerStore.get("host") ??
    "localhost:3000";
  const rawPath = headerStore.get("x-presslyn-pathname") ?? "/";
  const rawProtocol =
    headerStore.get("x-presslyn-proto") ??
    headerStore.get("x-forwarded-proto") ??
    "http";

  return {
    host: rawHost.split(",")[0]?.trim() || "localhost:3000",
    pathname: rawPath || "/",
    protocol: rawProtocol.split(",")[0]?.trim() || "http",
  };
});

export const getResolvedSite = cache(async (): Promise<ResolvedSiteContext | null> => {
  const { host, pathname, protocol } = await getRequestSiteInput();
  const site = await services.multisite.resolveSite(host, pathname).catch(() => null);

  if (!site) {
    return null;
  }

  const meta =
    site.meta && typeof site.meta === "object" && !Array.isArray(site.meta)
      ? (site.meta as ResolvedSiteMeta)
      : {};
  const explicitUrl = firstMetaString(meta, ["home", "siteurl", "url"]);

  return {
    id: site.id,
    name: site.name,
    domain: site.domain,
    path: site.path,
    meta,
    url: explicitUrl ? normalizePublicUrl(explicitUrl) : buildSiteUrl(site.domain, site.path, protocol),
  };
});

/**
 * Resolve the site settings from the options store, falling back to sensible
 * defaults so the site renders even on a fresh install. Reads happen once per
 * request; the options service has its own autoload cache underneath.
 */
export async function getSiteSettings(): Promise<SiteSettings> {
  const [resolvedSite, title, description, url, perPage] = await Promise.all([
    getResolvedSite(),
    services.options.getOption("blogname").catch(() => null),
    services.options.getOption("blogdescription").catch(() => null),
    services.options.getOption("siteurl").catch(() => null),
    services.options.getOption("posts_per_page").catch(() => null),
  ]);

  const perPageNum = Number(perPage);
  const meta = resolvedSite?.meta ?? {};
  const siteTitle = firstMetaString(meta, ["blogname", "siteTitle", "title"]);
  const siteDescription = firstMetaString(meta, ["blogdescription", "description"]);
  const siteUrl = resolvedSite?.url ?? (url ? String(url) : null);
  const siteLanguage = firstMetaString(meta, ["language"]);

  return {
    title: siteTitle ?? resolvedSite?.name ?? (title ? String(title) : "Presslyn"),
    description:
      siteDescription ??
      (description ? String(description) : "Powered by Presslyn CMS"),
    url: siteUrl ? normalizePublicUrl(String(siteUrl)) : "http://localhost:3000",
    postsPerPage: Number.isFinite(perPageNum) && perPageNum > 0 ? perPageNum : 10,
    language: siteLanguage ?? "en-US",
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
