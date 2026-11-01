// Shown at once while a private page loads on the server, so a click on
// "Edit" or "Review" answers immediately instead of seeming to do nothing.
// loading.tsx files get no params, so it has no text (no language).
export function PageSkeleton({ blocks = 3 }: { blocks?: number }) {
  return (
    <div className="flex flex-col gap-5" aria-busy="true">
      <div className="h-8 w-56 animate-pulse rounded-lg bg-border/60" />
      {Array.from({ length: blocks }, (_, i) => (
        <div key={i} className="h-40 animate-pulse rounded-2xl border border-border bg-border/30" />
      ))}
    </div>
  );
}
