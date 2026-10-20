"use client";

import Link from "next/link";
import { useEffect, useState, useTransition } from "react";
import { Check, Search } from "lucide-react";
import { findCollections, followList } from "@/app/(app)/list-actions";
import { collectionSlug } from "@/lib/lists/catalog";
import type { CollectionSummary } from "@/lib/tmdb/movies";
import { Poster } from "@/components/pick/poster";
import { cn } from "@/lib/cn";

/** Follow / Following for a list: no page refresh, the button holds the state. */
export function FollowListButton({ slug, initial }: { slug: string; initial: boolean }) {
  const [following, setFollowing] = useState(initial);
  const [pending, startTransition] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      aria-pressed={following}
      onClick={() => {
        const next = !following;
        setFollowing(next);
        startTransition(async () => {
          try {
            await followList(slug, next);
          } catch {
            setFollowing(!next);
          }
        });
      }}
      className={cn(
        "inline-flex h-12 items-center gap-2 rounded-full border-2 px-5 font-bold disabled:opacity-60",
        following ? "border-accent bg-accent text-on-accent" : "border-line hover:bg-soft",
      )}
    >
      {following ? (
        <>
          <Check className="size-4" aria-hidden /> Following
        </>
      ) : (
        "Follow"
      )}
    </button>
  );
}

/** Find any TMDb film collection (a franchise, a trilogy) to browse or deal from. */
export function CollectionSearch() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<CollectionSummary[] | null>(null);

  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) return;
    let live = true;
    const timer = setTimeout(async () => {
      const found = await findCollections(q).catch(() => []);
      if (live) setResults(found);
    }, 300);
    return () => {
      live = false;
      clearTimeout(timer);
    };
  }, [query]);

  const shown = query.trim().length >= 2 ? results : null;
  return (
    <div className="flex flex-col gap-3">
      <label className="flex h-12 items-center gap-3 rounded-2xl px-4 shadow-[inset_0_0_0_2px_var(--line)] focus-within:shadow-[inset_0_0_0_2px_var(--fg)]">
        <Search className="size-5 text-muted" aria-hidden />
        <span className="sr-only">Search collections</span>
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="A franchise: The Godfather, Dune, Baahubali…"
          className="h-full min-w-0 flex-1 bg-transparent outline-none placeholder:text-muted"
        />
      </label>
      {shown && shown.length === 0 && <p className="text-sm text-muted">No collection by that name.</p>}
      {shown && shown.length > 0 && (
        <ul aria-label="Collections found" className="grid gap-2 sm:grid-cols-2">
          {shown.map((c) => (
            <li key={c.id}>
              <Link href={`/lists/${collectionSlug(c.id)}`} className="flex items-center gap-3 rounded-xl p-2 hover:bg-soft">
                <div className="w-10 shrink-0">
                  <Poster title={c.name} path={c.posterPath} size="sm" sizes="40px" className="rounded-md shadow-none" />
                </div>
                <span className="font-bold">{c.name}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** "47 of 250 seen", as a thin bar. */
export function Progress({ seen, total, word }: { seen: number; total: number; word: string }) {
  const share = total ? Math.round((seen / total) * 100) : 0;
  return (
    <div className="flex flex-col gap-1.5">
      <div
        role="progressbar"
        aria-label={`${seen} of ${total} ${word}`}
        aria-valuemin={0}
        aria-valuemax={total}
        aria-valuenow={seen}
        className="h-1.5 w-full overflow-hidden rounded-full bg-soft shadow-[inset_0_0_0_1px_var(--line)]"
      >
        <div className="h-full rounded-full bg-accent" style={{ width: `${share}%` }} />
      </div>
      <span className="text-xs font-semibold text-muted">
        {total ? `${seen} of ${total} ${word}` : "Fills in when you open it"}
      </span>
    </div>
  );
}
