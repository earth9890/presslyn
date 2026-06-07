import { cache } from "react";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { services } from "@/lib/services";
import { getSiteSettings } from "@/lib/site";
import { toPostCards } from "@/lib/posts";
import { ArchiveList } from "@/components/archive-list";
import { getActivePublicTheme, getThemeTemplate } from "@/themes/public-theme";

export const dynamic = "force-dynamic";

const resolveTerm = cache(async (slug: string) => {
  try {
    return await services.taxonomy.getTermBySlug(slug, "post_tag");
  } catch {
    return null;
  }
});

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const term = await resolveTerm(slug);
  if (!term) return { title: "Tag not found" };
  return {
    title: `${term.name}`,
    description: term.description || `Posts tagged ${term.name}`,
    alternates: { canonical: `/tag/${term.slug}` },
  };
}

export default async function TagPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ page?: string }>;
}) {
  const { slug } = await params;
  const { page: pageParam } = await searchParams;
  const term = await resolveTerm(slug);
  if (!term) notFound();

  const [site, theme] = await Promise.all([
    getSiteSettings(),
    getActivePublicTheme(),
  ]);
  const template = getThemeTemplate(theme, "tag");
  const page = Math.max(1, Number(pageParam ?? 1));
  const limit = site.postsPerPage;

  const { posts, total } = await services.content.queryPosts({
    postType: "post",
    status: "publish",
    termId: term.id,
    orderBy: "date",
    order: "desc",
    limit,
    offset: (page - 1) * limit,
  });

  return (
    <ArchiveList
      title={`Tag: ${term.name}`}
      description={term.description || undefined}
      posts={await toPostCards(posts)}
      theme={theme}
      frame={template.frame}
      cardStyle={template.cardStyle ?? "minimal"}
      page={page}
      totalPages={Math.max(1, Math.ceil(total / limit))}
      basePath={`/tag/${term.slug}`}
      emptyMessage="No posts with this tag yet."
    />
  );
}
