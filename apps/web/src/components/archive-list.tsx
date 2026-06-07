import Link from "next/link";
import { PostCard, type PostCardData } from "./post-card";
import type { PublicThemeDefinition } from "@/themes/public-theme";

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
  theme: PublicThemeDefinition;
  frame: "none" | "card";
  cardStyle: "minimal" | "feature";
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
  theme,
  frame,
  cardStyle,
}: ArchiveListProps) {
  return (
    <div>
      <header
        className={
          frame === "card"
            ? "mb-8 rounded-[1.8rem] border border-border bg-surface px-6 py-7"
            : "mb-8 border-b border-border pb-6"
        }
      >
        <h1
          className={
            frame === "card"
              ? "font-serif text-4xl font-bold leading-tight"
              : "font-serif text-3xl font-bold"
          }
        >
          {title}
        </h1>
        {description ? <p className="mt-2 text-muted">{description}</p> : null}
      </header>

      {posts.length === 0 ? (
        <p className="py-12 text-center text-muted">{emptyMessage}</p>
      ) : (
        <div className="space-y-8">
          {posts.map((post) => (
            <PostCard
              key={post.slug}
              post={post}
              theme={theme}
              cardStyle={cardStyle}
            />
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
