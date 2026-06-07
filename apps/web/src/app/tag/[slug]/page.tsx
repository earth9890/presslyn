import { cache } from "react";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { services } from "@/lib/services";
import { getResolvedSite, getSiteSettings } from "@/lib/site";
import { toPostCards } from "@/lib/posts";
import { getSidebarTemplateData } from "@/lib/sidebar";
import { ArchiveList } from "@/components/archive-list";
import { getActivePublicTheme, getThemeTemplate } from "@/themes/public-theme";
import { renderThemeTemplate, renderThemeTemplatePart } from "@/themes/template-renderer";

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

  const [site, theme, resolvedSite] = await Promise.all([
    getSiteSettings(),
    getActivePublicTheme(),
    getResolvedSite(),
  ]);
  const siteScope = resolvedSite ? { siteId: resolvedSite.id } : undefined;
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
  }, siteScope);
  const cards = await toPostCards(posts);
  const sidebarData =
    template.showSidebar && theme.config.templateParts.sidebar
      ? await getSidebarTemplateData(siteScope)
      : null;
  const headerContent = await renderThemeTemplate(theme, "archive", {
    theme,
    cardStyle: template.cardStyle ?? "minimal",
    siteTitle: site.title,
    queryTitle: `Tag: ${term.name}`,
    queryDescription: term.description || undefined,
    posts: cards,
    page,
    totalPages: Math.max(1, Math.ceil(total / limit)),
    basePath: `/tag/${term.slug}`,
    emptyMessage: "No posts with this tag yet.",
  });
  const sidebarContent =
    template.showSidebar && theme.config.templateParts.sidebar
      ? await renderThemeTemplatePart(theme, "sidebar", {
          theme,
          siteTitle: site.title,
          sidebarRecentPosts: sidebarData?.recentPosts,
          sidebarCategories: sidebarData?.categories,
        })
      : null;

  return (
    <ArchiveList
      title={`Tag: ${term.name}`}
      description={term.description || undefined}
      headerContent={headerContent}
      content={headerContent}
      sidebarContent={sidebarContent}
      showSidebar={template.showSidebar}
      posts={cards}
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
