import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/cn";

/** Which page a list is on, from `?page=`: 1 to `pages`. */
export function pageFrom(page: string | string[] | undefined, pages: number): number {
  const n = Number(Array.isArray(page) ? page[0] : page);
  return Number.isInteger(n) && n >= 1 ? Math.min(n, Math.max(1, pages)) : 1;
}

/** Page numbers to show: the first, the last, and two either side of the current one, with gaps. */
export function pageNumbers(page: number, pages: number): (number | "gap")[] {
  const keep = new Set([1, pages, page - 2, page - 1, page, page + 1, page + 2].filter((n) => n >= 1 && n <= pages));
  const sorted = [...keep].sort((a, b) => a - b);
  return sorted.flatMap((n, i) => (i > 0 && n - sorted[i - 1] > 1 ? ["gap" as const, n] : [n]));
}

/** Newer · 1 2 3 … 9 · Older, as links (the page renders on the server). Nothing when there's one page. */
export function Pager({ page, pages, href, label }: { page: number; pages: number; href: (page: number) => string; label: string }) {
  if (pages <= 1) return null;
  const item = "inline-flex h-11 min-w-11 items-center justify-center rounded-full px-3 text-sm font-semibold";
  return (
    <nav aria-label={label} className="flex flex-wrap items-center gap-1">
      {page > 1 ? (
        <Link href={href(page - 1)} className={cn(item, "hover:bg-soft")} aria-label="Previous page">
          <ChevronLeft className="size-4" aria-hidden /> Newer
        </Link>
      ) : null}
      {pageNumbers(page, pages).map((n, i) =>
        n === "gap" ? (
          <span key={`gap-${i}`} className="px-1 text-muted" aria-hidden>
            …
          </span>
        ) : (
          <Link
            key={n}
            href={href(n)}
            aria-current={n === page ? "page" : undefined}
            aria-label={`Page ${n}`}
            className={cn(item, n === page ? "bg-fg text-bg" : "hover:bg-soft")}
          >
            {n}
          </Link>
        ),
      )}
      {page < pages ? (
        <Link href={href(page + 1)} className={cn(item, "hover:bg-soft")} aria-label="Next page">
          Older <ChevronRight className="size-4" aria-hidden />
        </Link>
      ) : null}
    </nav>
  );
}
