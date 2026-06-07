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

const resolveAuthor = cache(async (username: string) => {
  try {
    return await services.users.getUserByUsername(username);
  } catch {
    return null;
  }
});

export async function generateMetadata({
  params,
}: {
  params: Promise<{ username: string }>;
}): Promise<Metadata> {
  const { username } = await params;
  const author = await resolveAuthor(username);
  if (!author) return { title: "Author not found" };
  return {
    title: `${author.displayName}`,
    description: `Posts by ${author.displayName}`,
    alternates: { canonical: `/author/${author.username}` },
  };
}

export default async function AuthorPage({
  params,
  searchParams,
}: {
  params: Promise<{ username: string }>;
  searchParams: Promise<{ page?: string }>;
}) {
  const { username } = await params;
  const { page: pageParam } = await searchParams;
  const author = await resolveAuthor(username);
  if (!author) notFound();

  const [site, theme, resolvedSite] = await Promise.all([
    getSiteSettings(),
    getActivePublicTheme(),
    getResolvedSite(),
  ]);
  const siteScope = resolvedSite ? { siteId: resolvedSite.id } : undefined;
  const template = getThemeTemplate(theme, "author");
  const page = Math.max(1, Number(pageParam ?? 1));
  const limit = site.postsPerPage;

  const { posts, total } = await services.content.queryPosts({
    postType: "post",
    status: "publish",
    authorId: author.id,
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
    queryTitle: author.displayName,
    queryDescription: `Posts by ${author.displayName}`,
    posts: cards,
    page,
    totalPages: Math.max(1, Math.ceil(total / limit)),
    basePath: `/author/${author.username}`,
    emptyMessage: "This author hasn't published anything yet.",
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
      title={author.displayName}
      description={`Posts by ${author.displayName}`}
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
      basePath={`/author/${author.username}`}
      emptyMessage="This author hasn't published anything yet."
    />
  );
}
