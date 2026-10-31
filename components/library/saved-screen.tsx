"use client";

import { useEffect, useState, useTransition } from "react";
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
import { SavedList, UnavailableList, WatchingShelf, type Unavailable, type WatchingEntry } from "./library-lists";
import { Sheet } from "@/components/ui/sheet";

type Kind = "movie" | "series" | "book";
type Filter = "all" | Kind;

const count = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/**
 * Saved: a "Pick from these" chip (the head-to-head from your saves, in a
 * sheet), the kind filter, a thin shelf of what you're watching and reading,
 * then every save in one continuous flow.
 */
export function SavedScreen({
  items,
  fetched,
  watching,
  reading,
  counts,
  filter,
  unavailable,
}: {
  items: LibraryMovie[];
  /** Rows the first page took from the database. */
  fetched: number;
  watching: WatchingEntry[];
  reading: WatchingEntry[];
  /** Everything saved, by kind: not only what's loaded. */
  counts: Record<Kind, number>;
  /** Which kind the flow shows: everything, or one kind (from `?type=`). */
  filter: Filter;
  /** Saved, watching or reading titles whose details couldn't load just now. */
  unavailable: Unavailable[];
}) {
  const [start, setStart] = useState<(FlowStart & { media: Kind }) | null>(null);
  const [picking, setPicking] = useState(false);
  // A head-to-head from Saved is its own step in the browser's history, so Back returns to Saved.
  useEffect(() => {
    if (!start) return;
    window.history.pushState({ moodreelPick: true }, "");
    const onPop = () => setStart(null);
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, [start]);
  const leave = () => {
    if (window.history.state?.moodreelPick) window.history.back();
    else setStart(null);
  };
  if (start) return <PickFlow media={start.media} start={start} onExit={leave} />;

  const films = counts.movie;
  const shows = counts.series;
  const books = counts.book;
  const total = films + shows + books;
  const shownUnavailable = filter === "all" ? unavailable : unavailable.filter((u) => u.media === filter || u.list === "saved");
  const kinds: Kind[] = (
    [
      ["movie", films],
      ["series", shows],
      ["book", books],
    ] as const
  ).flatMap(([k, n]) => (n > 0 ? [k] : []));
  const chip = "inline-flex h-11 items-center gap-2 rounded-full border-2 px-4 text-[15px] font-semibold transition-colors sm:px-5";

  return (
    <AppFrame>
      <div className="flex flex-col gap-6">
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

        <div role="group" aria-label="Saved" className="flex flex-wrap gap-2">
          {kinds.length > 0 && (
            <button type="button" onClick={() => setPicking(true)} className={cn(chip, "border-accent bg-accent text-on-accent")}>
              <Shuffle className="size-4" aria-hidden /> Pick from these
            </button>
          )}
          {kinds.length > 1 &&
            (
              [
                ["all", `All · ${total}`],
                ...(films ? ([["movie", `Films · ${films}`]] as const) : []),
                ...(shows ? ([["series", `Series · ${shows}`]] as const) : []),
                ...(books ? ([["book", `Books · ${books}`]] as const) : []),
              ] as const
            ).map(([value, label]) => (
              <Link
                key={value}
                href={value === "all" ? "/saved" : `/saved?type=${value}`}
                aria-current={filter === value ? "page" : undefined}
                className={cn(chip, filter === value ? "border-fg" : "border-line hover:bg-soft")}
              >
                {label}
              </Link>
            ))}
        </div>

        {(reading.length > 0 || watching.length > 0) && (
          <div className="flex flex-wrap gap-x-10 gap-y-4">
            {watching.length > 0 && <WatchingShelf entries={watching} />}
            {reading.length > 0 && <WatchingShelf media="book" entries={reading} />}
          </div>
        )}

        {items.length > 0 && (
          <SavedList
            key={filter}
            movies={items}
            fetched={fetched}
            total={filter === "all" ? total : counts[filter]}
            // Those that didn't load are listed below the flow, not in it.
            shown={(filter === "all" ? total : counts[filter]) - unavailable.filter((u) => u.list === "saved").length}
            media={filter === "all" ? null : filter}
          />
        )}
        {shownUnavailable.length > 0 && <UnavailableList items={shownUnavailable} />}
      </div>

      {picking && (
        <Sheet title="Pick from these" onClose={() => setPicking(false)}>
          <PickFromSaved
            kinds={kinds}
            initial={filter === "all" ? kinds[0] : filter}
            counts={{ movie: films, series: shows, book: books }}
            onStart={setStart}
          />
        </Sheet>
      )}
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
    <section aria-label="Pick from your saved" className="flex flex-col gap-5">
      <div className="flex flex-col gap-1">
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
