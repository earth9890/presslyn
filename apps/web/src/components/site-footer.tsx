import Link from "next/link";
import type { PublicThemeDefinition } from "@/themes/public-theme";

export function SiteFooter({
  title,
  theme,
}: {
  title: string;
  theme: PublicThemeDefinition;
}) {
  const year = new Date().getFullYear();
  const { footer } = theme.config.templateParts;

  if (footer.layout === "columns") {
    return (
      <footer className="mt-16 border-t border-border">
        <div className="mx-auto grid max-w-5xl gap-5 px-5 py-8 text-sm text-muted sm:px-6 lg:grid-cols-[minmax(0,1fr)_auto] lg:px-8">
          <div>
            <p className="font-medium text-foreground">© {year} {title}</p>
            <p className="mt-2 max-w-xl leading-6">
              {footer.tagline ?? "A modern publishing layer on top of a familiar WordPress-shaped workflow."}
            </p>
          </div>
          <div className="flex items-center gap-4 lg:justify-end">
            <Link href="/feed" className="hover:text-foreground">
              RSS
            </Link>
            <a
              href="https://presslyn.com"
              className="text-accent transition-colors hover:text-foreground"
            >
              Presslyn
            </a>
          </div>
        </div>
      </footer>
    );
  }

  return (
    <footer className="mt-16 border-t border-border">
      <div className="mx-auto flex max-w-3xl flex-col items-center gap-2 px-6 py-8 text-center text-sm text-muted sm:flex-row sm:justify-between sm:text-left">
        <p>
          © {year} {title}
        </p>
        <div className="flex items-center gap-4">
          <Link href="/feed" className="hover:text-foreground">
            RSS
          </Link>
          <span>
            {footer.tagline ?? "Powered by"}{" "}
            <a
              href="https://presslyn.com"
              className="text-accent hover:underline"
            >
              Presslyn
            </a>
          </span>
        </div>
      </div>
    </footer>
  );
}
