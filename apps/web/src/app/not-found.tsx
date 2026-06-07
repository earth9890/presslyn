import Link from "next/link";
import { getActivePublicTheme, getThemeTemplate } from "@/themes/public-theme";

export default async function NotFound() {
  const theme = await getActivePublicTheme();
  const template = getThemeTemplate(theme, "404");

  return (
    <div
      className={
        template.frame === "card"
          ? "rounded-[1.8rem] border border-border bg-surface py-20 text-center shadow-[0_18px_42px_rgba(17,24,39,0.06)]"
          : "py-20 text-center"
      }
    >
      <p className="font-serif text-6xl font-bold text-accent">404</p>
      <h1 className="mt-4 font-serif text-2xl font-bold">Page not found</h1>
      <p className="mt-2 text-muted">
        The page you were looking for doesn’t exist or has been moved.
      </p>
      <Link
        href="/"
        className="mt-6 inline-block rounded-md bg-accent px-5 py-2.5 font-medium text-background"
      >
        Back home
      </Link>
    </div>
  );
}
