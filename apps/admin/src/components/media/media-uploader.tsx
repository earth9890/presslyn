"use client";

import { useRouter } from "next/navigation";
import { useRef, useState, type DragEvent } from "react";
import { Upload01Icon, CheckmarkCircle01Icon, Cancel01Icon } from "hugeicons-react";
import { apiFetch, ApiError } from "@/lib/api-client";

interface UploadItem {
  name: string;
  status: "uploading" | "done" | "error";
  message?: string;
}

/**
 * Drag-and-drop / file-picker uploader. Uploads each selected file to
 * `POST /api/v1/media` (multipart). Files are sent sequentially so the
 * progress list reflects per-file success/failure.
 */
export function MediaUploader() {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const [items, setItems] = useState<UploadItem[]>([]);
  const [busy, setBusy] = useState(false);

  async function uploadFiles(files: FileList | File[]) {
    const list = Array.from(files);
    if (list.length === 0) return;

    setBusy(true);
    setItems(list.map((f) => ({ name: f.name, status: "uploading" })));

    let anySucceeded = false;
    for (let i = 0; i < list.length; i++) {
      const file = list[i];
      const form = new FormData();
      form.append("file", file);
      try {
        await apiFetch("/api/v1/media", { method: "POST", body: form, raw: true });
        anySucceeded = true;
        setItems((prev) =>
          prev.map((it, idx) => (idx === i ? { ...it, status: "done" } : it))
        );
      } catch (err) {
        const message = err instanceof ApiError ? err.message : "Upload failed.";
        setItems((prev) =>
          prev.map((it, idx) =>
            idx === i ? { ...it, status: "error", message } : it
          )
        );
      }
    }

    setBusy(false);
    if (anySucceeded) router.refresh();
  }

  function handleDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setDragOver(false);
    // Ignore drops while a batch is in flight — a concurrent uploadFiles()
    // would reset the item list and race the in-progress loop.
    if (busy) return;
    if (e.dataTransfer.files?.length) uploadFiles(e.dataTransfer.files);
  }

  return (
    <div className="space-y-3">
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        className={`flex flex-col items-center justify-center rounded-lg border-2 border-dashed px-6 py-12 text-center transition-colors ${
          dragOver
            ? "border-accent bg-accent/5"
            : "border-border bg-surface hover:border-accent/50"
        }`}
      >
        <Upload01Icon size={32} className="mb-3 text-text-muted" />
        <p className="text-sm font-medium text-text-primary">
          Drop files to upload
        </p>
        <p className="mt-1 text-xs text-text-muted">or</p>
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={busy}
          className="mt-2 rounded-md bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent-hover disabled:opacity-60"
        >
          Select Files
        </button>
        <input
          ref={inputRef}
          type="file"
          multiple
          className="hidden"
          onChange={(e) => {
            if (e.target.files) uploadFiles(e.target.files);
            e.target.value = "";
          }}
        />
        <p className="mt-3 text-xs text-text-muted">
          Images are processed into thumbnail, medium, and large sizes
          automatically. Max 50&nbsp;MB per file.
        </p>
      </div>

      {items.length > 0 ? (
        <ul className="space-y-1.5 rounded-lg border border-border bg-surface p-3">
          {items.map((item, idx) => (
            <li key={idx} className="flex items-center gap-2 text-sm">
              {item.status === "uploading" ? (
                <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-accent border-t-transparent" />
              ) : item.status === "done" ? (
                <CheckmarkCircle01Icon size={14} className="text-success" />
              ) : (
                <Cancel01Icon size={14} className="text-danger" />
              )}
              <span className="truncate text-text-secondary">{item.name}</span>
              {item.message ? (
                <span className="text-xs text-danger">— {item.message}</span>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
