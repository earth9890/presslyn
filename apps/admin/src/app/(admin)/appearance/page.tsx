import { services } from "@/lib/services";
import { ThemesList, type ThemeItem } from "@/components/appearance/themes-list";
import { loadAdminThemeCatalog } from "@/lib/theme-catalog";

export const dynamic = "force-dynamic";

export default async function AppearancePage() {
  const list = await services.themes.list();
  const catalog = loadAdminThemeCatalog();

  const themes: ThemeItem[] = list.map((t) => ({
    id: t.manifest.id,
    name: t.manifest.name,
    version: t.manifest.version,
    description: t.manifest.description,
    author: t.manifest.author,
    active: t.active,
    styleVariationId: t.styleVariationId,
    styleVariations: catalog.get(t.manifest.id)?.styleVariations ?? [],
  }));

  return (
    <div className="mx-auto max-w-6xl">
      <ThemesList themes={themes} />
    </div>
  );
}
