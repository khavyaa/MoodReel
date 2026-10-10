"use client";

import { useOptimistic, useTransition } from "react";
import { Check, ExternalLink, Play, Star, X } from "lucide-react";
import { markSeen, rateMovie, removeSaved } from "@/app/(app)/library-actions";
import type { LibraryMovie } from "@/lib/library";
import { MOODS, type MoodId } from "@/lib/moods";
import { formatRuntime } from "@/lib/picks/why";
import { watchSearchUrl } from "@/lib/watch";
import { buttonClasses } from "@/components/ui/button";
import { cn } from "@/lib/cn";
import { Poster } from "@/components/pick/poster";
import type { FollowUpAnswer } from "@/lib/picks/server";
import { WatchAnswer } from "./watch-prompt";

// You're in India; dates read the same on the server (UTC) and in the browser.
const DATE = new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Kolkata" });

function meta(m: LibraryMovie) {
  return [m.year, m.languageLabel, formatRuntime(m.runtime)].filter(Boolean).join(" · ");
}

function WatchLinks({ movie }: { movie: LibraryMovie }) {
  return (
    <div className="flex flex-wrap gap-2">
      <a
        href={watchSearchUrl(movie.title, movie.year)}
        target="_blank"
        rel="noreferrer noopener"
        className={buttonClasses("solid", "sm")}
      >
        Where to watch <ExternalLink className="size-3.5" aria-hidden />
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

export function SavedList({ movies }: { movies: LibraryMovie[] }) {
  const [, startTransition] = useTransition();
  const [gone, hide] = useOptimistic<number[], number>([], (ids, id) => [...ids, id]);

  function act(id: number, action: (id: number) => Promise<void>) {
    startTransition(async () => {
      hide(id);
      await action(id);
    });
  }

  const shown = movies.filter((m) => !gone.includes(m.id));
  if (shown.length === 0) return <p className="text-lg text-muted">All cleared.</p>;

  return (
    <ul className="grid gap-x-10 gap-y-8 md:grid-cols-2 2xl:grid-cols-3">
      {shown.map((m) => (
        <li key={m.id} className="grid grid-cols-[96px_minmax(0,1fr)] gap-4 sm:grid-cols-[120px_minmax(0,1fr)]">
          <Poster title={m.title} path={m.posterPath} size="md" sizes="120px" className="rounded-xl" />
          <div className="flex min-w-0 flex-col gap-2">
            <p className="label text-muted">{meta(m)}</p>
            <h2 className="text-xl leading-tight font-black sm:text-2xl">{m.title}</h2>
            <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
              <span className="inline-flex items-center gap-1 font-semibold">
                <Star className="size-3.5 fill-current" aria-hidden /> {m.rating.toFixed(1)}
              </span>
              {m.streamingOn.map((s) => (
                <span key={s} className="rounded-md bg-accent px-1.5 py-0.5 text-xs font-bold text-on-accent">
                  {s}
                </span>
              ))}
            </p>
            {m.overview && <p className="line-clamp-2 text-sm text-muted">{m.overview}</p>}
            <WatchLinks movie={m} />
            <div className="flex flex-wrap gap-x-4 gap-y-1 pt-1 text-sm font-semibold">
              <button type="button" onClick={() => act(m.id, markSeen)} className="inline-flex items-center gap-1 underline-offset-4 hover:underline">
                <Check className="size-4" aria-hidden /> Seen it
              </button>
              <button type="button" onClick={() => act(m.id, removeSaved)} className="inline-flex items-center gap-1 text-muted underline-offset-4 hover:underline">
                <X className="size-4" aria-hidden /> Remove
              </button>
            </div>
          </div>
        </li>
      ))}
    </ul>
  );
}

/* ---------------------------------------------------------------- history */

export type HistoryEntry = {
  sessionId: string;
  mood: string;
  why: string | null;
  pickedAt: string | null;
  seen: boolean;
  followUp: FollowUpAnswer | null;
  /** 1–5 stars, or null when not rated yet. */
  stars: number | null;
  movie: LibraryMovie;
};

export function HistoryList({ entries }: { entries: HistoryEntry[] }) {
  return (
    <ol className="flex flex-col divide-y divide-line">
      {entries.map((e) => {
        const mood = MOODS[e.mood as MoodId];
        return (
          <li key={e.sessionId} className="grid grid-cols-[80px_minmax(0,1fr)] gap-4 py-6 first:pt-0 sm:grid-cols-[110px_minmax(0,1fr)] sm:gap-6">
            <Poster title={e.movie.title} path={e.movie.posterPath} size="md" sizes="110px" className="rounded-xl" />
            <div className="flex min-w-0 flex-col gap-2">
              <p className="label flex flex-wrap items-center gap-x-2 text-muted">
                {e.pickedAt && <span>{DATE.format(new Date(e.pickedAt))}</span>}
                {mood && (
                  <span className="inline-flex items-center gap-1.5">
                    <span className="size-2.5 rounded-full" style={{ background: mood.color }} aria-hidden />
                    {mood.label}
                  </span>
                )}
              </p>
              <h2 className="text-xl leading-tight font-black sm:text-2xl">{e.movie.title}</h2>
              <p className="text-sm text-muted">{meta(e.movie)}</p>
              {e.why && <p className="max-w-[60ch] leading-snug">{e.why}</p>}
              {e.seen ? (
                <Stars movieId={e.movie.id} stars={e.stars} title={e.movie.title} />
              ) : e.followUp ? (
                <p className="text-sm text-muted">{e.followUp === "later" ? "Not watched yet: it's in Saved." : "You skipped this one."}</p>
              ) : (
                <div className="flex flex-col gap-2">
                  <p className="text-sm font-semibold">Did you watch it?</p>
                  <WatchAnswer sessionId={e.sessionId} />
                </div>
              )}
              <WatchLinks movie={e.movie} />
            </div>
          </li>
        );
      })}
    </ol>
  );
}

function Stars({ movieId, stars, title }: { movieId: number; stars: number | null; title: string }) {
  const [, startTransition] = useTransition();
  const [shown, setShown] = useOptimistic(stars);

  function rate(value: number) {
    // Tapping the current rating clears it.
    const next = value === shown ? null : value;
    startTransition(async () => {
      setShown(next);
      await rateMovie(movieId, next);
    });
  }

  return (
    <div className="flex items-center gap-3">
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
      <span className="text-sm text-muted">{shown === null ? "Watched. Rate it?" : "Your rating"}</span>
    </div>
  );
}
