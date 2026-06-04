import {
  Wrench01Icon,
  Upload01Icon,
  Download01Icon,
  CheckmarkCircle01Icon,
} from "hugeicons-react";
import { services } from "@/lib/services";
import { ExportButton } from "@/components/tools/export-button";
import { ImportButton } from "@/components/tools/import-button";

export const dynamic = "force-dynamic";

export default async function ToolsPage() {
  // Real site-health probes against the live services + runtime.
  let dbOk = true;
  let postCount = 0;
  let siteUrl = "";
  try {
    const [posts, pages, url] = await Promise.all([
      services.content.queryPosts({ postType: "post", limit: 1 }),
      services.content.queryPosts({ postType: "page", limit: 1 }),
      services.options.getOption("siteurl").catch(() => ""),
    ]);
    postCount = posts.total + pages.total;
    siteUrl = String(url ?? "");
  } catch {
    dbOk = false;
  }

  const httpsOk = siteUrl.startsWith("https://");
  const redisConfigured = Boolean(process.env.REDIS_URL);

  const siteHealth: { label: string; value: string; ok: boolean | null }[] = [
    { label: "Runtime", value: `Node.js ${process.version}`, ok: true },
    {
      label: "Database",
      value: dbOk ? "PostgreSQL — connected" : "Connection failed",
      ok: dbOk,
    },
    {
      label: "Content items",
      value: dbOk ? `${postCount} posts & pages` : "—",
      ok: dbOk ? true : null,
    },
    {
      label: "HTTPS",
      value: siteUrl ? (httpsOk ? "Enabled" : "Site URL is not https") : "Site URL not set",
      ok: siteUrl ? httpsOk : null,
    },
    {
      label: "Object Cache",
      value: redisConfigured ? "Redis configured" : "In-memory (no Redis)",
      ok: redisConfigured ? true : null,
    },
    { label: "File Uploads", value: "Local storage", ok: true },
  ];

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      {/* Export */}
      <section className="rounded-lg border border-border bg-surface">
        <div className="flex items-center gap-2 border-b border-border px-5 py-3.5">
          <Download01Icon size={20} className="text-accent" />
          <h3 className="text-sm font-semibold text-text-primary">Export</h3>
        </div>
        <div className="flex items-center justify-between px-5 py-4">
          <div>
            <p className="text-sm font-medium text-text-primary">Export All Content</p>
            <p className="mt-0.5 max-w-lg text-xs text-text-muted">
              Download all posts, pages, comments, categories, tags, and authors
              as a WXR file compatible with the WordPress importer.
            </p>
          </div>
          <ExportButton />
        </div>
      </section>

      {/* Import (pending Phase 6.3) */}
      <section className="rounded-lg border border-border bg-surface">
        <div className="flex items-center gap-2 border-b border-border px-5 py-3.5">
          <Upload01Icon size={20} className="text-accent" />
          <h3 className="text-sm font-semibold text-text-primary">Import</h3>
        </div>
        <div className="flex items-center justify-between px-5 py-4">
          <div>
            <p className="text-sm font-medium text-text-primary">WordPress (WXR)</p>
            <p className="mt-0.5 max-w-lg text-xs text-text-muted">
              Import posts, pages, comments, categories, and tags from a
              WordPress (or Presslyn) WXR export file. Existing slugs are
              skipped, and unmatched authors are attributed to you.
            </p>
          </div>
          <ImportButton />
        </div>
      </section>

      {/* Site Health */}
      <section className="rounded-lg border border-border bg-surface">
        <div className="flex items-center gap-2 border-b border-border px-5 py-3.5">
          <Wrench01Icon size={20} className="text-accent" />
          <h3 className="text-sm font-semibold text-text-primary">Site Health</h3>
        </div>
        <div className="divide-y divide-border">
          {siteHealth.map((item) => (
            <div
              key={item.label}
              className="flex items-center justify-between px-5 py-3.5"
            >
              <div className="flex items-center gap-3">
                <CheckmarkCircle01Icon
                  size={16}
                  className={
                    item.ok === true
                      ? "text-success"
                      : item.ok === false
                        ? "text-danger"
                        : "text-warning"
                  }
                />
                <span className="text-sm text-text-secondary">{item.label}</span>
              </div>
              <span className="text-sm font-medium text-text-primary">{item.value}</span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
