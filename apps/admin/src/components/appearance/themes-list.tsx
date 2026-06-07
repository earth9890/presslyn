"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { PaintBoardIcon, CheckmarkCircle01Icon } from "hugeicons-react";
import { apiFetch, ApiError } from "@/lib/api-client";
import { useAdminNavigation } from "@/components/layout/admin-navigation";
import type { StyleVariation } from "@presslyn/core";

export interface ThemeItem {
  id: string;
  name: string;
  version: string;
  description?: string;
  author?: string;
  active: boolean;
  styleVariationId: string | null;
  styleVariations: StyleVariation[];
}

export function ThemesList({ themes }: { themes: ThemeItem[] }) {
  const router = useRouter();
  const { startRefresh } = useAdminNavigation();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [busyVariationThemeId, setBusyVariationThemeId] = useState<string | null>(null);
  const [error, setError] = useState("");

  async function activate(id: string) {
    setBusyId(id);
    setError("");
    try {
      await apiFetch(`/api/v1/themes/${id}/activate`, { method: "POST" });
      const theme = themes.find((entry) => entry.id === id);
      startRefresh(theme ? `Activating ${theme.name}` : "Activating theme");
      router.refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not activate theme.");
    } finally {
      setBusyId(null);
    }
  }

  async function updateStyleVariation(theme: ThemeItem, variationId: string | null) {
    setBusyVariationThemeId(theme.id);
    setError("");
    try {
      await apiFetch(`/api/v1/themes/${theme.id}/style-variation`, {
        method: "POST",
        body: JSON.stringify({ variationId }),
      });
      const variation = theme.styleVariations.find((entry) => entry.id === variationId);
      startRefresh(
        variation
          ? `Applying ${variation.label}`
          : `Updating ${theme.name} style`
      );
      router.refresh();
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : "Could not update theme style variation."
      );
    } finally {
      setBusyVariationThemeId(null);
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
              {theme.active && theme.styleVariations.length > 0 ? (
                <div className="mt-3 space-y-2">
                  <p className="text-xs font-medium text-text-secondary">Style variation</p>
                  <div className="flex flex-wrap gap-2">
                    {theme.styleVariations.map((variation) => {
                      const selected = theme.styleVariationId === variation.id;
                      return (
                        <button
                          key={variation.id}
                          type="button"
                          onClick={() => updateStyleVariation(theme, variation.id)}
                          disabled={busyVariationThemeId === theme.id}
                          className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs transition-colors ${
                            selected
                              ? "border-accent bg-accent/10 text-text-primary"
                              : "border-border text-text-secondary hover:border-accent/40 hover:text-text-primary"
                          }`}
                        >
                          <span
                            className="h-3 w-3 rounded-full border border-black/10"
                            style={{
                              backgroundColor:
                                variation.accent ?? "var(--color-text-muted)",
                            }}
                          />
                          <span>{variation.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
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
