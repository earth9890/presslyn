"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import {
  CheckmarkCircle01Icon,
  Cancel01Icon,
  Delete01Icon,
  Comment01Icon,
} from "hugeicons-react";
import { apiFetch, ApiError } from "@/lib/api-client";

export interface CommentRow {
  id: number;
  postId: number;
  authorName: string | null;
  authorEmail: string | null;
  content: string;
  approved: boolean;
  createdAt: string | null;
}

interface CommentsTableProps {
  comments: CommentRow[];
  counts: { approved: number; pending: number; total: number };
  filter: string;
  page: number;
  perPage: number;
  total: number;
}

type RowAction = "approve" | "unapprove" | "delete";

export function CommentsTable({
  comments,
  counts,
  filter,
  page,
  perPage,
  total,
}: CommentsTableProps) {
  const router = useRouter();
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [busyIds, setBusyIds] = useState<Set<number>>(new Set());
  const [bulkBusy, setBulkBusy] = useState(false);
  const [error, setError] = useState("");

  const offset = (page - 1) * perPage;

  const filterTabs = useMemo(
    () => [
      { key: "all", label: "All", count: counts.total },
      { key: "pending", label: "Pending", count: counts.pending },
      { key: "approved", label: "Approved", count: counts.approved },
    ],
    [counts]
  );

  function setBusy(id: number, busy: boolean) {
    setBusyIds((prev) => {
      const next = new Set(prev);
      if (busy) next.add(id);
      else next.delete(id);
      return next;
    });
  }

  async function runAction(id: number, action: RowAction) {
    if (action === "delete" && !confirm("Delete this comment permanently?")) {
      return;
    }
    setError("");
    setBusy(id, true);
    try {
      if (action === "delete") {
        await apiFetch(`/api/v1/comments/${id}`, { method: "DELETE" });
      } else {
        await apiFetch(`/api/v1/comments/${id}/${action}`, { method: "PUT" });
      }
      setSelected((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
      router.refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Action failed.");
    } finally {
      setBusy(id, false);
    }
  }

  async function runBulk(action: RowAction) {
    const ids = [...selected];
    if (ids.length === 0) return;
    if (
      action === "delete" &&
      !confirm(`Delete ${ids.length} comment(s) permanently?`)
    ) {
      return;
    }
    setError("");
    setBulkBusy(true);
    try {
      await Promise.all(
        ids.map((id) =>
          action === "delete"
            ? apiFetch(`/api/v1/comments/${id}`, { method: "DELETE" })
            : apiFetch(`/api/v1/comments/${id}/${action}`, { method: "PUT" })
        )
      );
      setSelected(new Set());
      router.refresh();
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : "Bulk action failed."
      );
    } finally {
      setBulkBusy(false);
    }
  }

  function toggle(id: number) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAll() {
    setSelected((prev) =>
      prev.size === comments.length
        ? new Set()
        : new Set(comments.map((c) => c.id))
    );
  }

  const allSelected =
    comments.length > 0 && selected.size === comments.length;

  return (
    <div className="space-y-4">
      {/* Filter tabs + bulk bar */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex w-fit items-center gap-0.5 rounded-lg border border-border bg-surface p-1">
          {filterTabs.map((tab) => (
            <Link
              key={tab.key}
              href={buildCommentsHref({ filter: tab.key, perPage })}
              className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                filter === tab.key
                  ? "bg-accent text-white"
                  : "text-text-secondary hover:text-text-primary hover:bg-surface-raised"
              }`}
            >
              {tab.label}
              {tab.count > 0 && (
                <span
                  className={`ml-1.5 rounded-full px-1.5 py-0.5 text-[10px] tabular-nums ${
                    filter === tab.key
                      ? "bg-white/20 text-white"
                      : "bg-surface-raised text-text-muted"
                  }`}
                >
                  {tab.count}
                </span>
              )}
            </Link>
          ))}
        </div>
        {selected.size > 0 ? (
          <div className="flex items-center gap-2">
            <span className="text-xs text-text-muted">
              {selected.size} selected
            </span>
            <button
              onClick={() => runBulk("approve")}
              disabled={bulkBusy}
              className="rounded-md border border-border bg-surface px-2.5 py-1.5 text-xs font-medium text-success hover:bg-surface-raised disabled:opacity-50"
            >
              Approve
            </button>
            <button
              onClick={() => runBulk("unapprove")}
              disabled={bulkBusy}
              className="rounded-md border border-border bg-surface px-2.5 py-1.5 text-xs font-medium text-text-secondary hover:bg-surface-raised disabled:opacity-50"
            >
              Unapprove
            </button>
            <button
              onClick={() => runBulk("delete")}
              disabled={bulkBusy}
              className="rounded-md border border-border bg-surface px-2.5 py-1.5 text-xs font-medium text-danger hover:bg-surface-raised disabled:opacity-50"
            >
              Delete
            </button>
          </div>
        ) : counts.pending > 0 ? (
          <span className="rounded-full border border-warning/20 bg-warning/10 px-2 py-1 text-[11px] font-medium text-warning">
            {counts.pending} pending moderation
          </span>
        ) : null}
      </div>

      {error ? (
        <div className="rounded-md border border-danger/20 bg-danger/5 px-3 py-2 text-sm text-danger">
          {error}
        </div>
      ) : null}

      {/* Table */}
      <div className="rounded-lg border border-border bg-surface overflow-hidden">
        {comments.length === 0 ? (
          <div className="py-16 text-center">
            <Comment01Icon size={32} className="mx-auto mb-3 text-text-muted" />
            <p className="text-sm text-text-secondary">No comments found.</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-surface-raised text-left">
                <th className="w-8 px-4 py-3">
                  <input
                    type="checkbox"
                    className="rounded border-border"
                    aria-label="Select all"
                    checked={allSelected}
                    onChange={toggleAll}
                  />
                </th>
                <th className="px-4 py-3 font-medium text-text-primary">Author</th>
                <th className="px-4 py-3 font-medium text-text-primary">Comment</th>
                <th
                  data-column="status"
                  className="hidden px-4 py-3 font-medium text-text-primary md:table-cell"
                >
                  Status
                </th>
                <th
                  data-column="submitted"
                  className="hidden px-4 py-3 font-medium text-text-primary lg:table-cell"
                >
                  Submitted
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {comments.map((comment) => {
                const busy = busyIds.has(comment.id);
                return (
                  <tr
                    key={comment.id}
                    className={`group transition-colors hover:bg-surface-raised ${
                      !comment.approved ? "bg-warning/5" : ""
                    } ${busy ? "opacity-50" : ""}`}
                  >
                    <td className="px-4 py-3">
                      <input
                        type="checkbox"
                        className="rounded border-border"
                        aria-label={`Select comment by ${comment.authorName}`}
                        checked={selected.has(comment.id)}
                        onChange={() => toggle(comment.id)}
                      />
                    </td>
                    <td className="px-4 py-3">
                      <div className="space-y-0.5">
                        <p className="font-medium text-text-primary">
                          {comment.authorName || "Anonymous"}
                        </p>
                        {comment.authorEmail && (
                          <p className="text-xs text-text-muted">
                            {comment.authorEmail}
                          </p>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="space-y-1">
                        <p className="line-clamp-2 text-text-secondary">
                          {comment.content}
                        </p>
                        <div className="flex items-center gap-2 opacity-0 transition-opacity group-hover:opacity-100">
                          {!comment.approved ? (
                            <button
                              onClick={() => runAction(comment.id, "approve")}
                              disabled={busy}
                              className="flex items-center gap-1 text-xs text-success hover:underline disabled:opacity-50"
                            >
                              <CheckmarkCircle01Icon size={12} />
                              Approve
                            </button>
                          ) : (
                            <button
                              onClick={() => runAction(comment.id, "unapprove")}
                              disabled={busy}
                              className="flex items-center gap-1 text-xs text-text-secondary hover:underline disabled:opacity-50"
                            >
                              <Cancel01Icon size={12} />
                              Unapprove
                            </button>
                          )}
                          <span className="text-text-muted">·</span>
                          <button
                            onClick={() => runAction(comment.id, "delete")}
                            disabled={busy}
                            className="flex items-center gap-1 text-xs text-danger hover:underline disabled:opacity-50"
                          >
                            <Delete01Icon size={12} />
                            Delete
                          </button>
                          <span className="text-text-muted">·</span>
                          <Link
                            href={`/posts/${comment.postId}/edit`}
                            className="text-xs text-accent hover:underline"
                          >
                            View post
                          </Link>
                        </div>
                      </div>
                    </td>
                    <td
                      data-column="status"
                      className="hidden px-4 py-3 md:table-cell"
                    >
                      {comment.approved ? (
                        <span className="inline-flex items-center gap-1 rounded-full border border-success/20 bg-success/10 px-2 py-0.5 text-[11px] font-medium text-success">
                          <CheckmarkCircle01Icon size={10} />
                          Approved
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded-full border border-warning/20 bg-warning/10 px-2 py-0.5 text-[11px] font-medium text-warning">
                          Pending
                        </span>
                      )}
                    </td>
                    <td
                      data-column="submitted"
                      className="hidden px-4 py-3 text-text-muted lg:table-cell"
                    >
                      {formatDate(comment.createdAt)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {total > perPage ? (
        <div className="flex items-center justify-between text-sm">
          <p className="text-text-muted">
            Showing {offset + 1}–{Math.min(offset + comments.length, total)} of{" "}
            {total}
          </p>
          <div className="flex items-center gap-2">
            {page > 1 ? (
              <Link
                href={buildCommentsHref({ filter, perPage, page: page - 1 })}
                className="rounded-md border border-border bg-surface px-3 py-1.5 text-text-secondary hover:bg-surface-raised"
              >
                Previous
              </Link>
            ) : null}
            {offset + perPage < total ? (
              <Link
                href={buildCommentsHref({ filter, perPage, page: page + 1 })}
                className="rounded-md border border-border bg-surface px-3 py-1.5 text-text-secondary hover:bg-surface-raised"
              >
                Next
              </Link>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function formatDate(date: string | null) {
  if (!date) return "—";
  return new Date(date).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function buildCommentsHref(
  params: Record<string, string | number | undefined>
) {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === "" || value === "all") continue;
    query.set(key, String(value));
  }
  const search = query.toString();
  return search ? `/comments?${search}` : "/comments";
}
