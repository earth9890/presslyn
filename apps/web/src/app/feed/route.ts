import { escapeXml, cdata } from "@presslyn/core";
import { services } from "@/lib/services";
import { getResolvedSite, getSiteSettings, excerptFrom } from "@/lib/site";

export const dynamic = "force-dynamic";

/** RSS 2.0 feed of the latest published posts. */
export async function GET() {
  const [site, resolvedSite] = await Promise.all([getSiteSettings(), getResolvedSite()]);
  const siteScope = resolvedSite ? { siteId: resolvedSite.id } : undefined;

  const { posts } = await services.content.queryPosts({
    postType: "post",
    status: "publish",
    orderBy: "date",
    order: "desc",
    limit: 20,
  }, siteScope);

  const details = await services.content.getListDetails(posts.map((p) => p.id));

  const items = posts
    .map((post) => {
      const link = `${site.url}/${post.slug}`;
      const date = post.publishedAt ?? post.createdAt;
      const pubDate = date ? new Date(date).toUTCString() : "";
      const author = details.authors[post.id] ?? "";
      const description = post.excerpt?.trim()
        ? post.excerpt
        : excerptFrom(post.content, 55);
      return [
        "    <item>",
        `      <title>${cdata(post.title)}</title>`,
        `      <link>${escapeXml(link)}</link>`,
        `      <guid isPermaLink="true">${escapeXml(link)}</guid>`,
        pubDate ? `      <pubDate>${pubDate}</pubDate>` : "",
        author ? `      <dc:creator>${cdata(author)}</dc:creator>` : "",
        `      <description>${cdata(description)}</description>`,
        `      <content:encoded>${cdata(post.content)}</content:encoded>`,
        "    </item>",
      ]
        .filter(Boolean)
        .join("\n");
    })
    .join("\n");

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:content="http://purl.org/rss/1.0/modules/content/" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${escapeXml(site.title)}</title>
    <link>${escapeXml(site.url)}</link>
    <description>${escapeXml(site.description)}</description>
    <language>${escapeXml(site.language)}</language>
    <atom:link href="${escapeXml(site.url)}/feed" rel="self" type="application/rss+xml" />
${items}
  </channel>
</rss>`;

  return new Response(xml, {
    headers: {
      "Content-Type": "application/rss+xml; charset=utf-8",
      "Cache-Control": "public, max-age=600",
    },
  });
}
