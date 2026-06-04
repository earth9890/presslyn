import { services } from "@/lib/services";
import { ThemesList, type ThemeItem } from "@/components/appearance/themes-list";

export const dynamic = "force-dynamic";

export default async function AppearancePage() {
  const list = await services.themes.list();

  const themes: ThemeItem[] = list.map((t) => ({
    id: t.manifest.id,
    name: t.manifest.name,
    version: t.manifest.version,
    description: t.manifest.description,
    author: t.manifest.author,
    active: t.active,
  }));

  return (
    <div className="mx-auto max-w-6xl">
      <ThemesList themes={themes} />
    </div>
  );
}
