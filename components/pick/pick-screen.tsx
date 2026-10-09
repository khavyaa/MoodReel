"use client";

import { Check, ExternalLink, Play, Star } from "lucide-react";
import type { DeckCard } from "@/lib/deck/build-movies";
import { MOODS, type MoodId } from "@/lib/moods";
import { formatRuntime } from "@/lib/picks/why";
import { watchSearchUrl } from "@/lib/watch";
import { buttonClasses } from "@/components/ui/button";
import { Poster } from "./poster";

export function PickScreen({
  pick,
  mood,
  why,
  savedForLater,
  onAgain,
}: {
  pick: DeckCard;
  mood: MoodId;
  why: string | null;
  savedForLater: DeckCard[];
  onAgain: () => void;
}) {
  const runtime = formatRuntime(pick.runtime);
  return (
    <div className="grid flex-1 items-center gap-5 lg:grid-cols-[minmax(260px,380px)_minmax(0,1fr)] lg:gap-16">
      <div className="mx-auto w-[min(40vw,200px)] lg:w-full">
        <Poster title={pick.title} path={pick.posterPath} size="xl" sizes="(min-width: 1024px) 380px, 40vw" priority />
      </div>

      <div className="flex min-w-0 flex-col gap-4 lg:gap-5">
        <p className="label text-muted">Tonight&apos;s pick · {MOODS[mood].label}</p>
        <h1 className="display text-[clamp(3rem,8vw,7.5rem)]">{pick.title}</h1>
        <p className="max-w-[40ch] text-xl leading-snug lg:text-2xl" aria-live="polite">
          {why ?? "Working out why…"}
        </p>
        <p className="label text-muted">{[pick.year, pick.languageLabel, runtime].filter(Boolean).join(" · ")}</p>

        <div className="flex flex-wrap gap-2 text-[13px] font-semibold">
          <span className="inline-flex items-center gap-1.5 rounded-lg bg-soft px-2.5 py-1 shadow-[inset_0_0_0_1.5px_var(--line)]">
            <Star className="size-3.5 fill-current" aria-hidden /> {pick.rating.toFixed(1)}
          </span>
          {pick.streamingOn.map((s) => (
            <span key={s} className="inline-flex items-center gap-1.5 rounded-lg bg-accent px-2.5 py-1 text-on-accent">
              <Check className="size-3.5" aria-hidden /> On {s}
            </span>
          ))}
        </div>

        <div className="flex flex-wrap gap-3 pt-2">
          <a href={watchSearchUrl(pick.title, pick.year)} target="_blank" rel="noreferrer noopener" className={buttonClasses("solid", "lg")}>
            Where to watch <ExternalLink className="size-4" aria-hidden />
          </a>
          {pick.trailerKey && (
            <a
              href={`https://www.youtube.com/watch?v=${pick.trailerKey}`}
              target="_blank"
              rel="noreferrer noopener"
              className={buttonClasses("outline", "lg")}
            >
              <Play className="size-4 fill-current" aria-hidden /> Trailer
            </a>
          )}
          <button type="button" onClick={onAgain} className={buttonClasses("ghost", "lg")}>
            Start again
          </button>
        </div>

        {savedForLater.length > 0 && (
          <div className="flex flex-col gap-2 border-t border-line pt-5">
            <p className="text-sm font-semibold">Also saved for another night</p>
            <ul className="flex gap-2">
              {savedForLater.map((c) => (
                <li key={c.id} className="w-12" title={c.title}>
                  <Poster title={c.title} path={c.posterPath} size="sm" sizes="48px" className="rounded-lg shadow-none" />
                </li>
              ))}
            </ul>
          </div>
        )}
        <p className="text-xs text-muted">Streaming badges from JustWatch, via TMDb.</p>
      </div>
    </div>
  );
}
