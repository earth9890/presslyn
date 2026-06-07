"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { PuzzleIcon, CheckmarkCircle01Icon } from "hugeicons-react";
import { apiFetch, ApiError } from "@/lib/api-client";
import { useAdminNavigation } from "@/components/layout/admin-navigation";

export interface PluginItem {
  id: string;
  name: string;
  version: string;
  description?: string;
  author?: string;
  active: boolean;
}

export function PluginsList({ plugins }: { plugins: PluginItem[] }) {
  const router = useRouter();
  const { startRefresh } = useAdminNavigation();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState("");

  async function toggle(plugin: PluginItem) {
    setBusyId(plugin.id);
    setError("");
    try {
      const action = plugin.active ? "deactivate" : "activate";
      await apiFetch(`/api/v1/plugins/${plugin.id}/${action}`, {
        method: "POST",
      });
      startRefresh(
        plugin.active
          ? `Disabling ${plugin.name}`
          : `Activating ${plugin.name}`
      );
      router.refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Action failed.");
    } finally {
      setBusyId(null);
    }
  }

  if (plugins.length === 0) {
    return (
      <div className="rounded-lg border border-border bg-surface py-20 text-center">
        <PuzzleIcon size={40} className="mx-auto mb-4 text-text-muted" />
        <h3 className="text-base font-semibold text-text-primary">
          No plugins installed
        </h3>
        <p className="mt-2 text-sm text-text-secondary">
          Bundled plugins register themselves at startup and appear here.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {error ? (
        <div className="rounded-md border border-danger/20 bg-danger/5 px-3 py-2 text-sm text-danger">
          {error}
        </div>
      ) : null}
      <div className="overflow-hidden rounded-lg border border-border bg-surface divide-y divide-border">
        {plugins.map((plugin) => (
          <div
            key={plugin.id}
            className="flex items-center justify-between gap-4 px-5 py-4"
          >
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <p className="font-medium text-text-primary">{plugin.name}</p>
                <span className="text-xs text-text-muted">v{plugin.version}</span>
                {plugin.active ? (
                  <span className="inline-flex items-center gap-1 rounded-full border border-success/20 bg-success/10 px-2 py-0.5 text-[11px] font-medium text-success">
                    <CheckmarkCircle01Icon size={10} />
                    Active
                  </span>
                ) : null}
              </div>
              {plugin.description ? (
                <p className="mt-1 max-w-xl text-sm text-text-secondary">
                  {plugin.description}
                </p>
              ) : null}
              {plugin.author ? (
                <p className="mt-0.5 text-xs text-text-muted">By {plugin.author}</p>
              ) : null}
            </div>
            <button
              onClick={() => toggle(plugin)}
              disabled={busyId === plugin.id}
              className={`shrink-0 rounded-md px-3 py-1.5 text-xs font-medium disabled:opacity-60 ${
                plugin.active
                  ? "border border-border bg-surface text-text-secondary hover:bg-surface-raised"
                  : "bg-accent text-white hover:bg-accent-hover"
              }`}
            >
              {busyId === plugin.id
                ? "…"
                : plugin.active
                  ? "Deactivate"
                  : "Activate"}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
