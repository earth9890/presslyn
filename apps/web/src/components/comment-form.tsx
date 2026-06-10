"use client";

import { useState } from "react";

export function CommentForm({ postId }: { postId: number }) {
  const [authorName, setAuthorName] = useState("");
  const [authorEmail, setAuthorEmail] = useState("");
  const [content, setContent] = useState("");
  const [website, setWebsite] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setSuccess("");

    try {
      const response = await fetch("/api/comments", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          postId,
          authorName,
          authorEmail,
          content,
          website,
        }),
      });

      const data = (await response.json().catch(() => null)) as
        | { error?: string; message?: string }
        | null;
      if (!response.ok) {
        throw new Error(data?.error ?? "Could not submit comment.");
      }

      setSuccess(data?.message ?? "Comment submitted.");
      setContent("");
      setWebsite("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not submit comment.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="mt-8 space-y-4 rounded-2xl border border-border bg-surface px-5 py-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="space-y-1 text-sm">
          <span className="font-medium text-foreground">Name</span>
          <input
            value={authorName}
            onChange={(event) => setAuthorName(event.target.value)}
            required
            maxLength={255}
            className="w-full rounded-md border border-border bg-background px-3 py-2 outline-none focus:border-accent"
          />
        </label>
        <label className="space-y-1 text-sm">
          <span className="font-medium text-foreground">Email</span>
          <input
            type="email"
            value={authorEmail}
            onChange={(event) => setAuthorEmail(event.target.value)}
            required
            maxLength={255}
            className="w-full rounded-md border border-border bg-background px-3 py-2 outline-none focus:border-accent"
          />
        </label>
      </div>

      <label className="hidden" aria-hidden="true">
        Website
        <input
          tabIndex={-1}
          autoComplete="off"
          value={website}
          onChange={(event) => setWebsite(event.target.value)}
        />
      </label>

      <label className="space-y-1 text-sm">
        <span className="font-medium text-foreground">Comment</span>
        <textarea
          value={content}
          onChange={(event) => setContent(event.target.value)}
          required
          rows={6}
          maxLength={65000}
          className="w-full rounded-md border border-border bg-background px-3 py-2 outline-none focus:border-accent"
        />
      </label>

      {error ? (
        <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      ) : null}
      {success ? (
        <p className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
          {success}
        </p>
      ) : null}

      <div className="flex items-center justify-between gap-4">
        <p className="text-sm text-muted">
          New comments are held for moderation before appearing publicly.
        </p>
        <button
          type="submit"
          disabled={busy}
          className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-background disabled:opacity-60"
        >
          {busy ? "Submitting..." : "Submit comment"}
        </button>
      </div>
    </form>
  );
}
