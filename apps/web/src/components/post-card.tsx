import Link from "next/link";
import { formatDate } from "@/lib/site";
import type { CardStyle, PublicThemeDefinition } from "@/themes/public-theme";

export interface PostCardData {
  title: string;
  slug: string;
  excerpt: string;
  date: string | null;
  author: string;
  categories: string[];
}

export function PostCard({
  post,
  theme,
  cardStyle,
}: {
  post: PostCardData;
  theme: PublicThemeDefinition;
  cardStyle: CardStyle;
}) {
  if (cardStyle === "feature") {
    return (
      <article className="rounded-[1.6rem] border border-border bg-surface px-6 py-6 shadow-[0_18px_42px_rgba(17,24,39,0.06)]">
        <div className="flex flex-wrap items-center gap-2 text-[11px] font-medium uppercase tracking-[0.16em] text-muted">
          {post.date ? <time>{formatDate(post.date)}</time> : null}
          {post.categories.length > 0 ? (
            <>
              <span>•</span>
              <span>{post.categories.join(" / ")}</span>
            </>
          ) : null}
        </div>
        <h2 className="mt-3 font-serif text-[2rem] font-bold leading-tight">
          <Link href={`/${post.slug}`} className="transition-colors hover:text-accent">
            {post.title || "(untitled)"}
          </Link>
        </h2>
        {post.excerpt ? (
          <p className="mt-3 max-w-2xl text-[15px] leading-7 text-muted">
            {post.excerpt}
          </p>
        ) : null}
        <div className="mt-5 flex items-center justify-between gap-4 text-sm">
          <span className="text-muted">{post.author || theme.name}</span>
          <Link
            href={`/${post.slug}`}
            className="inline-flex items-center rounded-full border border-border px-3 py-1.5 text-accent transition-colors hover:border-accent hover:text-foreground"
          >
            Read article
          </Link>
        </div>
      </article>
    );
  }

  return (
    <article className="border-b border-border pb-8 last:border-b-0">
      <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-muted">
        {post.date ? <time>{formatDate(post.date)}</time> : null}
        {post.categories.length > 0 ? (
          <>
            <span>·</span>
            <span>{post.categories.join(", ")}</span>
          </>
        ) : null}
      </div>
      <h2 className="mt-2 font-serif text-2xl font-bold leading-snug">
        <Link href={`/${post.slug}`} className="hover:text-accent">
          {post.title || "(untitled)"}
        </Link>
      </h2>
      {post.excerpt ? (
        <p className="mt-2 text-muted">{post.excerpt}</p>
      ) : null}
      <div className="mt-3 text-sm">
        <Link href={`/${post.slug}`} className="text-accent hover:underline">
          Read more →
        </Link>
      </div>
    </article>
  );
}
