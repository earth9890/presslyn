"use client";

import { type FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { apiFetch, ApiError } from "@/lib/api-client";
import { useAdminNavigation } from "@/components/layout/admin-navigation";

export interface NetworkSiteItem {
  id: number;
  name: string;
  domain: string;
  path: string;
  status: "active" | "archived" | "deleted";
  isPrimary: boolean;
  createdAt: string;
}

export function NetworkSites({ sites }: { sites: NetworkSiteItem[] }) {
  const router = useRouter();
  const { startRefresh } = useAdminNavigation();
  const [name, setName] = useState("");
  const [domain, setDomain] = useState("");
  const [path, setPath] = useState("/");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function createSite(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      await apiFetch("/api/v1/sites", {
        method: "POST",
        body: { name, domain, path },
      });
      startRefresh(`Creating ${name}`);
      setName("");
      setDomain("");
      setPath("/");
      router.refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not create site.");
    } finally {
      setBusy(false);
    }
  }

  async function updateStatus(site: NetworkSiteItem, status: NetworkSiteItem["status"]) {
    setBusy(true);
    setError("");
    try {
      await apiFetch(`/api/v1/sites/${site.id}`, {
        method: "PUT",
        body: { status },
      });
      startRefresh(`Updating ${site.name}`);
      router.refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not update site.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <form
        onSubmit={createSite}
        className="grid gap-4 rounded-lg border border-border bg-surface p-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_180px_auto]"
      >
        <label className="space-y-1 text-sm">
          <span className="font-medium text-text-primary">Site name</span>
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            required
            className="w-full rounded-md border border-border bg-background px-3 py-2 outline-none focus:border-accent"
          />
        </label>
        <label className="space-y-1 text-sm">
          <span className="font-medium text-text-primary">Domain</span>
          <input
            value={domain}
            onChange={(event) => setDomain(event.target.value)}
            required
            placeholder="docs.example.com"
            className="w-full rounded-md border border-border bg-background px-3 py-2 outline-none focus:border-accent"
          />
        </label>
        <label className="space-y-1 text-sm">
          <span className="font-medium text-text-primary">Path</span>
          <input
            value={path}
            onChange={(event) => setPath(event.target.value)}
            required
            className="w-full rounded-md border border-border bg-background px-3 py-2 outline-none focus:border-accent"
          />
        </label>
        <div className="flex items-end">
          <button
            type="submit"
            disabled={busy}
            className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
          >
            Add Site
          </button>
        </div>
      </form>

      {error ? (
        <div className="rounded-md border border-danger/20 bg-danger/5 px-3 py-2 text-sm text-danger">
          {error}
        </div>
      ) : null}

      <div className="overflow-hidden rounded-lg border border-border bg-surface">
        <table className="min-w-full divide-y divide-border text-sm">
          <thead className="bg-surface-raised text-left text-text-secondary">
            <tr>
              <th className="px-4 py-3 font-medium">Site</th>
              <th className="px-4 py-3 font-medium">Address</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium">Created</th>
              <th className="px-4 py-3 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {sites.map((site) => (
              <tr key={site.id}>
                <td className="px-4 py-3">
                  <div className="font-medium text-text-primary">{site.name}</div>
                  {site.isPrimary ? (
                    <div className="mt-1 text-xs text-accent">Primary site</div>
                  ) : null}
                </td>
                <td className="px-4 py-3 text-text-secondary">
                  {site.domain}
                  {site.path}
                </td>
                <td className="px-4 py-3 capitalize text-text-secondary">{site.status}</td>
                <td className="px-4 py-3 text-text-secondary">
                  {new Date(site.createdAt).toLocaleDateString()}
                </td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap gap-2">
                    {site.status !== "active" ? (
                      <button
                        onClick={() => updateStatus(site, "active")}
                        disabled={busy}
                        className="rounded-md border border-border px-3 py-1 text-xs text-text-secondary hover:bg-surface-raised disabled:opacity-60"
                      >
                        Activate
                      </button>
                    ) : null}
                    {site.status !== "archived" ? (
                      <button
                        onClick={() => updateStatus(site, "archived")}
                        disabled={busy || site.isPrimary}
                        className="rounded-md border border-border px-3 py-1 text-xs text-text-secondary hover:bg-surface-raised disabled:opacity-60"
                      >
                        Archive
                      </button>
                    ) : null}
                    {site.status !== "deleted" ? (
                      <button
                        onClick={() => updateStatus(site, "deleted")}
                        disabled={busy || site.isPrimary}
                        className="rounded-md border border-border px-3 py-1 text-xs text-danger hover:bg-danger/5 disabled:opacity-60"
                      >
                        Delete
                      </button>
                    ) : null}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
