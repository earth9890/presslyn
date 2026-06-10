"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { UserCircleIcon } from "hugeicons-react";
import { apiFetch, ApiError } from "@/lib/api-client";
import { UserRowActions } from "@/components/users/user-row-actions";
import { USER_ROLES } from "@/components/users/user-form";

export interface UserRow {
  id: number;
  username: string;
  displayName: string;
  email: string;
  role: string;
  createdAt: string | null;
}

const ROLE_LABELS: Record<string, string> = {
  administrator: "Administrator",
  editor: "Editor",
  author: "Author",
  contributor: "Contributor",
  subscriber: "Subscriber",
};

const ROLE_STYLES: Record<string, string> = {
  administrator: "bg-danger/10 text-danger border-danger/20",
  editor: "bg-accent/10 text-accent border-accent/20",
  author: "bg-success/10 text-success border-success/20",
  contributor: "bg-warning/10 text-warning border-warning/20",
  subscriber: "bg-text-muted/10 text-text-secondary border-border",
};

/**
 * Client-side users table with row selection and a bulk role-change action
 * (wired to POST /api/v1/users/bulk-role). Rendered by the server Users page,
 * which still owns filtering, pagination, and chrome.
 */
export function UsersTable({ users }: { users: UserRow[] }) {
  const router = useRouter();
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [bulkRole, setBulkRole] = useState<string>("");
  const [applying, setApplying] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const allSelected = users.length > 0 && selected.size === users.length;
  const selectedIds = useMemo(() => [...selected], [selected]);

  function toggleAll() {
    setSelected(allSelected ? new Set() : new Set(users.map((u) => u.id)));
  }

  function toggleOne(id: number) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function applyBulkRole() {
    if (selectedIds.length === 0 || !bulkRole) return;
    setApplying(true);
    setError("");
    setNotice("");
    try {
      const result = await apiFetch<{ updated: number; skippedSelf: boolean }>(
        "/api/v1/users/bulk-role",
        { method: "POST", body: { userIds: selectedIds, role: bulkRole } }
      );
      const parts = [`Updated ${result.updated} user${result.updated === 1 ? "" : "s"}.`];
      if (result.skippedSelf) parts.push("Your own account was skipped.");
      setNotice(parts.join(" "));
      setSelected(new Set());
      setBulkRole("");
      router.refresh();
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : "Could not update roles."
      );
    } finally {
      setApplying(false);
    }
  }

  if (users.length === 0) {
    return (
      <div className="rounded-lg border border-border bg-surface overflow-hidden">
        <div className="py-16 text-center">
          <UserCircleIcon size={32} className="mx-auto mb-3 text-text-muted" />
          <p className="text-sm text-text-secondary">No users found.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Bulk action bar */}
      <div className="flex flex-wrap items-center gap-2">
        <select
          value={bulkRole}
          onChange={(e) => setBulkRole(e.target.value)}
          disabled={selected.size === 0 || applying}
          aria-label="Bulk change role"
          className="rounded-md border border-border bg-surface px-3 py-1.5 text-sm text-text-primary outline-none focus:border-accent disabled:opacity-50"
        >
          <option value="">Change role to…</option>
          {USER_ROLES.map((r) => (
            <option key={r.value} value={r.value}>
              {r.label}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={applyBulkRole}
          disabled={selected.size === 0 || !bulkRole || applying}
          className="rounded-md border border-border bg-surface px-3 py-1.5 text-sm font-medium text-text-secondary hover:bg-surface-raised disabled:opacity-50"
        >
          {applying ? "Applying…" : "Apply"}
        </button>
        {selected.size > 0 ? (
          <span className="text-xs text-text-muted">{selected.size} selected</span>
        ) : null}
        {notice ? <span className="text-xs text-success">{notice}</span> : null}
        {error ? <span className="text-xs text-danger">{error}</span> : null}
      </div>

      <div className="rounded-lg border border-border bg-surface overflow-hidden">
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
              <th className="px-4 py-3 font-medium text-text-primary">User</th>
              <th
                data-column="email"
                className="hidden px-4 py-3 font-medium text-text-primary sm:table-cell"
              >
                Email
              </th>
              <th
                data-column="role"
                className="hidden px-4 py-3 font-medium text-text-primary md:table-cell"
              >
                Role
              </th>
              <th
                data-column="joined"
                className="hidden px-4 py-3 font-medium text-text-primary lg:table-cell"
              >
                Joined
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {users.map((user) => {
              const initials = (user.displayName || user.username)
                .split(" ")
                .map((n) => n[0])
                .join("")
                .slice(0, 2)
                .toUpperCase();

              return (
                <tr key={user.id} className="group hover:bg-surface-raised transition-colors">
                  <td className="px-4 py-3">
                    <input
                      type="checkbox"
                      className="rounded border-border"
                      aria-label={`Select ${user.username}`}
                      checked={selected.has(user.id)}
                      onChange={() => toggleOne(user.id)}
                    />
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent/10 text-accent text-xs font-semibold">
                        {initials}
                      </div>
                      <div className="min-w-0">
                        <Link
                          href={`/users/${user.id}/edit`}
                          className="block truncate font-medium text-text-primary hover:text-accent transition-colors"
                        >
                          {user.displayName || user.username}
                        </Link>
                        <p className="truncate text-xs text-text-muted">@{user.username}</p>
                        <UserRowActions userId={user.id} username={user.username} />
                      </div>
                    </div>
                  </td>
                  <td
                    data-column="email"
                    className="hidden px-4 py-3 text-text-secondary sm:table-cell"
                  >
                    {user.email}
                  </td>
                  <td data-column="role" className="hidden px-4 py-3 md:table-cell">
                    <span
                      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium ${ROLE_STYLES[user.role] ?? "bg-surface-raised text-text-secondary border-border"}`}
                    >
                      {ROLE_LABELS[user.role] ?? user.role}
                    </span>
                  </td>
                  <td
                    data-column="joined"
                    className="hidden px-4 py-3 text-text-muted lg:table-cell"
                  >
                    {formatDate(user.createdAt)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
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
