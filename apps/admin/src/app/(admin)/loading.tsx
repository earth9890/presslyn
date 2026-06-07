export default function Loading() {
  return (
    <div className="space-y-5 py-6">
      <div className="overflow-hidden rounded-2xl border border-border bg-surface shadow-[0_18px_42px_rgba(15,23,42,0.06)]">
        <div className="h-1 bg-accent/15">
          <div className="presslyn-admin-progress h-full w-1/3 rounded-full bg-accent" />
        </div>
        <div className="flex items-center gap-3 px-4 py-3">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-border border-t-accent" />
          <p className="text-sm font-medium text-text-primary">
            Loading admin content
          </p>
        </div>
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.55fr)_minmax(320px,0.95fr)]">
        <div className="space-y-5">
          <div className="h-48 animate-pulse rounded-2xl border border-border bg-surface" />
          <div className="h-72 animate-pulse rounded-2xl border border-border bg-surface" />
        </div>
        <div className="space-y-5">
          <div className="h-52 animate-pulse rounded-2xl border border-border bg-surface" />
          <div className="h-64 animate-pulse rounded-2xl border border-border bg-surface" />
        </div>
      </div>
    </div>
  );
}
