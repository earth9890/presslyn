import { services } from "@/lib/services";
import { TaxonomyManager, type TermRow } from "@/components/taxonomy/taxonomy-manager";

export const dynamic = "force-dynamic";

export default async function CategoriesPage() {
  const terms = await services.taxonomy.getTermsWithCounts("category");

  const rows: TermRow[] = terms.map((t) => ({
    id: t.id,
    name: t.name,
    slug: t.slug,
    description: t.description,
    parentId: t.parentId,
    count: t.count,
  }));

  return (
    <div className="mx-auto max-w-6xl">
      <TaxonomyManager
        taxonomySlug="category"
        label="Category"
        hierarchical
        terms={rows}
      />
    </div>
  );
}
