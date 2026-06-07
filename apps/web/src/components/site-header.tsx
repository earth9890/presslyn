import type { PublicThemeDefinition } from "@/themes/public-theme";
import { renderThemeTemplatePart } from "@/themes/template-renderer";

interface SiteHeaderProps {
  title: string;
  description: string;
  categories: { slug: string; name: string }[];
  theme: PublicThemeDefinition;
}

export async function SiteHeader({
  title,
  description,
  categories,
  theme,
}: SiteHeaderProps) {
  const { header } = theme.config.templateParts;
  const content = await renderThemeTemplatePart(theme, "header", {
    siteTitle: title,
    siteDescription: header.showDescription ? description : undefined,
    categories,
  });

  return (
    <header className="border-b border-border">
      <div
        className={
          header.layout === "split"
            ? "mx-auto flex max-w-5xl flex-col gap-6 px-5 py-8 sm:px-6 lg:px-8"
            : "mx-auto flex max-w-3xl flex-col gap-4 px-6 py-8"
        }
      >
        {content}
      </div>
    </header>
  );
}
