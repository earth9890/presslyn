import Link from "next/link";
import { FileSearchIcon } from "hugeicons-react";

export default function NotFound() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center py-20">
      <FileSearchIcon size={48} className="mb-4 text-text-muted" />
      <h2 className="text-xl font-semibold text-text-primary">
        Page Not Found
      </h2>
      <p className="mt-2 text-sm text-text-secondary">
        The page you are looking for does not exist or has been moved.
      </p>
      <Link
        href="/"
        className="mt-6 rounded-md bg-accent px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-accent-hover focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none"
      >
        Back to Dashboard
      </Link>
    </div>
  );
}
