"use client";

import { Suspense, useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import { SquareLock02Icon } from "hugeicons-react";

function ResetPasswordInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token") ?? "";

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  // Redirect to login shortly after a successful reset; cleaned up on unmount.
  useEffect(() => {
    if (!done) return;
    const id = window.setTimeout(() => router.push("/login"), 1800);
    return () => window.clearTimeout(id);
  }, [done, router]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirm) {
      setError("Passwords do not match.");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/v1/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        setError(
          data?.error ?? "This reset link is invalid or has expired."
        );
        return;
      }
      setDone(true);
    } catch {
      setError("Unable to connect to the server. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-surface-raised px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center">
          <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-accent">
            <SquareLock02Icon size={24} className="text-white" />
          </div>
          <h1 className="text-xl font-bold text-text-primary">Choose a new password</h1>
        </div>

        <div className="rounded-lg border border-border bg-surface p-6 shadow-sm">
          {!token ? (
            <div className="space-y-4 text-center">
              <div className="rounded-md border border-danger/20 bg-danger/5 px-3 py-3 text-sm text-danger">
                Missing reset token. Please use the link from your email.
              </div>
              <Link
                href="/forgot-password"
                className="inline-block text-sm font-medium text-accent hover:underline"
              >
                Request a new link
              </Link>
            </div>
          ) : done ? (
            <div className="rounded-md border border-success/20 bg-success/5 px-3 py-3 text-center text-sm text-success">
              Password reset. Redirecting you to sign in…
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <div className="rounded-md border border-danger/20 bg-danger/5 px-3 py-2 text-sm text-danger">
                  {error}
                </div>
              )}
              <div>
                <label
                  htmlFor="rp-password"
                  className="mb-1.5 block text-sm font-medium text-text-primary"
                >
                  New password
                </label>
                <input
                  id="rp-password"
                  type="password"
                  autoComplete="new-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="at least 8 characters"
                  className="w-full rounded-md border border-border bg-surface-raised px-3 py-2 text-sm text-text-primary outline-none focus:border-accent placeholder:text-text-muted"
                />
              </div>
              <div>
                <label
                  htmlFor="rp-confirm"
                  className="mb-1.5 block text-sm font-medium text-text-primary"
                >
                  Confirm password
                </label>
                <input
                  id="rp-confirm"
                  type="password"
                  autoComplete="new-password"
                  required
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  className="w-full rounded-md border border-border bg-surface-raised px-3 py-2 text-sm text-text-primary outline-none focus:border-accent"
                />
              </div>
              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-md bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent-hover disabled:opacity-60"
              >
                {loading ? "Resetting…" : "Reset password"}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={null}>
      <ResetPasswordInner />
    </Suspense>
  );
}
