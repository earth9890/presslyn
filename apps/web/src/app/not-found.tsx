import Link from "next/link";

export default function NotFound() {
  return (
    <div className="py-20 text-center">
      <p className="font-serif text-6xl font-bold text-accent">404</p>
      <h1 className="mt-4 font-serif text-2xl font-bold">Page not found</h1>
      <p className="mt-2 text-muted">
        The page you were looking for doesn’t exist or has been moved.
      </p>
      <Link
        href="/"
        className="mt-6 inline-block rounded-md bg-accent px-5 py-2.5 font-medium text-background"
      >
        Back home
      </Link>
    </div>
  );
}
