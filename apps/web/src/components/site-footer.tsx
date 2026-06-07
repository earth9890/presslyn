import type { PublicThemeDefinition } from "@/themes/public-theme";
import { renderThemeTemplatePart } from "@/themes/template-renderer";

export async function SiteFooter({
  title,
  theme,
}: {
  title: string;
  theme: PublicThemeDefinition;
}) {
  const { footer } = theme.config.templateParts;
  const content = await renderThemeTemplatePart(theme, "footer", {
    siteTitle: title,
  });

  return (
    <footer className="mt-16 border-t border-border">
      <div
        className={
          footer.layout === "columns"
            ? "mx-auto grid max-w-5xl gap-5 px-5 py-8 text-sm text-muted sm:px-6 lg:grid-cols-[minmax(0,1fr)_auto] lg:px-8"
            : "mx-auto flex max-w-3xl flex-col items-center gap-2 px-6 py-8 text-center text-sm text-muted sm:flex-row sm:justify-between sm:text-left"
        }
      >
        {content}
      </div>
    </footer>
  );
}
