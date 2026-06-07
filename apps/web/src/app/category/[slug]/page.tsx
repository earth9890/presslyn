import { cache } from "react";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { services } from "@/lib/services";
import { getSiteSettings } from "@/lib/site";
import { toPostCards } from "@/lib/posts";
import { ArchiveList } from "@/components/archive-list";
import { getActivePublicTheme } from "@/themes/public-theme";

export const dynamic = "force-dynamic";

const resolveTerm = cache(async (slug: string) => {
  try {
    return await services.taxonomy.getTermBySlug(slug, "category");
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
  if (!term) return { title: "Category not found" };
  return {
    title: `${term.name}`,
    description: term.description || `Posts in ${term.name}`,
    alternates: { canonical: `/category/${term.slug}` },
  };
}

export default async function CategoryPage({
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
      title={`Category: ${term.name}`}
      description={term.description || undefined}
      posts={await toPostCards(posts)}
      variant={theme.variant}
      page={page}
      totalPages={Math.max(1, Math.ceil(total / limit))}
      basePath={`/category/${term.slug}`}
      emptyMessage="No posts in this category yet."
    />
  );
}
