import Link from "next/link";

export function SiteFooter({ title }: { title: string }) {
  const year = new Date().getFullYear();
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
            Powered by{" "}
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
