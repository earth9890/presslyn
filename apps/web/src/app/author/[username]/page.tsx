import { cache } from "react";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { services } from "@/lib/services";
import { getSiteSettings } from "@/lib/site";
import { toPostCards } from "@/lib/posts";
import { ArchiveList } from "@/components/archive-list";
import { getActivePublicTheme } from "@/themes/public-theme";

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

  const [site, theme] = await Promise.all([
    getSiteSettings(),
    getActivePublicTheme(),
  ]);
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
  });

  return (
    <ArchiveList
      title={author.displayName}
      description={`Posts by ${author.displayName}`}
      posts={await toPostCards(posts)}
      variant={theme.variant}
      page={page}
      totalPages={Math.max(1, Math.ceil(total / limit))}
      basePath={`/author/${author.username}`}
      emptyMessage="This author hasn't published anything yet."
    />
  );
}
