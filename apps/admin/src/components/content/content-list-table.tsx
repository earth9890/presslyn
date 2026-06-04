"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Cancel01Icon,
  PencilEdit02Icon,
  Search01Icon,
  Tick01Icon,
} from "hugeicons-react";
import { useState, useTransition } from "react";
import { cn } from "@/lib/utils";
import type {
  ContentListArchiveOption,
  ContentListCategoryOption,
  ContentListRow,
} from "@/lib/content-list";

interface ContentListTableProps {
  basePath: "/posts" | "/pages";
  itemLabel: string;
  rows: ContentListRow[];
  status: string;
  search: string;
  page: number;
  perPage: number;
  total: number;
  offset: number;
  categoryId?: number;
  archive?: string;
  counts: {
    all: number;
    publish: number;
    draft: number;
    pending: number;
    private: number;
    trash: number;
  };
  categoryOptions: ContentListCategoryOption[];
  archiveOptions: ContentListArchiveOption[];
}

type BulkAction = "edit" | "trash" | "restore" | "delete";

export function ContentListTable({
  basePath,
  itemLabel,
  rows,
  status,
  search,
  page,
  perPage,
  total,
  offset,
  categoryId,
  archive,
  counts,
  categoryOptions,
  archiveOptions,
}: ContentListTableProps) {
  const router = useRouter();
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [bulkAction, setBulkAction] = useState<BulkAction>(
    status === "trash" ? "restore" : "edit"
  );
  const [bulkStatus, setBulkStatus] = useState("draft");
  const [editingRowId, setEditingRowId] = useState<number | null>(null);
  const [editingTitle, setEditingTitle] = useState("");
  const [editingSlug, setEditingSlug] = useState("");
  const [editingStatus, setEditingStatus] = useState("draft");
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [isPending, startTransition] = useTransition();

  const allSelected =
    rows.length > 0 && selectedIds.length === rows.length;

  const statusTabs = [
    { key: "all", label: "All", count: counts.all },
    { key: "publish", label: "Published", count: counts.publish },
    { key: "draft", label: "Draft", count: counts.draft },
    { key: "pending", label: "Pending", count: counts.pending },
    { key: "private", label: "Private", count: counts.private },
    { key: "trash", label: "Trash", count: counts.trash },
  ];

  function buildHref(
    updates: Record<string, string | number | undefined | null>
  ) {
    const params = new URLSearchParams();
    const next = {
      status,
      search,
      page,
      perPage,
      categoryId,
      archive,
      ...updates,
    };

    for (const [key, value] of Object.entries(next)) {
      if (value === undefined || value === null || value === "" || value === "all") {
        continue;
      }
      params.set(key, String(value));
    }

    const query = params.toString();
    return query ? `${basePath}?${query}` : basePath;
  }

  function toggleSelection(id: number) {
    setSelectedIds((current) =>
      current.includes(id)
        ? current.filter((value) => value !== id)
        : [...current, id]
    );
  }

  function toggleSelectAll() {
    setSelectedIds(allSelected ? [] : rows.map((row) => row.id));
  }

  function startQuickEdit(row: ContentListRow) {
    setEditingRowId(row.id);
    setEditingTitle(row.title);
    setEditingSlug(row.slug);
    setEditingStatus(row.status);
    setError("");
    setNotice("");
  }

  async function request(path: string, init: RequestInit) {
    const token = document.cookie
      .split("; ")
      .find((cookie) => cookie.startsWith("presslyn_session="))
      ?.split("=")[1];

    const response = await fetch(path, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        Authorization: token ? `Bearer ${token}` : "",
        ...(init.headers ?? {}),
      },
    });

    const data = (await response.json().catch(() => null)) as
      | { error?: string }
      | null;

    if (!response.ok) {
      throw new Error(data?.error ?? "Request failed.");
    }
  }

  function refreshWithMessage(nextNotice: string) {
    setNotice(nextNotice);
    setError("");
    setSelectedIds([]);
    startTransition(() => {
      router.refresh();
    });
  }

  async function applyBulkAction() {
    if (selectedIds.length === 0) {
      setError(`Select at least one ${itemLabel.toLowerCase()} first.`);
      return;
    }

    setError("");
    setNotice("");

    try {
      if (bulkAction === "edit") {
        await Promise.all(
          selectedIds.map((id) =>
            request(`/api/v1${basePath}/${id}`, {
              method: "PUT",
              body: JSON.stringify({ status: bulkStatus }),
            })
          )
        );
        refreshWithMessage(
          `${selectedIds.length} ${itemLabel.toLowerCase()} updated.`
        );
        return;
      }

      if (bulkAction === "trash") {
        await Promise.all(
          selectedIds.map((id) =>
            request(`/api/v1${basePath}/${id}`, {
              method: "DELETE",
            })
          )
        );
        refreshWithMessage(
          `${selectedIds.length} ${itemLabel.toLowerCase()} moved to trash.`
        );
        return;
      }

      if (bulkAction === "restore") {
        await Promise.all(
          selectedIds.map((id) =>
            request(`/api/v1${basePath}/${id}/restore`, {
              method: "PUT",
              body: JSON.stringify({}),
            })
          )
        );
        refreshWithMessage(
          `${selectedIds.length} ${itemLabel.toLowerCase()} restored.`
        );
        return;
      }

      await Promise.all(
        selectedIds.map((id) =>
          request(`/api/v1${basePath}/${id}/permanent`, {
            method: "DELETE",
          })
        )
      );
      refreshWithMessage(
        `${selectedIds.length} ${itemLabel.toLowerCase()} deleted permanently.`
      );
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Bulk action failed."
      );
    }
  }

  async function saveQuickEdit() {
    if (editingRowId === null) {
      return;
    }

    setError("");
    setNotice("");

    try {
      await request(`/api/v1${basePath}/${editingRowId}`, {
        method: "PUT",
        body: JSON.stringify({
          title: editingTitle,
          slug: editingSlug,
          status: editingStatus,
        }),
      });
      setEditingRowId(null);
      refreshWithMessage(`${itemLabel} updated.`);
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Quick edit failed."
      );
    }
  }

  async function runRowAction(rowId: number, action: "trash" | "restore" | "delete") {
    setError("");
    setNotice("");

    try {
      if (action === "trash") {
        await request(`/api/v1${basePath}/${rowId}`, { method: "DELETE" });
        refreshWithMessage(`${itemLabel} moved to trash.`);
        return;
      }

      if (action === "restore") {
        await request(`/api/v1${basePath}/${rowId}/restore`, {
          method: "PUT",
          body: JSON.stringify({}),
        });
        refreshWithMessage(`${itemLabel} restored.`);
        return;
      }

      await request(`/api/v1${basePath}/${rowId}/permanent`, {
        method: "DELETE",
      });
      refreshWithMessage(`${itemLabel} deleted permanently.`);
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Action failed."
      );
    }
  }

  return (
    <div className="mx-auto max-w-[88rem] space-y-4">
      <div className="flex flex-wrap items-center gap-2 rounded-[1.2rem] border border-border bg-surface px-1.5 py-1.5 shadow-[0_12px_32px_rgba(15,23,42,0.05)]">
        {statusTabs.map((tab) => (
          <Link
            key={tab.key}
            href={buildHref({ status: tab.key, page: 1 })}
            className={cn(
              "rounded-xl px-3 py-2 text-xs font-semibold transition-colors",
              status === tab.key
                ? "bg-accent text-white shadow-[0_10px_24px_var(--presslyn-accent-glow)]"
                : "text-text-secondary hover:bg-surface-raised hover:text-text-primary"
            )}
          >
            {tab.label}
            {tab.count > 0 ? (
              <span
                className={cn(
                  "ml-1.5 rounded-full px-1.5 py-0.5 text-[10px] tabular-nums",
                  status === tab.key
                    ? "bg-white/20 text-white"
                    : "bg-surface-raised text-text-muted"
                )}
              >
                {tab.count}
              </span>
            ) : null}
          </Link>
        ))}
      </div>

      <div className="rounded-[1.35rem] border border-border bg-surface p-4 shadow-[0_18px_42px_rgba(15,23,42,0.05)]">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-end xl:justify-between">
          <div className="flex flex-1 flex-col gap-3 lg:flex-row lg:items-end">
            <div className="flex flex-wrap items-center gap-2">
              <select
                value={bulkAction}
                onChange={(event) => setBulkAction(event.target.value as BulkAction)}
                className="rounded-xl border border-border bg-surface-raised px-3 py-2 text-sm text-text-primary outline-none focus:border-accent"
              >
                {status === "trash" ? (
                  <>
                    <option value="restore">Restore</option>
                    <option value="delete">Delete permanently</option>
                  </>
                ) : (
                  <>
                    <option value="edit">Bulk edit status</option>
                    <option value="trash">Move to trash</option>
                  </>
                )}
              </select>

              {bulkAction === "edit" ? (
                <select
                  value={bulkStatus}
                  onChange={(event) => setBulkStatus(event.target.value)}
                  className="rounded-xl border border-border bg-surface-raised px-3 py-2 text-sm text-text-primary outline-none focus:border-accent"
                >
                  <option value="draft">Draft</option>
                  <option value="publish">Published</option>
                  <option value="pending">Pending</option>
                  <option value="private">Private</option>
                </select>
              ) : null}

              <button
                type="button"
                onClick={applyBulkAction}
                disabled={isPending}
                className="rounded-xl border border-border bg-surface-raised px-3 py-2 text-sm font-medium text-text-primary transition-colors hover:border-accent/25 hover:text-accent disabled:cursor-not-allowed disabled:opacity-60"
              >
                Apply
              </button>
            </div>

            <form method="GET" action={basePath} className="flex flex-1 flex-col gap-3 lg:flex-row lg:items-end">
              <input type="hidden" name="status" value={status} />
              <input type="hidden" name="perPage" value={perPage} />
              <div className="relative min-w-[14rem] flex-1">
                <Search01Icon
                  size={14}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted"
                />
                <input
                  name="search"
                  defaultValue={search}
                  placeholder={`Search ${itemLabel.toLowerCase()}s...`}
                  className="w-full rounded-xl border border-border bg-surface-raised px-4 py-2.5 pl-9 text-sm text-text-primary outline-none placeholder:text-text-muted focus:border-accent focus-visible:ring-2 focus-visible:ring-accent"
                />
              </div>

              {categoryOptions.length > 0 ? (
                <select
                  name="categoryId"
                  defaultValue={categoryId ? String(categoryId) : ""}
                  className="rounded-xl border border-border bg-surface-raised px-3 py-2.5 text-sm text-text-primary outline-none focus:border-accent"
                >
                  <option value="">All categories</option>
                  {categoryOptions.map((option) => (
                    <option key={option.id} value={option.id}>
                      {option.name} ({option.count})
                    </option>
                  ))}
                </select>
              ) : null}

              <select
                name="archive"
                defaultValue={archive ?? ""}
                className="rounded-xl border border-border bg-surface-raised px-3 py-2.5 text-sm text-text-primary outline-none focus:border-accent"
              >
                <option value="">All dates</option>
                {archiveOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label} ({option.count})
                  </option>
                ))}
              </select>

              <button
                type="submit"
                className="rounded-xl bg-accent px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-accent-hover"
              >
                Filter
              </button>
            </form>
          </div>

          <div className="text-xs text-text-muted">
            {selectedIds.length > 0
              ? `${selectedIds.length} selected`
              : `${total} total ${itemLabel.toLowerCase()}${total === 1 ? "" : "s"}`}
          </div>
        </div>

        {error ? (
          <div className="mt-4 rounded-xl border border-danger/15 bg-danger/5 px-3 py-2 text-sm text-danger">
            {error}
          </div>
        ) : null}
        {notice ? (
          <div className="mt-4 rounded-xl border border-success/15 bg-success/5 px-3 py-2 text-sm text-success">
            {notice}
          </div>
        ) : null}
      </div>

      <div className="overflow-hidden rounded-[1.35rem] border border-border bg-surface shadow-[0_18px_42px_rgba(15,23,42,0.05)]">
        {rows.length === 0 ? (
          <div className="py-20 text-center text-sm text-text-secondary">
            No {itemLabel.toLowerCase()}s found for the current filter set.
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-surface-raised/90 text-left">
                <th className="w-8 px-4 py-3">
                  <input
                    type="checkbox"
                    checked={allSelected}
                    onChange={toggleSelectAll}
                    className="rounded border-border"
                    aria-label="Select all"
                  />
                </th>
                <th className="px-4 py-3 font-medium text-text-primary">Title</th>
                <th
                  data-column="author"
                  className="hidden px-4 py-3 font-medium text-text-primary lg:table-cell"
                >
                  Author
                </th>
                <th
                  data-column="categories"
                  className="hidden px-4 py-3 font-medium text-text-primary xl:table-cell"
                >
                  Categories
                </th>
                <th
                  data-column="tags"
                  className="hidden px-4 py-3 font-medium text-text-primary 2xl:table-cell"
                >
                  Tags
                </th>
                <th
                  data-column="comments"
                  className="hidden px-4 py-3 font-medium text-text-primary lg:table-cell"
                >
                  Comments
                </th>
                <th
                  data-column="date"
                  className="hidden px-4 py-3 font-medium text-text-primary md:table-cell"
                >
                  Date
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {rows.map((row) => {
                const isTrash = row.status === "trash";
                const isEditing = editingRowId === row.id;

                return (
                  <FragmentRow
                    key={row.id}
                    row={row}
                    itemLabel={itemLabel}
                    basePath={basePath}
                    checked={selectedIds.includes(row.id)}
                    onToggleSelection={() => toggleSelection(row.id)}
                    onQuickEdit={() => startQuickEdit(row)}
                    onTrash={() => runRowAction(row.id, "trash")}
                    onRestore={() => runRowAction(row.id, "restore")}
                    onDelete={() => runRowAction(row.id, "delete")}
                    isEditing={isEditing}
                    isTrash={isTrash}
                    editingTitle={editingTitle}
                    editingSlug={editingSlug}
                    editingStatus={editingStatus}
                    onEditingTitleChange={setEditingTitle}
                    onEditingSlugChange={setEditingSlug}
                    onEditingStatusChange={setEditingStatus}
                    onCancelEdit={() => setEditingRowId(null)}
                    onSaveQuickEdit={saveQuickEdit}
                  />
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {total > perPage ? (
        <div className="flex items-center justify-between text-sm">
          <p className="text-text-muted">
            Showing {offset + 1}–{Math.min(offset + rows.length, total)} of {total}
          </p>
          <div className="flex items-center gap-2">
            {page > 1 ? (
              <Link
                href={buildHref({ page: page - 1 })}
                className="rounded-xl border border-border bg-surface px-3 py-1.5 text-text-secondary hover:bg-surface-raised"
              >
                Previous
              </Link>
            ) : null}
            {offset + perPage < total ? (
              <Link
                href={buildHref({ page: page + 1 })}
                className="rounded-xl border border-border bg-surface px-3 py-1.5 text-text-secondary hover:bg-surface-raised"
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

function FragmentRow({
  row,
  itemLabel,
  basePath,
  checked,
  onToggleSelection,
  onQuickEdit,
  onTrash,
  onRestore,
  onDelete,
  isEditing,
  isTrash,
  editingTitle,
  editingSlug,
  editingStatus,
  onEditingTitleChange,
  onEditingSlugChange,
  onEditingStatusChange,
  onCancelEdit,
  onSaveQuickEdit,
}: {
  row: ContentListRow;
  itemLabel: string;
  basePath: "/posts" | "/pages";
  checked: boolean;
  onToggleSelection: () => void;
  onQuickEdit: () => void;
  onTrash: () => void;
  onRestore: () => void;
  onDelete: () => void;
  isEditing: boolean;
  isTrash: boolean;
  editingTitle: string;
  editingSlug: string;
  editingStatus: string;
  onEditingTitleChange: (value: string) => void;
  onEditingSlugChange: (value: string) => void;
  onEditingStatusChange: (value: string) => void;
  onCancelEdit: () => void;
  onSaveQuickEdit: () => Promise<void>;
}) {
  const viewHref = basePath === "/pages" ? `/${row.slug}` : `/preview/posts/${row.id}`;

  return (
    <>
      <tr className="group transition-colors hover:bg-accent-soft/35">
        <td className="px-4 py-3 align-top">
          <input
            type="checkbox"
            checked={checked}
            onChange={onToggleSelection}
            className="rounded border-border"
            aria-label={`Select ${row.title || itemLabel}`}
          />
        </td>
        <td className="px-4 py-3">
          <div className="flex flex-col gap-0.5">
            <Link
              href={`${basePath}/${row.id}/edit`}
              className="font-semibold text-text-primary transition-colors hover:text-accent"
            >
              {row.title || (
                <span className="italic text-text-muted">(no title)</span>
              )}
            </Link>
            <div className="text-xs text-text-muted">/{row.slug}</div>
            <div className="flex flex-wrap items-center gap-2 opacity-0 transition-opacity group-hover:opacity-100">
              <Link
                href={`${basePath}/${row.id}/edit`}
                className="text-xs text-accent hover:underline"
              >
                Edit
              </Link>
              {!isTrash ? (
                <button
                  type="button"
                  onClick={onQuickEdit}
                  className="text-xs text-text-secondary hover:text-accent hover:underline"
                >
                  Quick Edit
                </button>
              ) : null}
              {!isTrash ? (
                <button
                  type="button"
                  onClick={onTrash}
                  className="text-xs text-danger hover:underline"
                >
                  Trash
                </button>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={onRestore}
                    className="text-xs text-success hover:underline"
                  >
                    Restore
                  </button>
                  <button
                    type="button"
                    onClick={onDelete}
                    className="text-xs text-danger hover:underline"
                  >
                    Delete permanently
                  </button>
                </>
              )}
              <Link
                href={viewHref}
                className="text-xs text-text-secondary hover:underline"
              >
                View
              </Link>
            </div>
          </div>
        </td>
        <td
          data-column="author"
          className="hidden px-4 py-3 text-text-secondary lg:table-cell"
        >
          {row.authorName}
        </td>
        <td
          data-column="categories"
          className="hidden px-4 py-3 text-text-secondary xl:table-cell"
        >
          {row.categories.length > 0 ? row.categories.join(", ") : "—"}
        </td>
        <td
          data-column="tags"
          className="hidden px-4 py-3 text-text-secondary 2xl:table-cell"
        >
          {row.tags.length > 0 ? row.tags.join(", ") : "—"}
        </td>
        <td
          data-column="comments"
          className="hidden px-4 py-3 text-text-secondary lg:table-cell"
        >
          {row.commentsCount}
        </td>
        <td
          data-column="date"
          className="hidden px-4 py-3 text-text-secondary md:table-cell"
        >
          <div className="space-y-1">
            <StatusBadge status={row.status} />
            <div className="text-xs text-text-muted">{row.dateLabel}</div>
          </div>
        </td>
      </tr>
      {isEditing ? (
        <tr className="bg-surface-raised/70">
          <td colSpan={7} className="px-4 py-4">
            <div className="rounded-[1.1rem] border border-border bg-surface p-4">
              <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-text-primary">
                <PencilEdit02Icon size={16} />
                Quick Edit {itemLabel}
              </div>
              <div className="grid gap-3 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_12rem_auto]">
                <input
                  value={editingTitle}
                  onChange={(event) => onEditingTitleChange(event.target.value)}
                  className="rounded-xl border border-border bg-surface-raised px-3 py-2.5 text-sm text-text-primary outline-none focus:border-accent"
                  placeholder="Title"
                />
                <input
                  value={editingSlug}
                  onChange={(event) => onEditingSlugChange(event.target.value)}
                  className="rounded-xl border border-border bg-surface-raised px-3 py-2.5 text-sm text-text-primary outline-none focus:border-accent"
                  placeholder="Slug"
                />
                <select
                  value={editingStatus}
                  onChange={(event) => onEditingStatusChange(event.target.value)}
                  className="rounded-xl border border-border bg-surface-raised px-3 py-2.5 text-sm text-text-primary outline-none focus:border-accent"
                >
                  <option value="draft">Draft</option>
                  <option value="publish">Published</option>
                  <option value="pending">Pending</option>
                  <option value="private">Private</option>
                </select>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => void onSaveQuickEdit()}
                    className="inline-flex items-center gap-2 rounded-xl bg-accent px-3 py-2 text-sm font-medium text-white hover:bg-accent-hover"
                  >
                    <Tick01Icon size={14} />
                    Save
                  </button>
                  <button
                    type="button"
                    onClick={onCancelEdit}
                    className="inline-flex items-center gap-2 rounded-xl border border-border bg-surface-raised px-3 py-2 text-sm font-medium text-text-secondary hover:text-text-primary"
                  >
                    <Cancel01Icon size={14} />
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          </td>
        </tr>
      ) : null}
    </>
  );
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    publish: "border-success/20 bg-success/10 text-success",
    draft: "border-border bg-surface-raised text-text-secondary",
    pending: "border-warning/20 bg-warning/10 text-warning",
    private: "border-accent/20 bg-accent-soft text-accent",
    trash: "border-danger/20 bg-danger/10 text-danger",
  };

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium",
        styles[status] ?? "border-border bg-surface-raised text-text-secondary"
      )}
    >
      {status === "publish"
        ? "Published"
        : status === "pending"
          ? "Pending"
          : status === "private"
            ? "Private"
            : status === "trash"
              ? "Trash"
              : "Draft"}
    </span>
  );
}
