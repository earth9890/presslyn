"use client";

import { useEffect } from "react";

/**
 * Public site error boundary. Server-component data fetches in the templates
 * are per-request (force-dynamic); without this, a thrown error renders the
 * unstyled default Next error page. Keeps details out of the UI in production.
 */
export default function WebError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[presslyn:web] Render error:", error);
  }, [error]);

  return (
    <div style={{ padding: "5rem 1rem", textAlign: "center" }}>
      <h1 style={{ fontSize: "1.75rem", fontWeight: 700, marginBottom: "0.75rem" }}>
        Something went wrong
      </h1>
      <p style={{ opacity: 0.75, marginBottom: "1.5rem" }}>
        We couldn&apos;t load this page right now. Please try again.
      </p>
      <button
        type="button"
        onClick={reset}
        style={{
          padding: "0.5rem 1.25rem",
          borderRadius: "0.5rem",
          border: "1px solid var(--border, #d1d5db)",
          background: "var(--accent, #3582c4)",
          color: "#fff",
          cursor: "pointer",
          fontSize: "0.9rem",
        }}
      >
        Try again
      </button>
    </div>
  );
}
