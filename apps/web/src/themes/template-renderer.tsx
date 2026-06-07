import { cache } from "react";
import { promises as fs } from "fs";
import path from "path";
import Link from "next/link";
import {
  parseBlockTemplate,
  type ParsedTemplateBlock,
} from "@presslyn/core";
import type { PublicThemeDefinition } from "./public-theme";

type TemplatePartName = "header" | "footer" | "404";

interface TemplateContext {
  siteTitle: string;
  siteDescription?: string;
  categories?: { slug: string; name: string }[];
}

const loadTemplateBlocks = cache(
  async (themeId: string, part: TemplatePartName): Promise<ParsedTemplateBlock[]> => {
    const templatePath = path.join(
      process.cwd(),
      "src/themes/bundled",
      themeId,
      `${part}.html`
    );
    const raw = await fs.readFile(templatePath, "utf8");
    return parseBlockTemplate(raw);
  }
);

export async function renderThemeTemplatePart(
  theme: PublicThemeDefinition,
  part: TemplatePartName,
  context: TemplateContext
) {
  const blocks = await loadTemplateBlocks(theme.id, part);
  return blocks.map((block, index) => renderTemplateBlock(block, context, `${part}-${index}`));
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
            dangerouslySetInnerHTML={{ __html: content }}
          />
        );
      }
      if (level === 3) {
        return (
          <h3
            key={key}
            className="font-serif text-xl font-bold"
            dangerouslySetInnerHTML={{ __html: content }}
          />
        );
      }
      return (
        <h2
          key={key}
          className="font-serif text-2xl font-bold"
          dangerouslySetInnerHTML={{ __html: content }}
        />
      );
    }
    case "paragraph": {
      const content =
        typeof block.attrs.content === "string" ? block.attrs.content : block.innerHtml;
      return (
        <p
          key={key}
          className="text-muted"
          dangerouslySetInnerHTML={{ __html: content }}
        />
      );
    }
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
