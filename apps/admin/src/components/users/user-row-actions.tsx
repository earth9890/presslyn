"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { apiFetch, ApiError } from "@/lib/api-client";

interface UserRowActionsProps {
  userId: number;
  username: string;
}

export function UserRowActions({ userId, username }: UserRowActionsProps) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function handleDelete() {
    if (!confirm(`Delete user "${username}"? This cannot be undone.`)) return;
    setBusy(true);
    setError("");
    try {
      await apiFetch(`/api/v1/users/${userId}`, { method: "DELETE" });
      router.refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not delete user.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-1 flex items-center gap-2 text-xs opacity-0 transition-opacity group-hover:opacity-100">
      <Link href={`/users/${userId}/edit`} className="text-accent hover:underline">
        Edit
      </Link>
      <span className="text-text-muted">·</span>
      <button
        onClick={handleDelete}
        disabled={busy}
        className="text-danger hover:underline disabled:opacity-50"
      >
        {busy ? "Deleting…" : "Delete"}
      </button>
      {error ? <span className="text-danger">{error}</span> : null}
    </div>
  );
}
