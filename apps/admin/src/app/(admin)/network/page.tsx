import { NetworkSites, type NetworkSiteItem } from "@/components/network/network-sites";
import { services } from "@/lib/services";

export const dynamic = "force-dynamic";

export default async function NetworkPage() {
  const list = await services.multisite.listSites();

  const sites: NetworkSiteItem[] = list.map((site) => ({
    id: site.id,
    name: site.name,
    domain: site.domain,
    path: site.path,
    status: site.status,
    isPrimary: site.isPrimary,
    createdAt: site.createdAt.toISOString(),
  }));

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <NetworkSites sites={sites} />
    </div>
  );
}
