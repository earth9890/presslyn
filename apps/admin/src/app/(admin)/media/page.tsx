import Link from "next/link";
import {
  Add01Icon,
  Image01Icon,
  File01Icon,
  Search01Icon,
} from "hugeicons-react";
import { services } from "@/lib/services";

export const dynamic = "force-dynamic";

export default async function MediaPage({
  searchParams,
}: {
  searchParams: Promise<{
    search?: string;
    type?: string;
    view?: string;
    month?: string;
    page?: string;
    perPage?: string;
  }>;
}) {
  const params = await searchParams;
  const search = params.search ?? "";
  const type = params.type ?? "all";
  const view = params.view === "list" ? "list" : "grid";
  const month = /^\d{4}-\d{2}$/.test(params.month ?? "") ? params.month! : "";
  const page = Math.max(1, Number(params.page ?? 1));
  const limit = Math.min(100, Math.max(1, Number(params.perPage ?? 60)));
  const offset = (page - 1) * limit;

  // Map a YYYY-MM month filter to an inclusive [from, to) range.
  let dateFrom: string | undefined;
  let dateTo: string | undefined;
  if (month) {
    const [y, m] = month.split("-").map(Number);
    dateFrom = new Date(Date.UTC(y, m - 1, 1)).toISOString();
    dateTo = new Date(Date.UTC(y, m, 1)).toISOString();
  }

  const { media: items, total } = await services.media.query({
    search: search || undefined,
    dateFrom,
    dateTo,
    orderBy: "date",
    order: "desc",
    limit,
    offset,
  });

  const filtered =
    type === "all"
      ? items
      : items.filter((m) => {
          if (type === "image") return m.mimeType.startsWith("image/");
          if (type === "document") return m.mimeType === "application/pdf";
          if (type === "audio") return m.mimeType.startsWith("audio/");
          if (type === "video") return m.mimeType.startsWith("video/");
          return true;
        });
  const canPaginate = type === "all";

  const typeTabs = [
    { key: "all", label: "All" },
    { key: "image", label: "Images" },
    { key: "document", label: "Documents" },
    { key: "audio", label: "Audio" },
    { key: "video", label: "Video" },
  ];
  const buildMediaHref = (updates: Record<string, string | number | undefined>) =>
    buildListHref("/media", {
      type,
      search,
      view: view === "grid" ? undefined : view,
      month,
      page,
      perPage: limit,
      ...updates,
    });

  return (
    <div className="mx-auto max-w-6xl space-y-4">
      {/* Filters */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-0.5 rounded-lg border border-border bg-surface p-1">
          {typeTabs.map((tab) => (
            <Link
              key={tab.key}
              href={buildMediaHref({ type: tab.key })}
              className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                type === tab.key
                  ? "bg-accent text-white"
                  : "text-text-secondary hover:text-text-primary hover:bg-surface-raised"
              }`}
            >
              {tab.label}
            </Link>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Date (month) filter + view toggle live in one GET form */}
          <form method="GET" className="flex flex-wrap items-center gap-2">
            <input type="hidden" name="type" value={type} />
            <input type="hidden" name="perPage" value={limit} />
            {view === "list" ? <input type="hidden" name="view" value="list" /> : null}
            <div className="relative">
              <Search01Icon
                size={14}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted"
              />
              <input
                name="search"
                defaultValue={search}
                placeholder="Search media…"
                className="w-48 rounded-md border border-border bg-surface py-2 pl-8 pr-3 text-sm text-text-primary placeholder:text-text-muted outline-none focus:border-accent focus-visible:ring-2 focus-visible:ring-accent"
              />
            </div>
            <input
              type="month"
              name="month"
              defaultValue={month}
              aria-label="Filter by month"
              className="rounded-md border border-border bg-surface px-2 py-2 text-sm text-text-secondary outline-none focus:border-accent"
            />
            <button
              type="submit"
              className="rounded-md border border-border bg-surface px-3 py-2 text-sm font-medium text-text-secondary hover:bg-surface-raised"
            >
              Filter
            </button>
          </form>

          {/* Grid / List view toggle */}
          <div className="flex items-center gap-0.5 rounded-lg border border-border bg-surface p-1">
            <Link
              href={buildMediaHref({ view: undefined })}
              className={`rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors ${
                view === "grid"
                  ? "bg-accent text-white"
                  : "text-text-secondary hover:text-text-primary hover:bg-surface-raised"
              }`}
            >
              Grid
            </Link>
            <Link
              href={buildMediaHref({ view: "list" })}
              className={`rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors ${
                view === "list"
                  ? "bg-accent text-white"
                  : "text-text-secondary hover:text-text-primary hover:bg-surface-raised"
              }`}
            >
              List
            </Link>
          </div>
        </div>
      </div>

      {/* Grid */}
      {filtered.length === 0 ? (
        <div className="rounded-lg border border-border bg-surface py-20 text-center">
          <Image01Icon size={32} className="mx-auto mb-3 text-text-muted" />
          <p className="text-sm text-text-secondary">No media files found.</p>
          <Link
            href="/media/upload"
            className="mt-3 inline-flex items-center gap-1.5 text-sm text-accent hover:underline"
          >
            <Add01Icon size={14} />
            Upload your first file
          </Link>
        </div>
      ) : view === "list" ? (
        <div className="overflow-hidden rounded-lg border border-border bg-surface">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-surface-raised text-left">
                <th className="px-4 py-3 font-medium text-text-primary">File</th>
                <th className="hidden px-4 py-3 font-medium text-text-primary sm:table-cell">
                  Type
                </th>
                <th className="hidden px-4 py-3 font-medium text-text-primary md:table-cell">
                  Size
                </th>
                <th className="hidden px-4 py-3 font-medium text-text-primary lg:table-cell">
                  Uploaded
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filtered.map((item) => (
                <tr key={item.id} className="hover:bg-surface-raised transition-colors">
                  <td className="px-4 py-2">
                    <Link href={`/media/${item.id}`} className="flex items-center gap-3">
                      {item.mimeType.startsWith("image/") ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={item.url}
                          alt={item.alt || item.title || ""}
                          className="h-10 w-10 shrink-0 rounded object-cover"
                          loading="lazy"
                        />
                      ) : (
                        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded bg-surface-raised">
                          <File01Icon size={18} className="text-text-muted" />
                        </span>
                      )}
                      <span className="min-w-0">
                        <span className="block truncate font-medium text-text-primary hover:text-accent">
                          {item.title || item.filename}
                        </span>
                        <span className="block truncate text-xs text-text-muted">
                          {item.filename}
                        </span>
                      </span>
                    </Link>
                  </td>
                  <td className="hidden px-4 py-2 text-text-secondary sm:table-cell">
                    {item.mimeType}
                  </td>
                  <td className="hidden px-4 py-2 text-text-secondary md:table-cell">
                    {formatBytes(item.fileSize)}
                  </td>
                  <td className="hidden px-4 py-2 text-text-muted lg:table-cell">
                    {formatDate(item.createdAt)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
          {filtered.map((item) => (
            <Link
              key={item.id}
              href={`/media/${item.id}`}
              className="group relative rounded-lg border border-border bg-surface overflow-hidden transition-shadow hover:shadow-md"
            >
              {item.mimeType.startsWith("image/") ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={item.url}
                  alt={item.alt || item.title || ""}
                  className="aspect-square w-full object-cover"
                  loading="lazy"
                />
              ) : (
                <div className="aspect-square flex items-center justify-center bg-surface-raised">
                  <File01Icon size={32} className="text-text-muted" />
                </div>
              )}
              <div className="p-2">
                <p className="truncate text-[11px] font-medium text-text-secondary">
                  {item.title || item.filename}
                </p>
                <p className="text-[10px] text-text-muted">{formatBytes(item.fileSize)}</p>
              </div>
            </Link>
          ))}
        </div>
      )}

      {canPaginate && total > limit ? (
        <div className="flex items-center justify-between text-sm">
          <p className="text-text-muted">
            Showing {offset + 1}–{Math.min(offset + filtered.length, total)} of {total}
          </p>
          <div className="flex items-center gap-2">
            {page > 1 ? (
              <Link
                href={buildMediaHref({ page: page - 1 })}
                className="rounded-md border border-border bg-surface px-3 py-1.5 text-text-secondary hover:bg-surface-raised"
              >
                Previous
              </Link>
            ) : null}
            {offset + limit < total ? (
              <Link
                href={buildMediaHref({ page: page + 1 })}
                className="rounded-md border border-border bg-surface px-3 py-1.5 text-text-secondary hover:bg-surface-raised"
              >
                Next
              </Link>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(date: Date | string | null): string {
  if (!date) return "—";
  return new Date(date).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function buildListHref(
  pathname: string,
  params: Record<string, string | number | undefined>
) {
  const query = new URLSearchParams();

  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === "" || value === "all") {
      continue;
    }

    query.set(key, String(value));
  }

  const search = query.toString();
  return search ? `${pathname}?${search}` : pathname;
}
