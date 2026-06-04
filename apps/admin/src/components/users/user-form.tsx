"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { apiFetch, ApiError } from "@/lib/api-client";

export const USER_ROLES = [
  { value: "subscriber", label: "Subscriber" },
  { value: "contributor", label: "Contributor" },
  { value: "author", label: "Author" },
  { value: "editor", label: "Editor" },
  { value: "administrator", label: "Administrator" },
] as const;

export interface EditableUser {
  id: number;
  username: string;
  email: string;
  displayName: string;
  role: string;
}

interface UserFormProps {
  mode: "create" | "edit";
  user?: EditableUser;
}

export function UserForm({ mode, user }: UserFormProps) {
  const router = useRouter();
  const [username, setUsername] = useState(user?.username ?? "");
  const [email, setEmail] = useState(user?.email ?? "");
  const [displayName, setDisplayName] = useState(user?.displayName ?? "");
  const [role, setRole] = useState(user?.role ?? "subscriber");
  const [password, setPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setSuccess("");

    if (!email.trim() || !displayName.trim()) {
      setError("Email and display name are required.");
      return;
    }
    if (mode === "create" && (!username.trim() || password.length < 8)) {
      setError("Username and an 8+ character password are required.");
      return;
    }
    if (mode === "edit" && password.length > 0 && password.length < 8) {
      setError("New password must be at least 8 characters.");
      return;
    }

    setSaving(true);
    try {
      if (mode === "create") {
        await apiFetch("/api/v1/users", {
          method: "POST",
          body: {
            username: username.trim(),
            email: email.trim(),
            displayName: displayName.trim(),
            password,
            role,
          },
        });
        router.push("/users");
        router.refresh();
        return;
      }

      // edit
      await apiFetch(`/api/v1/users/${user!.id}`, {
        method: "PUT",
        body: {
          email: email.trim(),
          displayName: displayName.trim(),
          role,
        },
      });
      if (password.length >= 8) {
        await apiFetch(`/api/v1/users/${user!.id}/password`, {
          method: "PUT",
          body: { password },
        });
        setPassword("");
      }
      setSuccess("User updated.");
      router.refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not save user.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="max-w-2xl space-y-5 rounded-lg border border-border bg-surface p-6"
    >
      {error ? (
        <div className="rounded-md border border-danger/20 bg-danger/5 px-3 py-2 text-sm text-danger">
          {error}
        </div>
      ) : null}
      {success ? (
        <div className="rounded-md border border-success/20 bg-success/5 px-3 py-2 text-sm text-success">
          {success}
        </div>
      ) : null}

      <Field label="Username" htmlFor="u-username">
        <input
          id="u-username"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          disabled={mode === "edit"}
          placeholder="alphanumeric, dashes, underscores"
          className="w-full rounded-md border border-border bg-surface-raised px-3 py-2 text-sm text-text-primary outline-none focus:border-accent disabled:opacity-60 placeholder:text-text-muted"
        />
        {mode === "edit" ? (
          <p className="text-xs text-text-muted">Usernames cannot be changed.</p>
        ) : null}
      </Field>

      <Field label="Email" htmlFor="u-email">
        <input
          id="u-email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full rounded-md border border-border bg-surface-raised px-3 py-2 text-sm text-text-primary outline-none focus:border-accent"
        />
      </Field>

      <Field label="Display name" htmlFor="u-display">
        <input
          id="u-display"
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          className="w-full rounded-md border border-border bg-surface-raised px-3 py-2 text-sm text-text-primary outline-none focus:border-accent"
        />
      </Field>

      <Field label="Role" htmlFor="u-role">
        <select
          id="u-role"
          value={role}
          onChange={(e) => setRole(e.target.value)}
          className="w-full rounded-md border border-border bg-surface-raised px-3 py-2 text-sm text-text-primary outline-none focus:border-accent"
        >
          {USER_ROLES.map((r) => (
            <option key={r.value} value={r.value}>
              {r.label}
            </option>
          ))}
        </select>
      </Field>

      <Field
        label={mode === "create" ? "Password" : "Set new password"}
        htmlFor="u-password"
      >
        <input
          id="u-password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder={
            mode === "create"
              ? "at least 8 characters"
              : "leave blank to keep current password"
          }
          className="w-full rounded-md border border-border bg-surface-raised px-3 py-2 text-sm text-text-primary outline-none focus:border-accent placeholder:text-text-muted"
        />
      </Field>

      <div className="flex items-center gap-3 pt-1">
        <button
          type="submit"
          disabled={saving}
          className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent-hover disabled:opacity-60"
        >
          {saving
            ? "Saving..."
            : mode === "create"
              ? "Add User"
              : "Update User"}
        </button>
        <button
          type="button"
          onClick={() => router.push("/users")}
          className="rounded-md border border-border bg-surface px-4 py-2 text-sm font-medium text-text-secondary hover:bg-surface-raised"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}

function Field({
  label,
  htmlFor,
  children,
}: {
  label: string;
  htmlFor: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={htmlFor} className="text-sm font-medium text-text-secondary">
        {label}
      </label>
      {children}
    </div>
  );
}
