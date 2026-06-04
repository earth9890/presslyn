import Link from "next/link";

interface SiteHeaderProps {
  title: string;
  description: string;
  categories: { slug: string; name: string }[];
}

export function SiteHeader({ title, description, categories }: SiteHeaderProps) {
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
          {description ? (
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
          <Link
            href="/search"
            className="ml-auto text-muted transition-colors hover:text-foreground"
          >
            Search
          </Link>
        </nav>
      </div>
    </header>
  );
}
