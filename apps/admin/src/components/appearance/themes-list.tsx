"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { PaintBoardIcon, CheckmarkCircle01Icon } from "hugeicons-react";
import { apiFetch, ApiError } from "@/lib/api-client";

export interface ThemeItem {
  id: string;
  name: string;
  version: string;
  description?: string;
  author?: string;
  active: boolean;
}

export function ThemesList({ themes }: { themes: ThemeItem[] }) {
  const router = useRouter();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState("");

  async function activate(id: string) {
    setBusyId(id);
    setError("");
    try {
      await apiFetch(`/api/v1/themes/${id}/activate`, { method: "POST" });
      router.refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not activate theme.");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="space-y-6">
      <h2 className="text-lg font-semibold text-text-primary">Themes</h2>
      {error ? (
        <div className="rounded-md border border-danger/20 bg-danger/5 px-3 py-2 text-sm text-danger">
          {error}
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {themes.map((theme) => (
          <div
            key={theme.id}
            className={`overflow-hidden rounded-lg border bg-surface ${
              theme.active ? "border-accent" : "border-border"
            }`}
          >
            <div className="flex aspect-video items-center justify-center bg-surface-raised">
              <PaintBoardIcon size={40} className="text-text-muted" />
            </div>
            <div className="space-y-2 p-4">
              <div className="flex items-center justify-between gap-2">
                <h3 className="font-semibold text-text-primary">{theme.name}</h3>
                {theme.active ? (
                  <span className="inline-flex items-center gap-1 rounded-full border border-success/20 bg-success/10 px-2 py-0.5 text-[11px] font-medium text-success">
                    <CheckmarkCircle01Icon size={10} />
                    Active
                  </span>
                ) : null}
              </div>
              {theme.description ? (
                <p className="text-sm text-text-secondary">{theme.description}</p>
              ) : null}
              <p className="text-xs text-text-muted">
                v{theme.version}
                {theme.author ? ` · ${theme.author}` : ""}
              </p>
              {!theme.active ? (
                <button
                  onClick={() => activate(theme.id)}
                  disabled={busyId === theme.id}
                  className="mt-1 rounded-md bg-accent px-3 py-1.5 text-xs font-medium text-white hover:bg-accent-hover disabled:opacity-60"
                >
                  {busyId === theme.id ? "Activating…" : "Activate"}
                </button>
              ) : null}
            </div>
          </div>
        ))}
      </div>

      <section className="rounded-lg border border-border bg-surface p-5">
        <h3 className="text-sm font-semibold text-text-primary">Menus &amp; Widgets</h3>
        <p className="mt-1 text-sm text-text-secondary">
          Navigation menus and widget areas arrive with the block-based theme
          engine (Phase 4.1). The active theme above drives the public site
          today.
        </p>
      </section>
    </div>
  );
}
