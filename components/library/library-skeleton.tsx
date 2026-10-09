export function LibrarySkeleton({ eyebrow }: { eyebrow: string }) {
  return (
    <div className="flex flex-col gap-8" role="status" aria-label={`Loading ${eyebrow.toLowerCase()}`}>
      <span className="label text-muted">{eyebrow}</span>
      <div className="grid gap-8 md:grid-cols-2">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="grid grid-cols-[96px_1fr] gap-4 sm:grid-cols-[120px_1fr]">
            <div className="aspect-[2/3] animate-pulse rounded-xl bg-soft" />
            <div className="flex flex-col gap-3 pt-1">
              <div className="h-3 w-1/3 animate-pulse rounded bg-soft" />
              <div className="h-6 w-2/3 animate-pulse rounded bg-soft" />
              <div className="h-3 w-full animate-pulse rounded bg-soft" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
