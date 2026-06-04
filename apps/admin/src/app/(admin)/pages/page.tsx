import { ContentListTable } from "@/components/content/content-list-table";
import { getContentListScreenData } from "@/lib/content-list";

export const dynamic = "force-dynamic";

export default async function PagesPage({
  searchParams,
}: {
  searchParams: Promise<{
    status?: string;
    search?: string;
    page?: string;
    perPage?: string;
    archive?: string;
  }>;
}) {
  const params = await searchParams;
  const data = await getContentListScreenData("page", {
    status: params.status ?? "all",
    search: params.search ?? "",
    page: Number(params.page ?? 1),
    perPage: Number(params.perPage ?? 20),
    archive: params.archive,
  });

  return (
    <ContentListTable
      basePath="/pages"
      itemLabel="Page"
      rows={data.rows}
      status={data.status}
      search={data.search}
      page={data.page}
      perPage={data.perPage}
      total={data.total}
      offset={data.offset}
      archive={data.archive}
      counts={data.counts}
      categoryOptions={data.categoryOptions}
      archiveOptions={data.archiveOptions}
    />
  );
}
