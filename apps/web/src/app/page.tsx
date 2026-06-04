import Link from "next/link";
import { services } from "@/lib/services";
import { getSiteSettings } from "@/lib/site";
import { toPostCards } from "@/lib/posts";
import { PostCard } from "@/components/post-card";

export const dynamic = "force-dynamic";

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const { page: pageParam } = await searchParams;
  const site = await getSiteSettings();
  const page = Math.max(1, Number(pageParam ?? 1));
  const limit = site.postsPerPage;
  const offset = (page - 1) * limit;

  const { posts, total } = await services.content.queryPosts({
    postType: "post",
    status: "publish",
    orderBy: "date",
    order: "desc",
    limit,
    offset,
  });

  const cards = await toPostCards(posts);
  const totalPages = Math.max(1, Math.ceil(total / limit));

  if (cards.length === 0) {
    return (
      <div className="py-16 text-center text-muted">
        <p className="text-lg">No posts published yet.</p>
        <p className="mt-2 text-sm">Check back soon.</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {cards.map((post) => (
        <PostCard key={post.slug} post={post} />
      ))}

      {totalPages > 1 ? (
        <nav className="flex items-center justify-between border-t border-border pt-6 text-sm">
          {page > 1 ? (
            <Link
              href={page - 1 === 1 ? "/" : `/?page=${page - 1}`}
              className="text-accent hover:underline"
            >
              ← Newer posts
            </Link>
          ) : (
            <span />
          )}
          <span className="text-muted">
            Page {page} of {totalPages}
          </span>
          {page < totalPages ? (
            <Link href={`/?page=${page + 1}`} className="text-accent hover:underline">
              Older posts →
            </Link>
          ) : (
            <span />
          )}
        </nav>
      ) : null}
    </div>
  );
}
