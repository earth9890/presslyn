import Link from "next/link";
import { getActivePublicTheme, getThemeTemplate } from "@/themes/public-theme";
import { renderThemeTemplatePart } from "@/themes/template-renderer";

export default async function NotFound() {
  const theme = await getActivePublicTheme();
  const template = getThemeTemplate(theme, "404");
  const content = await renderThemeTemplatePart(theme, "404", {
    siteTitle: "Presslyn",
  });

  return (
    <div
      className={
        template.frame === "card"
          ? "rounded-[1.8rem] border border-border bg-surface py-20 text-center shadow-[0_18px_42px_rgba(17,24,39,0.06)]"
          : "py-20 text-center"
      }
    >
      <p className="font-serif text-6xl font-bold text-accent">404</p>
      <div className="mt-4 space-y-3">{content}</div>
      <Link
        href="/"
        className="mt-6 inline-block rounded-md bg-accent px-5 py-2.5 font-medium text-background"
      >
        Back home
      </Link>
    </div>
  );
}
