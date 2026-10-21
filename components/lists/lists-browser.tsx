"use client";

import Link from "next/link";
import { Suspense, use, useEffect, useState } from "react";
import { Search } from "lucide-react";
import { findCollections } from "@/app/(app)/list-actions";
import { CoverFlow } from "@/components/flow/cover-flow";
import { Poster } from "@/components/pick/poster";
import { buttonClasses } from "@/components/ui/button";
import { collectionSlug } from "@/lib/lists/catalog";
import type { ListCover } from "@/lib/lists/covers";
import type { CollectionSummary } from "@/lib/tmdb/movies";
import { cn } from "@/lib/cn";
import { FollowListButton, Progress } from "./list-controls";

type Show = "all" | "movie" | "series" | "book" | "collections";
const SHOWS: { value: Show; label: string }[] = [
  { value: "all", label: "All" },
  { value: "movie", label: "Films" },
  { value: "series", label: "Series" },
  { value: "book", label: "Books" },
  { value: "collections", label: "Collections" },
];
const MEDIA_PATH = { movie: "movies", series: "series", book: "books" } as const;
const noun = (c: ListCover) =>
  c.kind === "collection" ? `Collection · ${c.total}` : `${c.total} ${c.media === "book" ? "books" : c.media === "series" ? "series" : "films"}`;

/**
 * Lists: search at the top (lists by name, and any TMDb collection), chips
 * for the kind, and the lists themselves as covers in a flow, each with its
 * size and how far through it you are. Collections shows the franchises
 * you've started, then well-known ones to start.
 */
export function ListsBrowser({ lists, started, suggested }: { lists: ListCover[]; started: ListCover[]; suggested: Promise<ListCover[]> }) {
  const [show, setShow] = useState<Show>("all");
  const [query, setQuery] = useState("");
  const q = query.trim().toLowerCase();
  const matches = (c: ListCover) => !q || c.title.toLowerCase().includes(q);
  const shown = (show === "collections" ? started : show === "all" ? [...lists, ...started] : lists.filter((l) => l.media === show)).filter(matches);

  return (
    <div className="flex flex-col gap-5">
      <label className="flex h-12 items-center gap-3 rounded-2xl px-4 shadow-[inset_0_0_0_2px_var(--line)] focus-within:shadow-[inset_0_0_0_2px_var(--fg)]">
        <Search className="size-5 text-muted" aria-hidden />
        <span className="sr-only">Search lists and collections</span>
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="A list, or a franchise: Dune, Baahubali…"
          className="h-full min-w-0 flex-1 bg-transparent outline-none placeholder:text-muted"
        />
      </label>
      {q.length >= 2 && <CollectionsFound query={q} />}

      <div role="group" aria-label="Show" className="flex flex-wrap gap-2">
        {SHOWS.map((s) => (
          <button
            key={s.value}
            type="button"
            aria-pressed={show === s.value}
            onClick={() => setShow(s.value)}
            className={cn(
              "inline-flex h-11 items-center rounded-full border-2 px-4 text-[15px] font-semibold transition-colors sm:px-5",
              show === s.value ? "border-fg" : "border-line hover:bg-soft",
            )}
          >
            {s.label}
          </button>
        ))}
      </div>

      {shown.length > 0 ? (
        <Covers key={`${show}:${q}`} covers={shown} label="Lists" />
      ) : (
        show !== "collections" && <p className="text-muted">No list by that name. Try the collections search above.</p>
      )}
      {show === "collections" && (
        <Suspense fallback={<p className="text-muted">Finding well-known collections…</p>}>
          <Suggested suggested={suggested} matches={matches} />
        </Suspense>
      )}
    </div>
  );
}

function Suggested({ suggested, matches }: { suggested: Promise<ListCover[]>; matches: (c: ListCover) => boolean }) {
  const covers = use(suggested).filter(matches);
  if (!covers.length) return null;
  return (
    <section aria-labelledby="suggested-collections" className="flex flex-col gap-2">
      <h2 id="suggested-collections" className="text-xl font-black">
        Well-known collections
      </h2>
      <Covers covers={covers} label="Well-known collections" tint={false} />
    </section>
  );
}

function Covers({ covers, label, tint = true }: { covers: ListCover[]; label: string; tint?: boolean }) {
  return (
    <CoverFlow
      label={label}
      tint={tint}
      items={covers.map((c) => ({ key: c.slug, title: c.title, image: c.poster, badge: noun(c) }))}
      infos={covers.map((c) => (
        <div key={c.slug} className="flex flex-col items-center gap-3 text-center">
          <div className="flex flex-col items-center gap-1">
            <Link href={`/lists/${c.slug}`} className="text-2xl leading-tight font-black underline-offset-4 hover:underline">
              {c.title}
            </Link>
            <p className="line-clamp-2 max-w-[52ch] text-sm text-muted">{c.blurb}</p>
          </div>
          <div className="w-full max-w-xs">
            <Progress seen={c.seen} total={c.total} word={c.media === "book" ? "read" : "seen"} />
          </div>
          <div className="flex flex-wrap justify-center gap-2">
            <Link href={`/lists/${c.slug}`} className={buttonClasses("solid", "md")}>
              Open the list
            </Link>
            <Link href={`/${MEDIA_PATH[c.media]}?list=${encodeURIComponent(c.slug)}&name=${encodeURIComponent(c.title)}`} className={buttonClasses("outline", "md")}>
              Deal from it
            </Link>
            <FollowListButton slug={c.slug} initial={c.following} />
          </div>
        </div>
      ))}
    />
  );
}

/** Any TMDb collection by name, as you type. */
function CollectionsFound({ query }: { query: string }) {
  const [found, setFound] = useState<{ query: string; results: CollectionSummary[] } | null>(null);
  useEffect(() => {
    let live = true;
    const timer = setTimeout(() => {
      findCollections(query)
        .catch(() => [])
        .then((results) => live && setFound({ query, results }));
    }, 250);
    return () => {
      live = false;
      clearTimeout(timer);
    };
  }, [query]);
  if (!found || found.results.length === 0) return null;
  return (
    <ul aria-label="Collections found" className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
      {found.results.map((c) => (
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
  );
}
