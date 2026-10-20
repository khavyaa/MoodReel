"use client";

import { Check, ExternalLink, Play, Star } from "lucide-react";
import { motion, useReducedMotion } from "motion/react";
import type { DeckCard } from "@/lib/deck/build-movies";
import { MOODS, type MoodId } from "@/lib/moods";
import { bestsellerLabel, cardMeta, makersLabel, ratingScale, readLine, startLine } from "@/lib/card-meta";
import { whereTo } from "@/lib/watch";
import { buttonClasses } from "@/components/ui/button";
import { Poster } from "./poster";
import { LinkStrip, PickBookPanel } from "./title-link";
import { DetailsButton } from "@/components/library/title-details";

export function PickScreen({
  pick,
  mood,
  why,
  resultLabel = "Tonight's pick",
  savedForLater,
  recorded = true,
  saveFailed = false,
  onAgain,
}: {
  pick: DeckCard;
  mood: MoodId;
  why: string | null;
  resultLabel?: string;
  savedForLater: DeckCard[];
  /** The pick is saved: on your History, off your Saved list. */
  recorded?: boolean;
  /** Saving it failed; the bar at the top offers Retry. */
  saveFailed?: boolean;
  onAgain: () => void;
}) {
  const reduced = useReducedMotion() ?? false;
  const start = startLine(pick);
  const read = readLine(pick);
  const where = whereTo(pick);
  const by = pick.book ? makersLabel(pick) : null;
  const bestseller = bestsellerLabel(pick);
  return (
    <div className="grid flex-1 items-center gap-5 lg:grid-cols-[minmax(260px,380px)_minmax(0,1fr)] lg:gap-16">
      <motion.div
        className="mx-auto w-[min(40vw,200px)] lg:w-full"
        initial={reduced ? false : { scale: 0.92, opacity: 0.6 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: "spring", stiffness: 220, damping: 18 }}
      >
        <Poster title={pick.title} path={pick.posterPath} size="xl" sizes="(min-width: 1024px) 380px, 40vw" priority />
      </motion.div>

      <div className="flex min-w-0 flex-col gap-4 lg:gap-5">
        <p className="label flex items-center gap-1.5 text-muted">
          {`${resultLabel} ·`}
          {/* The page now wears the poster's colour; the mood keeps its dot. */}
          <span aria-hidden className="size-2.5 rounded-full shadow-[0_0_0_1.5px_var(--line)]" style={{ background: MOODS[mood].color }} />{" "}
          {MOODS[mood].label}
        </p>
        <h1 className="display text-[clamp(3rem,8vw,7.5rem)]">{pick.title}</h1>
        {by && <p className="-mt-1 text-lg font-bold">{by}</p>}
        <p className="max-w-[40ch] text-xl leading-snug lg:text-2xl" aria-live="polite">
          {why ?? (saveFailed ? "Not saved yet. Retry at the top, and the reason comes with it." : "Working out why…")}
        </p>
        <p className="label text-muted">{cardMeta(pick)}</p>
        {read && (
          <div className="flex max-w-md flex-col gap-0.5 rounded-2xl bg-soft px-4 py-3">
            <span className="font-bold">{read}</span>
            {pick.genres.length > 0 && <span className="text-sm text-muted">{pick.genres.slice(0, 3).join(" · ")}</span>}
          </div>
        )}
        {start && (
          <div className="flex max-w-md flex-col gap-0.5 rounded-2xl bg-soft px-4 py-3">
            <span className="font-bold">Start with Season 1</span>
            <span className="text-sm text-muted">{start}</span>
          </div>
        )}

        <div className="flex flex-wrap gap-2 text-[13px] font-semibold">
          <span className="inline-flex items-center gap-1.5 rounded-lg bg-soft px-2.5 py-1 shadow-[inset_0_0_0_1.5px_var(--line)]">
            <Star className="size-3.5 fill-current" aria-hidden /> {pick.rating.toFixed(1)}
            <span className="font-normal opacity-70">{ratingScale(pick)}</span>
          </span>
          {bestseller && (
            <span className="inline-flex items-center rounded-lg bg-accent px-2.5 py-1 text-on-accent">{bestseller}</span>
          )}
          {pick.streamingOn.map((s) => (
            <span key={s} className="inline-flex items-center gap-1.5 rounded-lg bg-accent px-2.5 py-1 text-on-accent">
              <Check className="size-3.5" aria-hidden /> On {s}
            </span>
          ))}
        </div>

        {pick.link && (pick.link.media === "book" ? <PickBookPanel link={pick.link} /> : <LinkStrip link={pick.link} />)}

        <div className="flex flex-wrap gap-3 pt-2">
          <a href={where.href} target="_blank" rel="noreferrer noopener" className={buttonClasses("solid", "lg")}>
            {where.label} <ExternalLink className="size-4" aria-hidden />
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
          <DetailsButton card={pick} media={pick.media} id={pick.id} title={pick.title} className={buttonClasses("outline", "lg")}>
            More details
          </DetailsButton>
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
        <p role="status" className="inline-flex items-center gap-1.5 text-sm font-semibold">
          {recorded ? (
            <>
              <Check className="size-4" aria-hidden /> Saved to your History
            </>
          ) : saveFailed ? (
            "Not saved yet"
          ) : (
            "Saving your pick…"
          )}
        </p>
        {recorded && pick.media === "series" && (
          <p className="text-sm">It&apos;s on your Watching list. Every few days MoodReel asks how it&apos;s going.</p>
        )}
        {recorded && pick.media === "book" && (
          <p className="text-sm">It&apos;s on your Reading list. About once a week MoodReel asks how it&apos;s going.</p>
        )}
        <p className="text-xs text-muted">
          {pick.media === "book"
            ? "Book data and ratings from Open Library; bestseller weeks from the New York Times lists."
            : "Streaming badges from JustWatch, via TMDb."}
        </p>
      </div>
    </div>
  );
}
