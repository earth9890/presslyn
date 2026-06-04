"use client";

import { useState } from "react";
import { Download01Icon } from "hugeicons-react";
import { getSessionToken } from "@/lib/api-client";

/**
 * Downloads the WXR export. Uses an authenticated fetch (the REST API reads
 * the JWT from the Authorization header, which a plain anchor download
 * cannot supply) and triggers a client-side blob download.
 */
export function ExportButton() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function handleExport() {
    setBusy(true);
    setError("");
    try {
      const token = getSessionToken();
      if (!token) {
        setError("Your session expired. Sign in again and retry.");
        return;
      }

      const res = await fetch("/api/v1/export", {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as
          | { error?: string }
          | null;
        setError(body?.error ?? `Export failed (${res.status}).`);
        return;
      }

      const blob = await res.blob();
      const disposition = res.headers.get("Content-Disposition") ?? "";
      const match = disposition.match(/filename="([^"]+)"/);
      const filename = match?.[1] ?? "presslyn-export.xml";

      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch {
      setError("Export failed. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="ml-4 flex shrink-0 flex-col items-end gap-1">
      <button
        onClick={handleExport}
        disabled={busy}
        className="inline-flex items-center gap-1.5 rounded-md bg-accent px-3 py-1.5 text-xs font-medium text-white hover:bg-accent-hover disabled:opacity-60"
      >
        <Download01Icon size={14} />
        {busy ? "Exporting…" : "Download Export File"}
      </button>
      {error ? <span className="text-xs text-danger">{error}</span> : null}
    </div>
  );
}
