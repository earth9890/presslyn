"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Upload01Icon } from "hugeicons-react";
import { apiFetch, ApiError } from "@/lib/api-client";

interface ImportSummary {
  posts: number;
  pages: number;
  categories: number;
  tags: number;
  comments: number;
  skipped: number;
}

export function ImportButton() {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [summary, setSummary] = useState<ImportSummary | null>(null);

  async function handleFile(file: File) {
    setBusy(true);
    setError("");
    setSummary(null);
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await apiFetch<{ summary: ImportSummary }>("/api/v1/import", {
        method: "POST",
        body: form,
        raw: true,
      });
      setSummary(res.summary);
      router.refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Import failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="ml-4 flex shrink-0 flex-col items-end gap-1">
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={busy}
        className="inline-flex items-center gap-1.5 rounded-md bg-accent px-3 py-1.5 text-xs font-medium text-white hover:bg-accent-hover disabled:opacity-60"
      >
        <Upload01Icon size={14} />
        {busy ? "Importing…" : "Choose WXR file"}
      </button>
      <input
        ref={inputRef}
        type="file"
        accept=".xml,application/xml,text/xml"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleFile(file);
          e.target.value = "";
        }}
      />
      {error ? <span className="max-w-xs text-right text-xs text-danger">{error}</span> : null}
      {summary ? (
        <span className="text-right text-xs text-success">
          Imported {summary.posts} posts, {summary.pages} pages,{" "}
          {summary.comments} comments ({summary.categories} categories,{" "}
          {summary.tags} tags; {summary.skipped} skipped).
        </span>
      ) : null}
    </div>
  );
}
