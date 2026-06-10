"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { apiFetch, ApiError } from "@/lib/api-client";

interface CurrentUser {
  id: number;
  username: string;
  email: string;
  displayName: string;
  role: string;
}

const ROLE_LABELS: Record<string, string> = {
  administrator: "Administrator",
  editor: "Editor",
  author: "Author",
  contributor: "Contributor",
  subscriber: "Subscriber",
};

/**
 * Dedicated own-profile screen (WordPress wp-admin/profile.php equivalent).
 * Loads the current user via /auth/me and edits email + display name through
 * the self-service /users/me route. Password changes require the current
 * password and go through /users/me/password.
 */
export function ProfileForm() {
  const router = useRouter();
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  const [email, setEmail] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileError, setProfileError] = useState("");
  const [profileSuccess, setProfileSuccess] = useState("");

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [pwSaving, setPwSaving] = useState(false);
  const [pwError, setPwError] = useState("");
  const [pwSuccess, setPwSuccess] = useState("");

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const me = await apiFetch<CurrentUser>("/api/v1/auth/me");
        if (!active) return;
        setUser(me);
        setEmail(me.email);
        setDisplayName(me.displayName);
      } catch (err) {
        if (!active) return;
        setLoadError(
          err instanceof ApiError ? err.message : "Could not load your profile."
        );
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  async function handleProfileSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setProfileError("");
    setProfileSuccess("");
    if (!email.trim() || !displayName.trim()) {
      setProfileError("Email and display name are required.");
      return;
    }
    setProfileSaving(true);
    try {
      await apiFetch("/api/v1/users/me", {
        method: "PUT",
        body: { email: email.trim(), displayName: displayName.trim() },
      });
      setProfileSuccess("Profile updated.");
      router.refresh();
    } catch (err) {
      setProfileError(
        err instanceof ApiError ? err.message : "Could not save your profile."
      );
    } finally {
      setProfileSaving(false);
    }
  }

  async function handlePasswordSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPwError("");
    setPwSuccess("");
    if (newPassword.length < 8) {
      setPwError("New password must be at least 8 characters.");
      return;
    }
    setPwSaving(true);
    try {
      await apiFetch("/api/v1/users/me/password", {
        method: "POST",
        body: { currentPassword, newPassword },
      });
      setPwSuccess("Password updated.");
      setCurrentPassword("");
      setNewPassword("");
    } catch (err) {
      setPwError(
        err instanceof ApiError ? err.message : "Could not change your password."
      );
    } finally {
      setPwSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="rounded-lg border border-border bg-surface p-6 text-sm text-text-muted">
        Loading your profile…
      </div>
    );
  }

  if (loadError || !user) {
    return (
      <div className="rounded-md border border-danger/20 bg-danger/5 px-3 py-2 text-sm text-danger">
        {loadError || "Profile unavailable."}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <form
        onSubmit={handleProfileSubmit}
        className="max-w-2xl space-y-5 rounded-lg border border-border bg-surface p-6"
      >
        <h2 className="text-base font-semibold text-text-primary">Your profile</h2>
        {profileError ? (
          <div className="rounded-md border border-danger/20 bg-danger/5 px-3 py-2 text-sm text-danger">
            {profileError}
          </div>
        ) : null}
        {profileSuccess ? (
          <div className="rounded-md border border-success/20 bg-success/5 px-3 py-2 text-sm text-success">
            {profileSuccess}
          </div>
        ) : null}

        <Field label="Username" htmlFor="p-username">
          <input
            id="p-username"
            value={user.username}
            disabled
            className="w-full rounded-md border border-border bg-surface-raised px-3 py-2 text-sm text-text-primary opacity-60 outline-none"
          />
          <p className="text-xs text-text-muted">Usernames cannot be changed.</p>
        </Field>

        <Field label="Role" htmlFor="p-role">
          <input
            id="p-role"
            value={ROLE_LABELS[user.role] ?? user.role}
            disabled
            className="w-full rounded-md border border-border bg-surface-raised px-3 py-2 text-sm text-text-primary opacity-60 outline-none"
          />
        </Field>

        <Field label="Email" htmlFor="p-email">
          <input
            id="p-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-md border border-border bg-surface-raised px-3 py-2 text-sm text-text-primary outline-none focus:border-accent"
          />
        </Field>

        <Field label="Display name" htmlFor="p-display">
          <input
            id="p-display"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            className="w-full rounded-md border border-border bg-surface-raised px-3 py-2 text-sm text-text-primary outline-none focus:border-accent"
          />
        </Field>

        <button
          type="submit"
          disabled={profileSaving}
          className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent-hover disabled:opacity-60"
        >
          {profileSaving ? "Saving…" : "Update Profile"}
        </button>
      </form>

      <form
        onSubmit={handlePasswordSubmit}
        className="max-w-2xl space-y-5 rounded-lg border border-border bg-surface p-6"
      >
        <h2 className="text-base font-semibold text-text-primary">Change password</h2>
        {pwError ? (
          <div className="rounded-md border border-danger/20 bg-danger/5 px-3 py-2 text-sm text-danger">
            {pwError}
          </div>
        ) : null}
        {pwSuccess ? (
          <div className="rounded-md border border-success/20 bg-success/5 px-3 py-2 text-sm text-success">
            {pwSuccess}
          </div>
        ) : null}

        <Field label="Current password" htmlFor="p-current">
          <input
            id="p-current"
            type="password"
            autoComplete="current-password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            className="w-full rounded-md border border-border bg-surface-raised px-3 py-2 text-sm text-text-primary outline-none focus:border-accent"
          />
        </Field>

        <Field label="New password" htmlFor="p-new">
          <input
            id="p-new"
            type="password"
            autoComplete="new-password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            placeholder="at least 8 characters"
            className="w-full rounded-md border border-border bg-surface-raised px-3 py-2 text-sm text-text-primary outline-none focus:border-accent placeholder:text-text-muted"
          />
        </Field>

        <button
          type="submit"
          disabled={pwSaving}
          className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent-hover disabled:opacity-60"
        >
          {pwSaving ? "Updating…" : "Change Password"}
        </button>
      </form>
    </div>
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
