"use client";

import { useOptimistic, useState, useTransition } from "react";
import { ADVANCE_AFTER, CoverFlow } from "@/components/flow/cover-flow";
import { StarPrompt } from "@/components/flow/star-prompt";
import { Sheet } from "@/components/ui/sheet";
import { useMore } from "./use-more";
import { useRouter } from "next/navigation";
import { Check, ExternalLink, Play, RotateCcw, Star, X } from "lucide-react";
import { markSeen, morePicks, moreSaved, moreSeen, rateTitle, removeSaved } from "@/app/(app)/library-actions";
import type { LibraryMovie } from "@/lib/library";
import { MOODS, type MoodId } from "@/lib/moods";
import { airingLabel, bestsellerLabel, cardMeta, makersLabel, ratingScale } from "@/lib/card-meta";
import { whereTo } from "@/lib/watch";
import { buttonClasses } from "@/components/ui/button";
import { cn } from "@/lib/cn";
import { linkChip, linkLine } from "@/components/pick/title-link";
import type { FollowUpAnswer, Media } from "@/lib/picks/server";
import { CheckInAnswers, WatchAnswer } from "./watch-prompt";
import { DetailsButton } from "./title-details";
import { Poster } from "@/components/pick/poster";

// You're in India; dates read the same on the server (UTC) and in the browser.
const DATE = new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Kolkata" });

function meta(m: LibraryMovie) {
  const kind = m.media === "series" ? "Series · " : m.media === "book" ? "Book · " : "";
  return `${kind}${cardMeta(m)}`;
}

const keyOf = (m: { media: Media; id: number }) => `${m.media}:${m.id}`;

function WatchLinks({ movie }: { movie: LibraryMovie }) {
  const where = whereTo(movie);
  return (
    <div className="flex flex-wrap gap-2">
      <a href={where.href} target="_blank" rel="noreferrer noopener" className={buttonClasses("solid", "sm")}>
        {where.label} <ExternalLink className="size-3.5" aria-hidden />
      </a>
      {movie.trailerKey && (
        <a
          href={`https://www.youtube.com/watch?v=${movie.trailerKey}`}
          target="_blank"
          rel="noreferrer noopener"
          className={buttonClasses("outline", "sm")}
        >
          <Play className="size-3.5 fill-current" aria-hidden /> Trailer
        </a>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ saved */

/**
 * Every save, one continuous flow (more load as you near the end). Seen it /
 * Read it asks for stars, then the card leaves and the next comes forward;
 * Remove takes it out straight away.
 */
export function SavedList({
  movies,
  fetched,
  total,
  shown,
  media,
}: {
  movies: LibraryMovie[];
  /** Rows the first page took from the database (saved titles that didn't load are among them). */
  fetched: number;
  /** Saves in all. */
  total: number;
  /** How many of them are cards (those that didn't load are listed apart). */
  shown: number;
  /** The kind shown, or every kind. */
  media: Media | null;
}) {
  const more = useMore(movies, fetched, total, (offset) => moreSaved(media, offset).then((r) => ({ list: r.movies, fetched: r.fetched })), shown);
  if (more.list.length === 0) return <p className="text-lg text-muted">All cleared.</p>;
  return (
    <CoverFlow
      label="Saved titles"
      total={more.total}
      onNearEnd={more.nearEnd}
      items={more.list.map((m) => ({ key: keyOf(m), title: m.title, image: m.posterPath }))}
      infos={more.list.map((m) => (
        <SavedInfo key={keyOf(m)} movie={m} onGone={() => more.remove((x) => keyOf(x) === keyOf(m))} />
      ))}
    />
  );
}

function SavedInfo({ movie: m, onGone }: { movie: LibraryMovie; onGone: () => void }) {
  const [rating, setRating] = useState(false);
  return (
    <div className="flex flex-col items-center gap-2 text-center">
      <p className="label text-muted">{meta(m)}</p>
      <h2 className="text-2xl leading-tight font-black">{m.title}</h2>
      <p className="flex flex-wrap items-center justify-center gap-x-2 gap-y-1 text-sm">
        <span className="inline-flex items-center gap-1 font-semibold">
          <Star className="size-3.5 fill-current" aria-hidden /> {m.rating.toFixed(1)}
          <span className="font-normal opacity-70">{ratingScale(m)}</span>
        </span>
        {m.streamingOn.map((s) => (
          <span key={s} className="rounded-md bg-accent px-1.5 py-0.5 text-xs font-bold text-on-accent">
            {s}
          </span>
        ))}
        {airingLabel(m) && <span className="text-xs text-muted">{airingLabel(m)}</span>}
        {bestsellerLabel(m) && <span className="text-xs text-muted">{bestsellerLabel(m)}</span>}
      </p>
      {m.book && makersLabel(m) && <p className="-mt-1 text-sm font-semibold">{makersLabel(m)}</p>}
      {m.link && (
        <span className={cn("rounded-md px-2 py-0.5 text-xs font-bold", m.link.known ? "bg-fg text-bg" : "shadow-[inset_0_0_0_1.5px_var(--fg)]")}>
          {linkChip(m.link)}
        </span>
      )}
      {m.overview && <p className="line-clamp-2 max-w-[52ch] text-sm text-muted">{m.overview}</p>}
      {rating ? (
        <StarPrompt title={m.title} onRate={(n) => void rateTitle(m.media, m.id, n).catch(() => undefined)} onDone={() => setTimeout(onGone, ADVANCE_AFTER)} />
      ) : (
        <>
          <WatchLinks movie={m} />
          <div className="flex flex-wrap justify-center gap-2 pt-1">
            <button
              type="button"
              onClick={() => {
                setRating(true);
                void markSeen(m.media, m.id).catch(() => setRating(false));
              }}
              className={buttonClasses("outline", "sm")}
            >
              <Check className="size-4" aria-hidden /> {m.media === "book" ? "Read it" : "Seen it"}
            </button>
            <button
              type="button"
              onClick={() => {
                onGone();
                void removeSaved(m.media, m.id).catch(() => undefined);
              }}
              className={buttonClasses("ghost", "sm")}
            >
              <X className="size-4" aria-hidden /> Remove
            </button>
            <DetailsButton card={m} media={m.media} id={m.id} title={m.title} className={buttonClasses("ghost", "sm")} />
          </div>
        </>
      )}
    </div>
  );
}

/* ---------------------------------------------------------------- history */

export type HistoryEntry = {
  sessionId: string;
  mood: string;
  why: string | null;
  pickedAt: string | null;
  seen: boolean;
  /** Series: still on your Watching list. */
  watching: boolean;
  /** Series: you gave up on it. */
  dropped: boolean;
  followUp: FollowUpAnswer | null;
  /** 1–5 stars, or null when not rated yet. */
  stars: number | null;
  movie: LibraryMovie;
};

export function HistoryList({ entries, fetched, total }: { entries: HistoryEntry[]; fetched: number; total: number }) {
  const more = useMore(entries, fetched, total, (offset) => morePicks(offset).then((r) => ({ list: r.entries, fetched: r.fetched })));
  return (
    <CoverFlow
      label="Your picks"
      total={more.total}
      onNearEnd={more.nearEnd}
      items={more.list.map((e) => ({ key: e.sessionId, title: e.movie.title, image: e.movie.posterPath, done: e.seen }))}
      infos={more.list.map((e) => {
        const mood = MOODS[e.mood as MoodId];
        return (
          <div key={e.sessionId} className="flex flex-col items-center gap-2 text-center">
            <p className="label flex flex-wrap items-center justify-center gap-x-2 text-muted">
              {e.pickedAt && <span>{DATE.format(new Date(e.pickedAt))}</span>}
              {mood && (
                <span className="inline-flex items-center gap-1.5">
                  <span className="size-2.5 rounded-full" style={{ background: mood.color }} aria-hidden />
                  {mood.label}
                </span>
              )}
            </p>
            <h2 className="text-2xl leading-tight font-black">{e.movie.title}</h2>
            <p className="text-sm text-muted">{meta(e.movie)}</p>
            {e.movie.link && <p className="text-sm font-semibold">{linkLine(e.movie.link)}</p>}
            {e.why && <p className="max-w-[56ch] leading-snug">{e.why}</p>}
            {e.seen ? (
              <Stars media={e.movie.media} id={e.movie.id} stars={e.stars} title={e.movie.title} />
            ) : e.movie.media !== "movie" ? (
              e.watching ? (
                <div className="flex flex-col items-center gap-2">
                  <p className="text-sm font-semibold">{e.movie.media === "book" ? "Reading." : "Watching."} Done with it?</p>
                  <CheckInAnswers media={e.movie.media} seriesId={e.movie.id} showStillWatching={false} />
                </div>
              ) : (
                <p className="text-sm text-muted">
                  {e.dropped
                    ? e.movie.media === "book"
                      ? "You gave up on this one."
                      : "You dropped this one."
                    : `Off your ${e.movie.media === "book" ? "Reading" : "Watching"} list.`}
                </p>
              )
            ) : e.followUp === "later" ? (
              <WatchedNow movie={e.movie} />
            ) : e.followUp ? (
              <p className="text-sm text-muted">You skipped this one.</p>
            ) : (
              <div className="flex flex-col items-center gap-2">
                <p className="text-sm font-semibold">Did you watch it?</p>
                <WatchAnswer sessionId={e.sessionId} />
              </div>
            )}
            <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2">
              <WatchLinks movie={e.movie} />
              <DetailsButton card={e.movie} media={e.movie.media} id={e.movie.id} title={e.movie.title} className="text-sm font-semibold" />
            </div>
          </div>
        );
      })}
    />
  );
}

/** "Not watched yet": once you have, mark it here instead of hunting for it in Saved, then rate it. */
function WatchedNow({ movie }: { movie: LibraryMovie }) {
  const [step, setStep] = useState<"ask" | "rate" | "done">("ask");
  if (step === "rate")
    return <StarPrompt title={movie.title} onRate={(n) => void rateTitle(movie.media, movie.id, n).catch(() => undefined)} onDone={() => setStep("done")} />;
  if (step === "done") return <p className="text-sm font-semibold">Watched. It&apos;s in Seen &amp; read.</p>;
  return (
    <div className="flex flex-wrap items-center justify-center gap-3">
      <p className="text-sm text-muted">Not watched yet: it&apos;s in Saved.</p>
      <button
        type="button"
        onClick={() => {
          setStep("rate");
          void markSeen(movie.media, movie.id).catch(() => setStep("ask"));
        }}
        className={buttonClasses("outline", "sm")}
      >
        <Check className="size-3.5" aria-hidden /> Watched it
      </button>
    </div>
  );
}

function Stars({ media, id, stars, title }: { media: Media; id: number; stars: number | null; title: string }) {
  // Held here, not refreshed from the server, so rating never re-renders the list (and loses your place).
  const [shown, setShown] = useState(stars);
  const [, startTransition] = useTransition();

  function rate(value: number) {
    // Tapping the current rating clears it.
    const previous = shown;
    const next = value === shown ? null : value;
    setShown(next);
    startTransition(async () => {
      try {
        await rateTitle(media, id, next);
      } catch {
        setShown(previous);
      }
    });
  }

  return (
    <div className="flex flex-wrap items-center justify-center gap-x-3">
      <div role="group" aria-label={`Your rating for ${title}`} className="flex">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            onClick={() => rate(n)}
            aria-label={`${n} star${n > 1 ? "s" : ""}`}
            aria-pressed={shown !== null && n <= shown}
            className="-m-0.5 p-1.5"
          >
            <Star className={cn("size-6", shown !== null && n <= shown ? "fill-current" : "opacity-35")} aria-hidden />
          </button>
        ))}
      </div>
      <span className="text-sm text-muted">{shown === null ? (media === "movie" ? "Watched. Rate it?" : "Finished. Rate it?") : "Your rating"}</span>
    </div>
  );
}

/* --------------------------------------------------------------- watching */

export type WatchingEntry = { since: string; show: LibraryMovie };

const SHORT_DATE = new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", timeZone: "Asia/Kolkata" });

/**
 * Series or books you picked and are part-way through, as a thin shelf of
 * covers: tap one to check in (finished, dropped / gave up, or not started yet).
 */
export function WatchingShelf({ entries, media = "series" }: { entries: WatchingEntry[]; media?: "series" | "book" }) {
  const [open, setOpen] = useState<WatchingEntry | null>(null);
  const book = media === "book";
  return (
    <section aria-label={book ? "Reading" : "Watching"} className="flex flex-col gap-2">
      <p className="label text-muted">
        {book ? "Reading" : "Watching"} · {entries.length} · tap to check in
      </p>
      <ul className="flex gap-3 overflow-x-auto pb-1">
        {entries.map((e) => (
          <li key={e.show.id} className="w-16 shrink-0 sm:w-20">
            <button type="button" onClick={() => setOpen(e)} aria-label={`Check in: ${e.show.title}`} className="block w-full">
              <Poster title={e.show.title} path={e.show.posterPath} size="sm" sizes="80px" className="rounded-lg shadow-none" />
            </button>
          </li>
        ))}
      </ul>
      {open && (
        <Sheet title={open.show.title} onClose={() => setOpen(null)}>
          <p className="text-sm text-muted">
            {(book
              ? [open.show.book?.authors[0], `started ${SHORT_DATE.format(new Date(open.since))}`, open.show.book?.pages ? `${open.show.book.pages} pages` : null]
              : [`Started ${SHORT_DATE.format(new Date(open.since))}`, open.show.streamingOn[0], cardMeta(open.show).split(" · ").slice(2, 3)[0]]
            )
              .filter(Boolean)
              .join(" · ")}
          </p>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
            <WatchLinks movie={open.show} />
            <DetailsButton card={open.show} media={open.show.media} id={open.show.id} title={open.show.title} className="text-sm font-semibold" />
          </div>
          <CheckInAnswers media={media} seriesId={open.show.id} showStillWatching={false} />
          <p className="text-sm text-muted">
            Finished asks for stars, then it moves to History. {book ? "Gave up" : "Dropped"} counts like &ldquo;not for me&rdquo;. Not
            started yet puts it back among your saves.
          </p>
        </Sheet>
      )}
    </section>
  );
}

/* ------------------------------------------------------------ seen & read */

export type SeenEntry = { at: string; stars: number | null; movie: LibraryMovie };

/** Everything you've watched or read, newest first, each with your stars. */
export function SeenList({ entries, fetched, total }: { entries: SeenEntry[]; fetched: number; total: number }) {
  const more = useMore(entries, fetched, total, (offset) => moreSeen(offset).then((r) => ({ list: r.entries, fetched: r.fetched })));
  return (
    <CoverFlow
      label="Seen and read"
      total={more.total}
      onNearEnd={more.nearEnd}
      items={more.list.map((e) => ({ key: keyOf(e.movie), title: e.movie.title, image: e.movie.posterPath }))}
      infos={more.list.map((e) => (
        <div key={keyOf(e.movie)} className="flex flex-col items-center gap-1.5 text-center">
          <p className="label text-muted">
            {e.movie.media === "book" ? "Read" : "Seen"} · {DATE.format(new Date(e.at))}
          </p>
          <h2 className="text-2xl leading-tight font-black">{e.movie.title}</h2>
          <p className="text-sm text-muted">{meta(e.movie)}</p>
          <Stars media={e.movie.media} id={e.movie.id} stars={e.stars} title={e.movie.title} />
          <DetailsButton card={e.movie} media={e.movie.media} id={e.movie.id} title={e.movie.title} className="text-sm font-semibold" />
        </div>
      ))}
    />
  );
}

/* ------------------------------------------------------------ unavailable */

/** A title in your lists whose details couldn't be fetched just now. Only ids are stored, so there's no name to show. */
export type Unavailable = { media: Media; id: number; list: "saved" | "watching" | "reading" | "picked" | "seen"; at?: string };

const SOURCE: Record<Media, string> = { movie: "TMDb", series: "TMDb", book: "Open Library" };
const KIND: Record<Media, string> = { movie: "film", series: "series", book: "book" };
const LIST_WORD: Record<Unavailable["list"], string> = {
  saved: "A saved",
  watching: "A",
  reading: "A",
  picked: "A",
  seen: "A",
};
const AFTER: Record<Unavailable["list"], string> = {
  saved: "",
  watching: " you're watching",
  reading: " you're reading",
  picked: " you picked",
  seen: "",
};

/**
 * Titles whose details didn't load stay in the list as placeholders, so your
 * record never seems to vanish: say where it comes from and offer to try again.
 */
export function UnavailableList({ items }: { items: Unavailable[] }) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [gone, hide] = useOptimistic<string[], string>([], (keys, key) => [...keys, key]);
  const shown = items.filter((u) => !gone.includes(keyOf(u)));
  if (!shown.length) return null;
  return (
    <ul aria-label="Couldn't load" className="flex flex-col gap-3">
      {shown.map((u) => (
        <li
          key={`${u.list}:${keyOf(u)}`}
          className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-2xl px-4 py-3 shadow-[inset_0_0_0_1.5px_var(--line)]"
        >
          <p className="min-w-0 flex-1 text-sm">
            <span className="font-bold">
              {LIST_WORD[u.list]} {KIND[u.media]}
              {AFTER[u.list]}
              {u.at ? ` (${DATE.format(new Date(u.at))})` : ""}
            </span>{" "}
            <span className="text-muted">didn&apos;t load from {SOURCE[u.media]} just now. It&apos;s still in your lists.</span>
          </p>
          <div className="flex gap-3 text-sm font-semibold">
            <button type="button" onClick={() => router.refresh()} className="inline-flex items-center gap-1 underline-offset-4 hover:underline">
              <RotateCcw className="size-4" aria-hidden /> Try again
            </button>
            {u.list === "saved" && (
              <button
                type="button"
                onClick={() =>
                  startTransition(async () => {
                    hide(keyOf(u));
                    await removeSaved(u.media, u.id);
                  })
                }
                className="inline-flex items-center gap-1 text-muted underline-offset-4 hover:underline"
              >
                <X className="size-4" aria-hidden /> Remove
              </button>
            )}
          </div>
        </li>
      ))}
    </ul>
  );
}
