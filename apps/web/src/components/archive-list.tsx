import Link from "next/link";
import { PostCard, type PostCardData } from "./post-card";

interface ArchiveListProps {
  title: string;
  description?: string;
  posts: PostCardData[];
  page: number;
  totalPages: number;
  /** Base path for pagination links, e.g. "/category/news". */
  basePath: string;
  /** Extra query params to preserve in pagination links (e.g. search q). */
  extraQuery?: Record<string, string>;
  emptyMessage?: string;
}

function pageHref(
  basePath: string,
  page: number,
  extraQuery?: Record<string, string>
) {
  const params = new URLSearchParams(extraQuery);
  if (page > 1) params.set("page", String(page));
  const qs = params.toString();
  return qs ? `${basePath}?${qs}` : basePath;
}

export function ArchiveList({
  title,
  description,
  posts,
  page,
  totalPages,
  basePath,
  extraQuery,
  emptyMessage = "No posts found.",
}: ArchiveListProps) {
  return (
    <div>
      <header className="mb-8 border-b border-border pb-6">
        <h1 className="font-serif text-3xl font-bold">{title}</h1>
        {description ? <p className="mt-2 text-muted">{description}</p> : null}
      </header>

      {posts.length === 0 ? (
        <p className="py-12 text-center text-muted">{emptyMessage}</p>
      ) : (
        <div className="space-y-8">
          {posts.map((post) => (
            <PostCard key={post.slug} post={post} />
          ))}
        </div>
      )}

      {totalPages > 1 ? (
        <nav className="mt-10 flex items-center justify-between border-t border-border pt-6 text-sm">
          {page > 1 ? (
            <Link
              href={pageHref(basePath, page - 1, extraQuery)}
              className="text-accent hover:underline"
            >
              ← Newer
            </Link>
          ) : (
            <span />
          )}
          <span className="text-muted">
            Page {page} of {totalPages}
          </span>
          {page < totalPages ? (
            <Link
              href={pageHref(basePath, page + 1, extraQuery)}
              className="text-accent hover:underline"
            >
              Older →
            </Link>
          ) : (
            <span />
          )}
        </nav>
      ) : null}
    </div>
  );
}
