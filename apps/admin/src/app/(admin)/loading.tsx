export default function Loading() {
  return (
    <div className="flex flex-1 items-center justify-center py-20">
      <div className="flex flex-col items-center gap-3">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-border border-t-accent" />
        <p className="text-sm text-text-secondary">Loading...</p>
      </div>
    </div>
  );
}
