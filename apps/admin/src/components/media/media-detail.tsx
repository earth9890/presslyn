"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { File01Icon } from "hugeicons-react";
import { apiFetch, ApiError } from "@/lib/api-client";
import { MediaImageEditor } from "./media-image-editor";

export interface MediaItem {
  id: number;
  filename: string;
  mimeType: string;
  fileSize: number;
  url: string;
  alt: string;
  title: string;
  width: number | null;
  height: number | null;
  createdAt: string | null;
}

export function MediaDetail({ media }: { media: MediaItem }) {
  const router = useRouter();
  const [alt, setAlt] = useState(media.alt);
  const [title, setTitle] = useState(media.title);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [message, setMessage] = useState<{ tone: "ok" | "err"; text: string } | null>(
    null
  );
  const [copied, setCopied] = useState(false);

  const isImage = media.mimeType.startsWith("image/");

  async function save() {
    setSaving(true);
    setMessage(null);
    try {
      await apiFetch(`/api/v1/media/${media.id}`, {
        method: "PUT",
        body: { alt, title },
      });
      setMessage({ tone: "ok", text: "Saved." });
      router.refresh();
    } catch (err) {
      setMessage({
        tone: "err",
        text: err instanceof ApiError ? err.message : "Could not save.",
      });
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    if (!confirm("Delete this media file permanently?")) return;
    setDeleting(true);
    setMessage(null);
    try {
      await apiFetch(`/api/v1/media/${media.id}`, { method: "DELETE" });
      router.push("/media");
      router.refresh();
    } catch (err) {
      setDeleting(false);
      setMessage({
        tone: "err",
        text: err instanceof ApiError ? err.message : "Could not delete.",
      });
    }
  }

  async function copyUrl() {
    try {
      await navigator.clipboard.writeText(media.url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard unavailable — ignore */
    }
  }

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_22rem]">
      {/* Preview + image editor */}
      {isImage ? (
        <MediaImageEditor
          mediaId={media.id}
          url={media.url}
          alt={media.alt || media.title || media.filename}
        />
      ) : (
        <div className="overflow-hidden rounded-lg border border-border bg-surface">
          <div className="flex aspect-video items-center justify-center bg-surface-raised">
            <File01Icon size={48} className="text-text-muted" />
          </div>
        </div>
      )}

      {/* Metadata + actions */}
      <div className="space-y-4">
        <div className="rounded-lg border border-border bg-surface p-5 text-sm">
          <dl className="space-y-2">
            <Row label="File name" value={media.filename} />
            <Row label="Type" value={media.mimeType} />
            <Row label="Size" value={formatBytes(media.fileSize)} />
            {media.width && media.height ? (
              <Row label="Dimensions" value={`${media.width} × ${media.height}`} />
            ) : null}
            <Row label="Uploaded" value={formatDate(media.createdAt)} />
          </dl>
        </div>

        <div className="space-y-3 rounded-lg border border-border bg-surface p-5">
          {message ? (
            <div
              className={`rounded-md px-3 py-2 text-sm ${
                message.tone === "ok"
                  ? "border border-success/20 bg-success/5 text-success"
                  : "border border-danger/20 bg-danger/5 text-danger"
              }`}
            >
              {message.text}
            </div>
          ) : null}

          <div className="space-y-1.5">
            <label htmlFor="m-title" className="text-xs font-medium text-text-secondary">
              Title
            </label>
            <input
              id="m-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full rounded-md border border-border bg-surface-raised px-3 py-2 text-sm text-text-primary outline-none focus:border-accent"
            />
          </div>
          <div className="space-y-1.5">
            <label htmlFor="m-alt" className="text-xs font-medium text-text-secondary">
              Alt text
            </label>
            <textarea
              id="m-alt"
              value={alt}
              onChange={(e) => setAlt(e.target.value)}
              rows={2}
              className="w-full resize-y rounded-md border border-border bg-surface-raised px-3 py-2 text-sm text-text-primary outline-none focus:border-accent"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-text-secondary">File URL</label>
            <div className="flex gap-2">
              <input
                readOnly
                value={media.url}
                className="w-full rounded-md border border-border bg-surface-raised px-3 py-2 text-xs text-text-muted outline-none"
              />
              <button
                onClick={copyUrl}
                className="shrink-0 rounded-md border border-border bg-surface px-3 py-2 text-xs font-medium text-text-secondary hover:bg-surface-raised"
              >
                {copied ? "Copied" : "Copy"}
              </button>
            </div>
          </div>

          <div className="flex items-center justify-between pt-1">
            <button
              onClick={save}
              disabled={saving}
              className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent-hover disabled:opacity-60"
            >
              {saving ? "Saving…" : "Save"}
            </button>
            <button
              onClick={remove}
              disabled={deleting}
              className="rounded-md border border-danger/30 px-4 py-2 text-sm font-medium text-danger hover:bg-danger/5 disabled:opacity-60"
            >
              {deleting ? "Deleting…" : "Delete permanently"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <dt className="text-text-muted">{label}</dt>
      <dd className="break-all text-right text-text-secondary">{value}</dd>
    </div>
  );
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(date: string | null): string {
  if (!date) return "—";
  return new Date(date).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}
