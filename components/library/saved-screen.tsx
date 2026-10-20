"use client";

import { useState, useTransition } from "react";
import { Shuffle } from "lucide-react";
import { pickFromSaved } from "@/app/(app)/library-actions";
import type { LibraryMovie } from "@/lib/library";
import { MEDIA, MOODS, type MoodId } from "@/lib/moods";
import { MAX_SAVES } from "@/lib/deck/finale";
import { AppFrame } from "@/components/shell/app-frame";
import { PickFlow, type FlowStart } from "@/components/pick/pick-flow";
import { Chip } from "@/components/pick/taps-screen";
import { cn } from "@/lib/cn";
import Link from "next/link";
import { SavedList, UnavailableList, WatchingList, type Unavailable, type WatchingEntry } from "./library-lists";

type Kind = "movie" | "series" | "book";
type Filter = "all" | Kind;

const count = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/**
 * Saved: series you're watching on top, then everything you saved, films and
 * series together with a filter, and "Pick from these", where the best-fitting
 * few go straight to the head-to-head.
 */
export function SavedScreen({
  items,
  watching,
  reading,
  counts,
  unavailable,
  moreHref,
  people,
}: {
  items: LibraryMovie[];
  watching: WatchingEntry[];
  reading: WatchingEntry[];
  /** The People section, rendered on the server. */
  people?: React.ReactNode;
  /** Everything saved, by kind: not only what this page shows. */
  counts: Record<Kind, number>;
  /** Saved, watching or reading titles whose details couldn't load just now. */
  unavailable: Unavailable[];
  /** "Show more", when more is saved than shown. */
  moreHref: string | null;
}) {
  const [start, setStart] = useState<(FlowStart & { media: Kind }) | null>(null);
  const [filter, setFilter] = useState<Filter>("all");
  if (start) return <PickFlow media={start.media} start={start} onExit={() => setStart(null)} />;

  const films = counts.movie;
  const shows = counts.series;
  const books = counts.book;
  const total = films + shows + books;
  const shown = filter === "all" ? items : items.filter((i) => i.media === filter);
  const shownUnavailable = filter === "all" ? unavailable : unavailable.filter((u) => u.media === filter);
  const kinds: Kind[] = (
    [
      ["movie", films],
      ["series", shows],
      ["book", books],
    ] as const
  ).flatMap(([k, n]) => (n > 0 ? [k] : []));
  const mixed = kinds.length > 1;

  return (
    <AppFrame>
      <div className="flex flex-col gap-10">
        <header className="flex flex-col gap-2">
          <span className="label text-muted">
            Saved
            {films > 0 && ` · ${count(films, "film", "films")}`}
            {shows > 0 && ` · ${shows} series`}
            {books > 0 && ` · ${count(books, "book", "books")}`}
            {total === 0 && " · nothing yet"}
          </span>
          <h1 className="display text-[clamp(3rem,7vw,6rem)]">For another night</h1>
        </header>

        {reading.length > 0 && <WatchingList media="book" entries={reading} />}
        {watching.length > 0 && <WatchingList entries={watching} />}

        {kinds.length > 0 && (
          <PickFromSaved
            key={filter}
            kinds={kinds}
            initial={filter === "all" ? kinds[0] : filter}
            counts={{ movie: films, series: shows, book: books }}
            onStart={setStart}
          />
        )}

        {mixed && (
          <div role="group" aria-label="Show" className="flex flex-wrap gap-2">
            {(
              [
                ["all", `All · ${total}`],
                ...(films ? ([["movie", `Movies · ${films}`]] as const) : []),
                ...(shows ? ([["series", `Series · ${shows}`]] as const) : []),
                ...(books ? ([["book", `Books · ${books}`]] as const) : []),
              ] as const
            ).map(([value, label]) => (
              <Chip key={value} pressed={filter === value} onClick={() => setFilter(value)}>
                {label}
              </Chip>
            ))}
          </div>
        )}

        {items.length > 0 && <SavedList movies={shown} />}
        {shownUnavailable.length > 0 && <UnavailableList items={shownUnavailable} />}
        {moreHref && (
          <Link href={moreHref} scroll={false} className="self-start text-sm font-bold underline underline-offset-4">
            Show more · {total - items.length - unavailable.filter((u) => u.list === "saved").length} older
          </Link>
        )}
        {people}
      </div>
    </AppFrame>
  );
}

function PickFromSaved({
  kinds,
  initial,
  counts,
  onStart,
}: {
  kinds: Kind[];
  initial: Kind;
  counts: Record<Kind, number>;
  onStart: (start: FlowStart & { media: Kind }) => void;
}) {
  const [kind, setKind] = useState<Kind>(initial);
  const [mood, setMood] = useState<MoodId>("gripping");
  const [time, setTime] = useState<0 | 1 | 2>(kind === "movie" ? 2 : 1);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const slug = (k: Kind): "movies" | "series" | "books" => (k === "movie" ? "movies" : k === "series" ? "series" : "books");
  const media = MEDIA[slug(kind)];
  const n = counts[kind];
  const noun = kind === "movie" ? "film" : kind === "series" ? "series" : "book";
  const moods: readonly MoodId[] = media.moods;

  function choose(next: Kind) {
    setKind(next);
    setError(null);
    if (!(MEDIA[slug(next)].moods as readonly MoodId[]).includes(mood)) setMood("gripping");
  }

  function go() {
    setError(null);
    startTransition(async () => {
      const result = await pickFromSaved({ media: kind, mood, time }).catch(() => null);
      if (!result?.ok) {
        setError(result?.error ?? "Couldn't reach TMDb just now. Try again in a moment.");
        return;
      }
      onStart({ media: kind, sessionId: result.sessionId, cards: result.cards, taps: result.taps, why: result.why });
    });
  }

  return (
    <section aria-labelledby="pick-saved" className="flex flex-col gap-5 rounded-3xl bg-soft p-5 sm:p-7">
      <div className="flex flex-col gap-1">
        <h2 id="pick-saved" className="text-2xl font-black">
          Pick from these
        </h2>
        <p className="text-muted">
          {n === 1
            ? `Only one saved ${noun}: if it fits, it's tonight's pick.`
            : `The ${Math.min(MAX_SAVES, n)} that best fit the mood go head-to-head. No new deck.`}
        </p>
      </div>
      {kinds.length > 1 && (
        <div role="group" aria-label="Pick a" className="flex gap-2">
          {kinds.map((k) => (
            <Chip key={k} pressed={kind === k} onClick={() => choose(k)}>
              {k === "movie" ? "A film" : k === "series" ? "A series" : "A book"}
            </Chip>
          ))}
        </div>
      )}
      <div className="flex flex-wrap gap-2" role="group" aria-label="Mood">
        {moods.map((id) => (
          <Chip key={id} pressed={mood === id} onClick={() => setMood(id)}>
            <span aria-hidden className="size-3.5 rounded-full" style={{ background: MOODS[id].color }} />
            {MOODS[id].label}
          </Chip>
        ))}
      </div>
      <div
        className="flex flex-wrap gap-2"
        role="group"
        aria-label={kind === "movie" ? "Time" : kind === "series" ? "Commitment" : "Length"}
      >
        {media.time.map((label, i) => (
          <Chip key={label} pressed={time === i} onClick={() => setTime(i as 0 | 1 | 2)}>
            {label}
          </Chip>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-4">
        <button
          type="button"
          onClick={go}
          disabled={pending}
          className={cn(
            "inline-flex h-13 items-center gap-2 rounded-full bg-accent px-6 font-bold text-on-accent transition-opacity hover:opacity-90 disabled:opacity-60",
          )}
        >
          <Shuffle className="size-5" aria-hidden />
          {pending ? "Choosing…" : "Pick from my saved"}
        </button>
        {error && (
          <p role="alert" className="text-sm font-semibold">
            {error}
          </p>
        )}
      </div>
    </section>
  );
}
