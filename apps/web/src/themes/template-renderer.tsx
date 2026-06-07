import { cache } from "react";
import { promises as fs } from "node:fs";
import path from "node:path";
import Link from "next/link";
import {
  parseBlockTemplate,
  type ParsedTemplateBlock,
} from "@presslyn/core";
import { CommentForm } from "@/components/comment-form";
import { PostCard, type PostCardData } from "@/components/post-card";
import { formatDate } from "@/lib/site";
import type { PublicThemeDefinition } from "./public-theme";

type TemplateName =
  | "header"
  | "footer"
  | "sidebar"
  | "404"
  | "index"
  | "archive"
  | "single"
  | "page";

interface TemplateContext {
  postId?: number;
  postType?: "post" | "page";
  theme: PublicThemeDefinition;
  cardStyle?: "minimal" | "feature";
  siteTitle: string;
  siteDescription?: string;
  categories?: { slug: string; name: string }[];
  sidebarRecentPosts?: { slug: string; title: string }[];
  sidebarCategories?: { slug: string; name: string; count: number }[];
  queryTitle?: string;
  queryDescription?: string;
  postTitle?: string;
  postDate?: string;
  postDateIso?: string;
  postAuthor?: string;
  posts?: PostCardData[];
  postContent?: string;
  postCategories?: string[];
  postTags?: string[];
  comments?: Array<{
    id: number;
    authorName: string | null;
    content: string;
    createdAt: Date;
  }>;
  emptyMessage?: string;
  page?: number;
  totalPages?: number;
  basePath?: string;
  extraQuery?: Record<string, string>;
  backHref?: string;
}

const loadTemplateBlocks = cache(
  async (
    themeRootDir: string,
    templateName: TemplateName
  ): Promise<ParsedTemplateBlock[] | null> => {
    const templatePath = path.join(themeRootDir, `${templateName}.html`);
    let raw: string;
    try {
      raw = await fs.readFile(templatePath, "utf8");
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        return null;
      }
      throw error;
    }
    return parseBlockTemplate(raw);
  }
);

export async function renderThemeTemplate(
  theme: PublicThemeDefinition,
  templateName: TemplateName,
  context: TemplateContext
) {
  const blocks = await loadTemplateBlocks(theme.rootDir, templateName);
  if (!blocks) {
    return null;
  }
  return blocks.map((block, index) =>
    renderTemplateBlock(block, context, `${templateName}-${index}`)
  );
}

export async function renderThemeTemplatePart(
  theme: PublicThemeDefinition,
  part: "header" | "footer" | "sidebar" | "404",
  context: TemplateContext
) {
  return renderThemeTemplate(theme, part, context);
}

function interpolateTemplateString(value: string, context: TemplateContext): string {
  return value.replace(/\{\{\s*([a-zA-Z0-9]+)\s*\}\}/g, (_, key: string) => {
    const resolved = context[key as keyof TemplateContext];
    return typeof resolved === "string" ? resolved : "";
  });
}

function pageHref(
  basePath: string,
  page: number,
  extraQuery?: Record<string, string>
) {
  const params = new URLSearchParams(extraQuery);
  if (page > 1) {
    params.set("page", String(page));
  }
  const qs = params.toString();
  return qs ? `${basePath}?${qs}` : basePath;
}

function renderTemplateBlock(
  block: ParsedTemplateBlock,
  context: TemplateContext,
  key: string
): React.ReactNode {
  const nested = block.innerBlocks.map((child, index) =>
    renderTemplateBlock(child, context, `${key}-${index}`)
  );
  const className =
    typeof block.attrs.className === "string" ? block.attrs.className : undefined;

  switch (block.blockName) {
    case "group": {
      const tagName =
        typeof block.attrs.tagName === "string" ? block.attrs.tagName : "div";
      if (tagName === "header") {
        return (
          <header key={key} className={className}>
            {nested}
          </header>
        );
      }
      if (tagName === "footer") {
        return (
          <footer key={key} className={className}>
            {nested}
          </footer>
        );
      }
      if (tagName === "section") {
        return (
          <section key={key} className={className}>
            {nested}
          </section>
        );
      }
      if (tagName === "aside") {
        return (
          <aside key={key} className={className}>
            {nested}
          </aside>
        );
      }

      return (
        <div key={key} className={className}>
          {nested}
        </div>
      );
    }
    case "site-title":
      return (
        <Link
          key={key}
          href="/"
          className="block font-serif text-4xl font-bold tracking-tight text-foreground transition-colors hover:text-accent"
        >
          {context.siteTitle}
        </Link>
      );
    case "site-tagline":
      return context.siteDescription ? (
        <p key={key} className="max-w-2xl text-sm leading-6 text-muted">
          {context.siteDescription}
        </p>
      ) : null;
    case "navigation":
      return (
        <nav key={key} className="flex flex-wrap items-center gap-2 text-sm">
          <Link
            href="/"
            className="rounded-full border border-border px-3 py-1.5 text-muted transition-colors hover:border-accent hover:text-foreground"
          >
            Home
          </Link>
          {(context.categories ?? []).slice(0, 6).map((category) => (
            <Link
              key={category.slug}
              href={`/category/${category.slug}`}
              className="rounded-full border border-border px-3 py-1.5 text-muted transition-colors hover:border-accent hover:text-foreground"
            >
              {category.name}
            </Link>
          ))}
        </nav>
      );
    case "search":
      return (
        <Link
          key={key}
          href="/search"
          className="inline-flex h-10 items-center justify-center rounded-full border border-border px-4 text-sm text-muted transition-colors hover:border-accent hover:text-foreground"
        >
          Search the archive
        </Link>
      );
    case "search-form":
      return (
        <form key={key} action="/search" method="GET" className={className ?? "space-y-3"}>
          <label htmlFor={`${key}-q`} className="block text-sm font-medium text-foreground">
            Search
          </label>
          <div className="flex gap-2">
            <input
              id={`${key}-q`}
              name="q"
              placeholder="Search posts..."
              className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm outline-none focus:border-accent"
            />
            <button
              type="submit"
              className="rounded-md bg-accent px-3 py-2 text-sm font-medium text-background"
            >
              Go
            </button>
          </div>
        </form>
      );
    case "heading": {
      const content =
        typeof block.attrs.content === "string" ? block.attrs.content : block.innerHtml;
      const level =
        typeof block.attrs.level === "number" && block.attrs.level >= 1 && block.attrs.level <= 6
          ? block.attrs.level
          : 2;
      if (level === 1) {
        return (
          <h1
            key={key}
            className="mt-4 font-serif text-2xl font-bold"
            dangerouslySetInnerHTML={{
              __html: interpolateTemplateString(content, context),
            }}
          />
        );
      }
      if (level === 3) {
        return (
          <h3
            key={key}
            className="font-serif text-xl font-bold"
            dangerouslySetInnerHTML={{
              __html: interpolateTemplateString(content, context),
            }}
          />
        );
      }
      return (
        <h2
          key={key}
          className="font-serif text-2xl font-bold"
          dangerouslySetInnerHTML={{
            __html: interpolateTemplateString(content, context),
          }}
        />
      );
    }
    case "paragraph": {
      const content =
        typeof block.attrs.content === "string" ? block.attrs.content : block.innerHtml;
      const resolved = interpolateTemplateString(content, context).trim();
      if (!resolved) {
        return null;
      }
      return (
        <p
          key={key}
          className="text-muted"
          dangerouslySetInnerHTML={{ __html: resolved }}
        />
      );
    }
    case "query-loop": {
      const posts = context.posts ?? [];
      if (posts.length === 0) {
        return (
          <p key={key} className="py-12 text-center text-muted">
            {context.emptyMessage ?? "No posts found."}
          </p>
        );
      }

      return (
        <div key={key} className={className ?? "space-y-8"}>
          {posts.map((post) => (
            <PostCard
              key={post.slug}
              post={post}
              theme={context.theme}
              cardStyle={context.cardStyle ?? "minimal"}
            />
          ))}
        </div>
      );
    }
    case "recent-posts": {
      const posts = context.sidebarRecentPosts ?? [];
      if (posts.length === 0) {
        return null;
      }
      return (
        <section key={key} className={className ?? "space-y-3"}>
          <h2 className="font-serif text-xl font-bold">Recent posts</h2>
          <ul className="space-y-2 text-sm">
            {posts.map((post) => (
              <li key={post.slug}>
                <Link
                  href={`/${post.slug}`}
                  className="text-muted transition-colors hover:text-foreground"
                >
                  {post.title}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      );
    }
    case "category-list": {
      const categories = context.sidebarCategories ?? [];
      if (categories.length === 0) {
        return null;
      }
      return (
        <section key={key} className={className ?? "space-y-3"}>
          <h2 className="font-serif text-xl font-bold">Categories</h2>
          <ul className="space-y-2 text-sm">
            {categories.map((category) => (
              <li key={category.slug} className="flex items-center justify-between gap-4">
                <Link
                  href={`/category/${category.slug}`}
                  className="text-muted transition-colors hover:text-foreground"
                >
                  {category.name}
                </Link>
                <span className="text-muted">{category.count}</span>
              </li>
            ))}
          </ul>
        </section>
      );
    }
    case "pagination": {
      const page = context.page ?? 1;
      const totalPages = context.totalPages ?? 1;
      const basePath = context.basePath;

      if (!basePath || totalPages <= 1) {
        return null;
      }

      return (
        <nav
          key={key}
          className={className ?? "mt-10 flex items-center justify-between border-t border-border pt-6 text-sm"}
        >
          {page > 1 ? (
            <Link
              href={pageHref(basePath, page - 1, context.extraQuery)}
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
              href={pageHref(basePath, page + 1, context.extraQuery)}
              className="text-accent hover:underline"
            >
              Older →
            </Link>
          ) : (
            <span />
          )}
        </nav>
      );
    }
    case "post-content":
      return context.postContent ? (
        <div
          key={key}
          className={className ?? "prose-content"}
          dangerouslySetInnerHTML={{ __html: context.postContent }}
        />
      ) : null;
    case "post-terms": {
      if (context.postType !== "post") {
        return null;
      }
      const categories = context.postCategories ?? [];
      const tags = context.postTags ?? [];
      if (categories.length === 0 && tags.length === 0) {
        return null;
      }

      return (
        <footer
          key={key}
          className={
            className ??
            "mt-10 flex flex-wrap items-center gap-2 border-t border-border pt-6 text-sm"
          }
        >
          {categories.map((name) => (
            <span
              key={`c-${name}`}
              className="rounded-full bg-surface px-3 py-1 text-muted"
            >
              {name}
            </span>
          ))}
          {tags.map((name) => (
            <span key={`t-${name}`} className="text-muted">
              #{name}
            </span>
          ))}
        </footer>
      );
    }
    case "comments-list": {
      const comments = context.comments;
      if (!comments) {
        return null;
      }

      return (
        <section
          key={key}
          className={className ?? "mt-12 border-t border-border pt-8"}
        >
          <h2 className="font-serif text-2xl font-bold">
            {comments.length === 0
              ? "No comments yet"
              : `${comments.length} comment${comments.length === 1 ? "" : "s"}`}
          </h2>
          <ul className="mt-6 space-y-6">
            {comments.map((comment) => (
              <li
                key={comment.id}
                className="border-b border-border pb-6 last:border-b-0"
              >
                <div className="flex items-center gap-2 text-sm">
                  <span className="font-semibold">
                    {comment.authorName || "Anonymous"}
                  </span>
                  <span className="text-muted">·</span>
                  <time className="text-muted">
                    {formatDate(comment.createdAt)}
                  </time>
                </div>
                <p className="mt-2 whitespace-pre-line text-foreground/90">
                  {comment.content}
                </p>
              </li>
            ))}
          </ul>
        </section>
      );
    }
    case "comment-form":
      return context.postId ? <CommentForm key={key} postId={context.postId} /> : null;
    case "back-link":
      return context.backHref ? (
        <div key={key} className={className ?? "mt-12"}>
          <Link href={context.backHref} className="text-sm text-accent hover:underline">
            ← Back to all posts
          </Link>
        </div>
      ) : null;
    case "post-meta":
      return context.postDate ? (
        <div
          key={key}
          className="flex flex-wrap items-center gap-2 text-xs uppercase tracking-wide text-muted"
        >
          <time dateTime={context.postDateIso ?? context.postDate}>
            {context.postDate}
          </time>
          {context.postAuthor ? (
            <>
              <span>·</span>
              <span>{context.postAuthor}</span>
            </>
          ) : null}
        </div>
      ) : null;
    case "copyright":
      return (
        <p key={key} className="font-medium text-foreground">
          © {new Date().getFullYear()} {context.siteTitle}
        </p>
      );
    case "powered-by":
      return (
        <span key={key}>
          Powered by{" "}
          <a
            href="https://presslyn.com"
            className="text-accent transition-colors hover:text-foreground"
          >
            Presslyn
          </a>
        </span>
      );
    default:
      return null;
  }
}
