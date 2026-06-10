"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { PencilEdit02Icon, SentIcon } from "hugeicons-react";
import { getSessionToken } from "@/lib/api-client";

interface QuickDraftWidgetProps {
  siteTitle: string;
}

interface CreatePostResponse {
  id: number;
  title: string;
}

export function QuickDraftWidget({ siteTitle }: QuickDraftWidgetProps) {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [saving, setSaving] = useState(false);
  const [savedDraftId, setSavedDraftId] = useState<number | null>(null);
  const [error, setError] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!title.trim()) {
      setError("Add a title before saving a draft.");
      return;
    }

    const token = getSessionToken();

    if (!token) {
      setError("Your session expired. Sign in again and retry.");
      return;
    }

    setSaving(true);
    setError("");
    setSavedDraftId(null);

    try {
      const response = await fetch("/api/v1/posts", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          title: title.trim(),
          content: content.trim(),
          status: "draft",
        }),
      });

      const data = (await response.json().catch(() => null)) as
        | CreatePostResponse
        | { error?: string }
        | null;

      if (!response.ok) {
        setError(data && "error" in data && data.error ? data.error : "Unable to save draft.");
        return;
      }

      setSavedDraftId(data && "id" in data ? data.id : null);
      setTitle("");
      setContent("");
      router.refresh();
    } catch {
      setError("Unable to save draft right now.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="rounded-[1.35rem] border border-border bg-surface p-5 shadow-[0_18px_42px_rgba(15,23,42,0.05)]">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-text-primary">Quick Draft</h2>
          <p className="mt-1 text-sm text-text-secondary">
            Capture an idea for {siteTitle} and keep it in the editorial queue.
          </p>
        </div>
        <div className="rounded-xl border border-border bg-surface-raised p-2 text-accent">
          <PencilEdit02Icon size={18} />
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-3">
        {error ? (
          <div className="rounded-xl border border-danger/15 bg-danger/5 px-3 py-2 text-sm text-danger">
            {error}
          </div>
        ) : null}

        {savedDraftId ? (
          <div className="rounded-xl border border-success/15 bg-success/5 px-3 py-2 text-sm text-success">
            Draft saved to the posts queue.
            <Link href="/posts?status=draft" className="ml-1 font-medium underline underline-offset-2">
              Review drafts
            </Link>
          </div>
        ) : null}

        <div className="space-y-1.5">
          <label htmlFor="dashboard-draft-title" className="text-xs font-semibold uppercase tracking-[0.16em] text-text-muted">
            Title
          </label>
          <input
            id="dashboard-draft-title"
            type="text"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="What are you publishing next?"
            className="w-full rounded-xl border border-border bg-surface-raised px-3 py-2.5 text-sm text-text-primary outline-none transition-colors placeholder:text-text-muted focus:border-accent focus-visible:ring-2 focus-visible:ring-accent"
          />
        </div>

        <div className="space-y-1.5">
          <label htmlFor="dashboard-draft-content" className="text-xs font-semibold uppercase tracking-[0.16em] text-text-muted">
            Notes
          </label>
          <textarea
            id="dashboard-draft-content"
            value={content}
            onChange={(event) => setContent(event.target.value)}
            rows={6}
            placeholder="Outline the idea, key points, or a first paragraph."
            className="w-full resize-y rounded-xl border border-border bg-surface-raised px-3 py-2.5 text-sm text-text-primary outline-none transition-colors placeholder:text-text-muted focus:border-accent focus-visible:ring-2 focus-visible:ring-accent"
          />
        </div>

        <div className="flex items-center justify-between gap-3 pt-1">
          <p className="text-xs text-text-muted">
            Saved through the live Presslyn posts API as a draft.
          </p>
          <button
            type="submit"
            disabled={saving}
            className="inline-flex items-center gap-2 rounded-xl bg-accent px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-60"
          >
            <SentIcon size={14} />
            {saving ? "Saving..." : "Save Draft"}
          </button>
        </div>
      </form>
    </section>
  );
}
