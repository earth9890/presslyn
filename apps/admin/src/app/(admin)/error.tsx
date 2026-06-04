"use client";

import { AlertCircleIcon } from "hugeicons-react";

export default function ErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center py-20">
      <AlertCircleIcon size={48} className="mb-4 text-danger" />
      <h2 className="text-xl font-semibold text-text-primary">
        Something went wrong
      </h2>
      <p className="mt-2 max-w-md text-center text-sm text-text-secondary">
        {error.message || "An unexpected error occurred. Please try again."}
      </p>
      <button
        onClick={reset}
        className="mt-6 rounded-md bg-accent px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-accent-hover focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none"
      >
        Try Again
      </button>
    </div>
  );
}
