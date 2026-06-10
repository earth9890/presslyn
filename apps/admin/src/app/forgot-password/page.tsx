"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { SquareLock02Icon } from "hugeicons-react";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/v1/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        setError(data?.error ?? "Something went wrong. Please try again.");
        return;
      }
      setSent(true);
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
          <h1 className="text-xl font-bold text-text-primary">Reset your password</h1>
          <p className="mt-1 text-center text-sm text-text-secondary">
            Enter your account email and we&apos;ll send you a reset link.
          </p>
        </div>

        <div className="rounded-lg border border-border bg-surface p-6 shadow-sm">
          {sent ? (
            <div className="space-y-4 text-center">
              <div className="rounded-md border border-success/20 bg-success/5 px-3 py-3 text-sm text-success">
                If an account exists for that email, a password reset link has
                been sent. Check your inbox.
              </div>
              <Link
                href="/login"
                className="inline-block text-sm font-medium text-accent hover:underline"
              >
                Back to sign in
              </Link>
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
                  htmlFor="fp-email"
                  className="mb-1.5 block text-sm font-medium text-text-primary"
                >
                  Email
                </label>
                <input
                  id="fp-email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full rounded-md border border-border bg-surface-raised px-3 py-2 text-sm text-text-primary outline-none focus:border-accent"
                />
              </div>
              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-md bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent-hover disabled:opacity-60"
              >
                {loading ? "Sending…" : "Send reset link"}
              </button>
              <div className="text-center">
                <Link
                  href="/login"
                  className="text-sm font-medium text-accent hover:underline"
                >
                  Back to sign in
                </Link>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
