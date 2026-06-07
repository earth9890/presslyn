import Link from "next/link";
import type { PublicThemeDefinition } from "@/themes/public-theme";

interface SiteHeaderProps {
  title: string;
  description: string;
  categories: { slug: string; name: string }[];
  theme: PublicThemeDefinition;
}

export function SiteHeader({
  title,
  description,
  categories,
  theme,
}: SiteHeaderProps) {
  const { header } = theme.config.templateParts;

  if (header.layout === "split") {
    return (
      <header className="border-b border-border">
        <div className="mx-auto flex max-w-5xl flex-col gap-6 px-5 py-8 sm:px-6 lg:px-8">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div className="min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-accent">
                Presslyn theme
              </p>
              <Link
                href="/"
                className="mt-2 block font-serif text-4xl font-bold tracking-tight text-foreground transition-colors hover:text-accent"
              >
                {title}
              </Link>
              {header.showDescription && description ? (
                <p className="mt-3 max-w-2xl text-sm leading-6 text-muted">
                  {description}
                </p>
              ) : null}
            </div>
            {header.showSearch ? (
              <Link
                href="/search"
                className="inline-flex h-10 items-center justify-center rounded-full border border-border px-4 text-sm text-muted transition-colors hover:border-accent hover:text-foreground"
              >
                Search the archive
              </Link>
            ) : null}
          </div>

          <nav className="flex flex-wrap items-center gap-2 text-sm">
            <Link
              href="/"
              className="rounded-full border border-border bg-surface px-3 py-1.5 text-muted transition-colors hover:border-accent hover:text-foreground"
            >
              Home
            </Link>
            {categories.slice(0, 6).map((c) => (
              <Link
                key={c.slug}
                href={`/category/${c.slug}`}
                className="rounded-full border border-border px-3 py-1.5 text-muted transition-colors hover:border-accent hover:text-foreground"
              >
                {c.name}
              </Link>
            ))}
          </nav>
        </div>
      </header>
    );
  }

  return (
    <header className="border-b border-border">
      <div className="mx-auto flex max-w-3xl flex-col gap-4 px-6 py-8">
        <div className="flex flex-col gap-1">
          <Link
            href="/"
            className="font-serif text-3xl font-bold tracking-tight text-foreground hover:text-accent"
          >
            {title}
          </Link>
          {header.showDescription && description ? (
            <p className="text-sm text-muted">{description}</p>
          ) : null}
        </div>
        <nav className="flex flex-wrap items-center gap-x-5 gap-y-1 text-sm">
          <Link href="/" className="text-muted transition-colors hover:text-foreground">
            Home
          </Link>
          {categories.slice(0, 6).map((c) => (
            <Link
              key={c.slug}
              href={`/category/${c.slug}`}
              className="text-muted transition-colors hover:text-foreground"
            >
              {c.name}
            </Link>
          ))}
          {header.showSearch ? (
            <Link
              href="/search"
              className="ml-auto text-muted transition-colors hover:text-foreground"
            >
              Search
            </Link>
          ) : null}
        </nav>
      </div>
    </header>
  );
}
