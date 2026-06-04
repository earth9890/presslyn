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
    page?: string;
    perPage?: string;
  }>;
}) {
  const params = await searchParams;
  const search = params.search ?? "";
  const type = params.type ?? "all";
  const page = Math.max(1, Number(params.page ?? 1));
  const limit = Math.min(100, Math.max(1, Number(params.perPage ?? 60)));
  const offset = (page - 1) * limit;

  const { media: items, total } = await services.media.query({
    search: search || undefined,
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

        <form method="GET" className="relative">
          <input type="hidden" name="type" value={type} />
          <input type="hidden" name="perPage" value={limit} />
          <Search01Icon
            size={14}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted"
          />
          <input
            name="search"
            defaultValue={search}
            placeholder="Search media…"
            className="w-56 rounded-md border border-border bg-surface py-2 pl-8 pr-3 text-sm text-text-primary placeholder:text-text-muted outline-none focus:border-accent focus-visible:ring-2 focus-visible:ring-accent"
          />
        </form>
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
