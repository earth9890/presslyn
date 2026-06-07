import type { MetadataRoute } from "next";
import { services } from "@/lib/services";
import { getResolvedSite, getSiteSettings } from "@/lib/site";

export const dynamic = "force-dynamic";

export default async function robots(): Promise<MetadataRoute.Robots> {
  const [site, resolvedSite] = await Promise.all([getSiteSettings(), getResolvedSite()]);
  const isPublic = await services.options
    .getOption("blog_public", true, resolvedSite ? { siteId: resolvedSite.id } : undefined)
    .catch(() => true);

  // When search-engine visibility is off, discourage all crawling.
  if (!isPublic) {
    return { rules: [{ userAgent: "*", disallow: "/" }] };
  }

  return {
    rules: [{ userAgent: "*", allow: "/", disallow: ["/search"] }],
    sitemap: `${site.url}/sitemap.xml`,
    host: site.url,
  };
}
