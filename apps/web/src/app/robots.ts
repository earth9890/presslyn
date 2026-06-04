import type { MetadataRoute } from "next";
import { services } from "@/lib/services";
import { getSiteSettings } from "@/lib/site";

export const dynamic = "force-dynamic";

export default async function robots(): Promise<MetadataRoute.Robots> {
  const site = await getSiteSettings();
  const isPublic = await services.options
    .getOption("blog_public")
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
