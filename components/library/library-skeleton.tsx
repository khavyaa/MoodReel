/** While Saved or History loads: the shape of a cover flow (a poster in front, two either side), so nothing jumps. */
export function LibrarySkeleton({ eyebrow }: { eyebrow: string }) {
  return (
    <div className="flex flex-col gap-8" role="status" aria-label={`Loading ${eyebrow.toLowerCase()}`}>
      <span className="label text-muted">{eyebrow}</span>
      <div className="h-[clamp(3rem,7vw,6rem)] w-2/3 animate-pulse rounded-2xl bg-soft" />
      <div className="flex items-center justify-center gap-3 overflow-hidden py-4">
        {[0.7, 0.85, 1, 0.85, 0.7].map((scale, i) => (
          <div
            key={i}
            className="aspect-[2/3] w-[168px] shrink-0 animate-pulse rounded-xl bg-soft sm:w-[200px] lg:w-[236px]"
            style={{ transform: `scale(${scale})`, opacity: scale }}
          />
        ))}
      </div>
      <div className="mx-auto flex w-full max-w-xl flex-col items-center gap-3">
        <div className="h-6 w-1/2 animate-pulse rounded bg-soft" />
        <div className="h-3 w-2/3 animate-pulse rounded bg-soft" />
      </div>
    </div>
  );
}
