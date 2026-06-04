import Link from "next/link";
import { formatDate } from "@/lib/site";

export interface PostCardData {
  title: string;
  slug: string;
  excerpt: string;
  date: string | null;
  author: string;
  categories: string[];
}

export function PostCard({ post }: { post: PostCardData }) {
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
