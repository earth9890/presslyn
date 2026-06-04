import { services } from "@/lib/services";
import { PluginsList, type PluginItem } from "@/components/plugins/plugins-list";

export const dynamic = "force-dynamic";

export default async function PluginsPage() {
  const list = await services.plugins.list();

  const plugins: PluginItem[] = list.map((p) => ({
    id: p.manifest.id,
    name: p.manifest.name,
    version: p.manifest.version,
    description: p.manifest.description,
    author: p.manifest.author,
    active: p.active,
  }));

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <PluginsList plugins={plugins} />
    </div>
  );
}
