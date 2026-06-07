import { cache } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { services } from "@/lib/services";
import { formatDate, isoDate, excerptFrom, getSiteSettings } from "@/lib/site";
import { getActivePublicTheme, getThemeTemplate } from "@/themes/public-theme";
import { renderThemeTemplate } from "@/themes/template-renderer";

export const dynamic = "force-dynamic";

/**
 * Resolve a published entry by slug — a post first, then a page. Cached per
 * request so generateMetadata and the page component share one lookup.
 */
const resolveEntry = cache(async (slug: string) => {
  for (const postType of ["post", "page"] as const) {
    try {
      const entry = await services.content.getPostBySlug(slug, postType);
      if (entry && entry.status === "publish") {
        return { entry, postType };
      }
    } catch {
      /* not found for this type — try the next */
    }
  }
  return null;
});

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const resolved = await resolveEntry(slug);
  if (!resolved) return { title: "Not found" };

  const { entry } = resolved;
  const description = entry.excerpt?.trim()
    ? entry.excerpt
    : excerptFrom(entry.content, 30);

  return {
    title: entry.title,
    description,
    alternates: { canonical: `/${entry.slug}` },
    openGraph: {
      type: "article",
      title: entry.title,
      description,
      url: `/${entry.slug}`,
      publishedTime: isoDate(entry.publishedAt ?? entry.createdAt),
    },
  };
}

export default async function EntryPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const resolved = await resolveEntry(slug);
  if (!resolved) notFound();

  const { entry, postType } = resolved;
  const [site, theme] = await Promise.all([
    getSiteSettings(),
    getActivePublicTheme(),
  ]);
  const template = getThemeTemplate(theme, postType === "page" ? "page" : "single");

  const [details, commentsResult] = await Promise.all([
    services.content.getListDetails([entry.id]),
    entry.commentStatus !== "closed"
      ? services.comments.queryComments({
          postId: entry.id,
          approved: true,
          orderBy: "date",
          order: "asc",
          limit: 100,
        })
      : Promise.resolve({ comments: [], total: 0 }),
  ]);

  const author = details.authors[entry.id] ?? "";
  const terms = details.terms[entry.id] ?? { categories: [], tags: [] };
  const comments = commentsResult.comments;
  const entryHeader = await renderThemeTemplate(
    theme,
    postType === "page" ? "page" : "single",
    {
      siteTitle: site.title,
      postTitle: entry.title || "(untitled)",
      postDate: postType === "post" ? formatDate(entry.publishedAt ?? entry.createdAt) : undefined,
      postDateIso:
        postType === "post" ? isoDate(entry.publishedAt ?? entry.createdAt) : undefined,
      postAuthor: postType === "post" ? author : undefined,
    }
  );

  // JSON-LD structured data for articles.
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": postType === "post" ? "BlogPosting" : "WebPage",
    headline: entry.title,
    datePublished: isoDate(entry.publishedAt ?? entry.createdAt),
    dateModified: isoDate(entry.updatedAt ?? entry.createdAt),
    author: author ? { "@type": "Person", name: author } : undefined,
    publisher: { "@type": "Organization", name: site.title },
    mainEntityOfPage: `${site.url}/${entry.slug}`,
  };

  return (
    <article
      className={
        template.frame === "card"
          ? "rounded-[1.9rem] border border-border bg-surface px-6 py-7 shadow-[0_18px_42px_rgba(17,24,39,0.06)] sm:px-8 sm:py-8"
          : ""
      }
    >
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <header className={template.frame === "card" ? "mb-10" : "mb-8"}>
        {entryHeader ?? (
          <>
            {postType === "post" ? (
              <div
                className={
                  template.frame === "card"
                    ? "flex flex-wrap items-center gap-2 text-[11px] font-medium uppercase tracking-[0.18em] text-muted"
                    : "flex flex-wrap items-center gap-2 text-xs uppercase tracking-wide text-muted"
                }
              >
                <time dateTime={isoDate(entry.publishedAt ?? entry.createdAt)}>
                  {formatDate(entry.publishedAt ?? entry.createdAt)}
                </time>
                {author ? (
                  <>
                    <span>·</span>
                    <span>{author}</span>
                  </>
                ) : null}
              </div>
            ) : null}
            <h1
              className={
                template.frame === "card"
                  ? "mt-3 font-serif text-5xl font-bold leading-[1.05]"
                  : "mt-2 font-serif text-4xl font-bold leading-tight"
              }
            >
              {entry.title || "(untitled)"}
            </h1>
          </>
        )}
      </header>

      {/* Post body — HTML authored by trusted editors via the block editor. */}
      <div
        className="prose-content"
        dangerouslySetInnerHTML={{ __html: entry.content }}
      />

      {postType === "post" && (terms.categories.length > 0 || terms.tags.length > 0) ? (
        <footer className="mt-10 flex flex-wrap items-center gap-2 border-t border-border pt-6 text-sm">
          {terms.categories.map((name) => (
            <span
              key={`c-${name}`}
              className="rounded-full bg-surface px-3 py-1 text-muted"
            >
              {name}
            </span>
          ))}
          {terms.tags.map((name) => (
            <span key={`t-${name}`} className="text-muted">
              #{name}
            </span>
          ))}
        </footer>
      ) : null}

      {/* Comments */}
      {entry.commentStatus !== "closed" ? (
        <section className="mt-12 border-t border-border pt-8">
          <h2 className="font-serif text-2xl font-bold">
            {comments.length === 0
              ? "No comments yet"
              : `${comments.length} comment${comments.length === 1 ? "" : "s"}`}
          </h2>
          <ul className="mt-6 space-y-6">
            {comments.map((comment) => (
              <li key={comment.id} className="border-b border-border pb-6 last:border-b-0">
                <div className="flex items-center gap-2 text-sm">
                  <span className="font-semibold">
                    {comment.authorName || "Anonymous"}
                  </span>
                  <span className="text-muted">·</span>
                  <time className="text-muted">{formatDate(comment.createdAt)}</time>
                </div>
                <p className="mt-2 whitespace-pre-line text-foreground/90">
                  {comment.content}
                </p>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <div className="mt-12">
        <Link href="/" className="text-sm text-accent hover:underline">
          ← Back to all posts
        </Link>
      </div>
    </article>
  );
}
