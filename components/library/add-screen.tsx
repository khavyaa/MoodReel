"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import { Check, Search, Star, X } from "lucide-react";
import { findTitles, haveYouSeen, markKnown, type AddCandidate } from "@/app/(app)/add-actions";
import { undoLibrary } from "@/app/(app)/library-actions";
import { useToast } from "@/components/ui/toast";
import type { Media } from "@/lib/picks/server";
import { Poster } from "@/components/pick/poster";
import { buttonClasses } from "@/components/ui/button";
import { cn } from "@/lib/cn";

type Mode = "search" | "stack";

const KINDS: { media: Media; label: string }[] = [
  { media: "movie", label: "Films" },
  { media: "series", label: "Series" },
  { media: "book", label: "Books" },
];

/**
 * Add what you'd watched or read before: search any title, or go through a
 * stack of well-known ones. Each answer counts like the swipe.
 */
export function AddScreen() {
  const [media, setMedia] = useState<Media>("movie");
  const [mode, setMode] = useState<Mode>("stack");
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
        <div role="group" aria-label="What" className="flex gap-1 rounded-full bg-soft p-1">
          {KINDS.map((k) => (
            <Tab key={k.media} active={media === k.media} onClick={() => setMedia(k.media)}>
              {k.label}
            </Tab>
          ))}
        </div>
        <div role="group" aria-label="How" className="flex gap-1 rounded-full bg-soft p-1">
          <Tab active={mode === "stack"} onClick={() => setMode("stack")}>
            {media === "book" ? "Have you read these?" : "Have you seen these?"}
          </Tab>
          <Tab active={mode === "search"} onClick={() => setMode("search")}>
            Search
          </Tab>
        </div>
      </div>
      {mode === "search" ? <SearchAdd key={media} media={media} /> : <Stack key={media} media={media} />}
    </div>
  );
}

function Tab({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn("h-10 rounded-full px-4 text-sm font-bold", active ? "bg-fg text-bg" : "hover:bg-bg")}
    >
      {children}
    </button>
  );
}

/**
 * One title's answer: stars (seen, rated), seen without a rating, or not for
 * me. Each answer offers Undo for a few seconds; `onUndo` puts the title back
 * in front of you (the stack brings it back to the top).
 */
function useAnswer(item: AddCandidate, onUndo?: () => void) {
  const [state, setState] = useState<AddCandidate["state"]>(item.state);
  const [stars, setStars] = useState<number | null>(item.stars);
  const [pending, startTransition] = useTransition();
  const toast = useToast();
  const answer = useCallback(
    (kind: "seen" | "disliked", rating: number | null, after?: () => void) => {
      const before = { state, stars };
      setState(kind);
      setStars(rating);
      after?.();
      const sent = markKnown(item.media, { id: item.id, language: item.language, genreIds: item.genreIds, tags: item.tags }, kind, rating);
      sent.catch(() => undefined);
      toast({
        message:
          kind === "disliked"
            ? `Not for me: ${item.title}`
            : `${item.media === "book" ? "Read" : "Seen"}${rating ? ` ${"★".repeat(rating)}` : ""}: ${item.title}`,
        undone: `${item.title} is back as it was`,
        undo: async () => {
          await sent.catch(() => undefined);
          await undoLibrary({ media: item.media, id: item.id, kind });
          setState(before.state);
          setStars(before.stars);
          onUndo?.();
        },
      });
      startTransition(async () => {
        try {
          await sent;
        } catch {
          setState(before.state);
          setStars(before.stars);
        }
      });
    },
    [item, state, stars, toast, onUndo],
  );
  return { state, stars, pending, answer };
}

function StarRow({ title, value, onPick }: { title: string; value: number | null; onPick: (n: number) => void }) {
  return (
    <div role="group" aria-label={`Rate ${title}`} className="flex">
      {[1, 2, 3, 4, 5].map((n) => (
        <button key={n} type="button" onClick={() => onPick(n)} aria-label={`${n} star${n > 1 ? "s" : ""}`} className="-m-0.5 p-2.5">
          <Star className={cn("size-6", value !== null && n <= value ? "fill-current" : "opacity-35")} aria-hidden />
        </button>
      ))}
    </div>
  );
}

const seenWord = (media: Media) => (media === "book" ? "Read it" : "Seen it");

/* ----------------------------------------------------------------- search */

function SearchAdd({ media }: { media: Media }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<AddCandidate[] | null>(null);

  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) return;
    let live = true;
    const timer = setTimeout(async () => {
      const found = await findTitles(media, q).catch(() => []);
      if (live) setResults(found);
    }, 300);
    return () => {
      live = false;
      clearTimeout(timer);
    };
  }, [query, media]);

  const shown = query.trim().length >= 2 ? results : null;
  return (
    <div className="flex flex-col gap-4">
      <label className="flex h-12 items-center gap-3 rounded-2xl px-4 shadow-[inset_0_0_0_2px_var(--line)] focus-within:shadow-[inset_0_0_0_2px_var(--fg)]">
        <Search className="size-5 text-muted" aria-hidden />
        <span className="sr-only">Search {media === "book" ? "books" : media === "series" ? "series" : "films"}</span>
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={media === "book" ? "A title or an author" : "A title"}
          className="h-full min-w-0 flex-1 bg-transparent outline-none placeholder:text-muted"
        />
      </label>
      {shown && shown.length === 0 && <p className="text-muted">Nothing found by that name.</p>}
      {shown && shown.length > 0 && (
        <ul aria-label="Search results" className="flex flex-col gap-4">
          {shown.map((item) => (
            <SearchRow key={item.id} item={item} />
          ))}
        </ul>
      )}
    </div>
  );
}

function SearchRow({ item }: { item: AddCandidate }) {
  const { state, stars, answer } = useAnswer(item);
  return (
    <li className="grid grid-cols-[56px_minmax(0,1fr)] gap-4">
      <Poster title={item.title} path={item.posterPath} size="sm" sizes="56px" className="rounded-lg shadow-none" />
      <div className="flex min-w-0 flex-col gap-1.5">
        <p className="truncate font-black">{item.title}</p>
        <p className="text-sm text-muted">{[item.by, item.year].filter(Boolean).join(" · ") || " "}</p>
        {state === "disliked" ? (
          <p className="text-sm font-semibold">Not for me</p>
        ) : (
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <StarRow title={item.title} value={stars} onPick={(n) => answer("seen", n === stars ? null : n)} />
            {state === "seen" ? (
              <span className="inline-flex items-center gap-1 text-sm font-semibold">
                <Check className="size-4" aria-hidden /> {item.media === "book" ? "Read" : "Seen"}
              </span>
            ) : (
              <>
                <button type="button" onClick={() => answer("seen", null)} className="text-sm font-semibold underline-offset-4 hover:underline">
                  {seenWord(item.media)}, no rating
                </button>
                <button type="button" onClick={() => answer("disliked", null)} className="text-sm text-muted underline-offset-4 hover:underline">
                  Not for me
                </button>
              </>
            )}
          </div>
        )}
      </div>
    </li>
  );
}

/* ------------------------------------------------------------------ stack */

function Stack({ media }: { media: Media }) {
  const [queue, setQueue] = useState<AddCandidate[]>([]);
  const [page, setPage] = useState(1);
  const [done, setDone] = useState(0);
  const [loading, setLoading] = useState(true);
  const [exhausted, setExhausted] = useState(false);

  useEffect(() => {
    let live = true;
    haveYouSeen(media, page)
      .then((found) => {
        if (!live) return;
        setQueue((q) => [...q, ...found.filter((f) => !q.some((x) => x.id === f.id))]);
        if (found.length === 0 && page >= 5) setExhausted(true);
        else if (found.length === 0) setPage((p) => p + 1);
      })
      .catch(() => live && setExhausted(true))
      .finally(() => live && setLoading(false));
    return () => {
      live = false;
    };
  }, [media, page]);

  // Keep a few ahead: fetch the next page as the queue runs low.
  const current = queue[0];
  const next = useCallback(() => {
    setDone((d) => d + 1);
    setQueue((q) => {
      const rest = q.slice(1);
      if (rest.length < 4 && !exhausted) setPage((p) => p + 1);
      return rest;
    });
  }, [exhausted]);

  if (!current) {
    return (
      <p className="text-muted" role="status">
        {loading ? "Finding well-known titles…" : exhausted ? "That's all for now. Search for anything else." : "Loading more…"}
      </p>
    );
  }
  return (
    <div className="flex flex-col gap-3">
      <p className="label text-muted">{done > 0 ? `${done} answered` : "One at a time: answer and the next one comes up"}</p>
      <StackCard
        key={`${current.media}:${current.id}`}
        item={current}
        onAnswered={next}
        onUndo={(item) => {
          setDone((d) => Math.max(0, d - 1));
          setQueue((q) => [item, ...q.filter((x) => x.id !== item.id)]);
        }}
      />
    </div>
  );
}

function StackCard({ item, onAnswered, onUndo }: { item: AddCandidate; onAnswered: () => void; onUndo: (item: AddCandidate) => void }) {
  const { answer } = useAnswer(item, () => onUndo(item));
  const word = item.media === "book" ? "read" : "seen";
  return (
    <section
      aria-label={item.title}
      className="grid max-w-3xl gap-5 rounded-3xl bg-soft p-5 sm:grid-cols-[180px_minmax(0,1fr)] sm:p-7"
    >
      <div className="mx-auto w-40 sm:w-full">
        <Poster title={item.title} path={item.posterPath} size="md" sizes="180px" />
      </div>
      <div className="flex flex-col gap-4">
        <div>
          <h2 className="text-3xl leading-tight font-black">{item.title}</h2>
          <p className="text-muted">{[item.by, item.year].filter(Boolean).join(" · ")}</p>
        </div>
        <div className="flex flex-col gap-1">
          <p className="font-bold">Have you {word} it? Rate it:</p>
          <StarRow title={item.title} value={null} onPick={(n) => answer("seen", n, onAnswered)} />
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => answer("seen", null, onAnswered)} className={buttonClasses("outline", "md")}>
            <Check className="size-4" aria-hidden /> {item.media === "book" ? "Read it" : "Seen it"}, no rating
          </button>
          <button type="button" onClick={onAnswered} className={buttonClasses("solid", "md")}>
            {item.media === "book" ? "Haven't read it" : "Haven't seen it"}
          </button>
          <button type="button" onClick={() => answer("disliked", null, onAnswered)} className={buttonClasses("ghost", "md")}>
            <X className="size-4" aria-hidden /> Not for me
          </button>
        </div>
      </div>
    </section>
  );
}
