import type { MetadataRoute } from "next";
import { services } from "@/lib/services";
import { getSiteSettings, isoDate } from "@/lib/site";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 100;
const MAX_URLS = 5000;

type SitemapPost = Awaited<
  ReturnType<typeof services.content.queryPosts>
>["posts"][number];

/** Page through published content (list limit is capped at 100 server-side). */
async function allPublished(postType: string): Promise<SitemapPost[]> {
  const out: SitemapPost[] = [];
  let offset = 0;
  while (out.length < MAX_URLS) {
    const { posts, total } = await services.content.queryPosts({
      postType,
      status: "publish",
      orderBy: "date",
      order: "desc",
      limit: PAGE_SIZE,
      offset,
    });
    out.push(...posts);
    offset += PAGE_SIZE;
    if (out.length >= total || posts.length < PAGE_SIZE) break;
  }
  return out;
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const site = await getSiteSettings();
  const base = site.url;

  const [postRows, pageRows, categories, tags] = await Promise.all([
    allPublished("post"),
    allPublished("page"),
    services.taxonomy.getTermsWithCounts("category").catch(() => []),
    services.taxonomy.getTermsWithCounts("post_tag").catch(() => []),
  ]);

  const entries: MetadataRoute.Sitemap = [
    { url: `${base}/`, changeFrequency: "daily", priority: 1 },
  ];

  for (const post of [...postRows, ...pageRows]) {
    entries.push({
      url: `${base}/${post.slug}`,
      lastModified: isoDate(post.updatedAt ?? post.publishedAt ?? post.createdAt) || undefined,
      changeFrequency: "weekly",
      priority: 0.7,
    });
  }

  for (const c of categories) {
    if (c.count > 0) {
      entries.push({
        url: `${base}/category/${c.slug}`,
        changeFrequency: "weekly",
        priority: 0.4,
      });
    }
  }
  for (const t of tags) {
    if (t.count > 0) {
      entries.push({
        url: `${base}/tag/${t.slug}`,
        changeFrequency: "weekly",
        priority: 0.3,
      });
    }
  }

  return entries;
}
