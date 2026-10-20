"use client";

import { useEffect, useState } from "react";
import { Check, ExternalLink, Info, Play, Star, X } from "lucide-react";
import { titleDetails } from "@/app/(app)/library-actions";
import type { DeckCard } from "@/lib/deck/build-movies";
import type { Media } from "@/lib/picks/server";
import { airingLabel, bestsellerLabel, cardMeta, makersLabel, ratingCountLabel, ratingScale, readLine, startLine } from "@/lib/card-meta";
import { whereTo } from "@/lib/watch";
import { buttonClasses } from "@/components/ui/button";
import { PeopleLine } from "@/components/people/people-line";
import { LinkStrip } from "@/components/pick/title-link";
import { Poster } from "@/components/pick/poster";
import { cn } from "@/lib/cn";

/**
 * "Details": everything about one title in a sheet, from any list: full
 * synopsis, length, rating and its scale, people, the linked book or film,
 * where to watch or get it. Lists pass the card they already have; person
 * pages only know the id, so the sheet fetches it.
 */
export function DetailsButton({
  card,
  media,
  id,
  title,
  className,
  children,
}: {
  card?: DeckCard;
  media: Media;
  id: number;
  title: string;
  className?: string;
  /** What the button shows; defaults to "Details". */
  children?: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={children ? undefined : `Details: ${title}`}
        className={cn(!children && "inline-flex items-center gap-1", "underline-offset-4 hover:underline", className)}
      >
        {children ?? (
          <>
            <Info className="size-4" aria-hidden /> Details
          </>
        )}
      </button>
      {open && <TitleSheet initial={card ?? null} media={media} id={id} title={title} onClose={() => setOpen(false)} />}
    </>
  );
}

function TitleSheet({
  initial,
  media,
  id,
  title,
  onClose,
}: {
  initial: DeckCard | null;
  media: Media;
  id: number;
  title: string;
  onClose: () => void;
}) {
  const [card, setCard] = useState<DeckCard | null>(initial);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (initial) return;
    let live = true;
    titleDetails(media, id)
      .then((found) => {
        if (!live) return;
        if (found) setCard(found);
        else setFailed(true);
      })
      .catch(() => live && setFailed(true));
    return () => {
      live = false;
    };
  }, [initial, media, id]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={title}
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center"
      onClick={onClose}
    >
      <div
        className="flex max-h-[88dvh] w-full max-w-2xl flex-col gap-5 overflow-y-auto rounded-t-3xl bg-raised p-6 text-fg shadow-xl sm:rounded-3xl sm:p-8"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4">
          <p className="label text-muted">{media === "book" ? "Book" : media === "series" ? "Series" : "Film"}</p>
          <button type="button" onClick={onClose} aria-label="Close" className="-m-2 p-2">
            <X className="size-5" aria-hidden />
          </button>
        </div>
        {card ? (
          <Details card={card} />
        ) : failed ? (
          <p className="text-muted">
            {title} didn&apos;t load from {media === "book" ? "Open Library" : "TMDb"} just now. Try again in a moment.
          </p>
        ) : (
          <p className="text-muted" role="status">
            Loading {title}…
          </p>
        )}
      </div>
    </div>
  );
}

function Details({ card }: { card: DeckCard }) {
  const where = whereTo(card);
  const start = startLine(card);
  const read = readLine(card);
  const airing = airingLabel(card);
  const bestseller = bestsellerLabel(card);
  const topics = card.book ? card.book.subjects.slice(0, 6) : card.genres;
  return (
    <div className="flex flex-col gap-5">
      <div className="grid grid-cols-[96px_minmax(0,1fr)] gap-4 sm:grid-cols-[128px_minmax(0,1fr)] sm:gap-6">
        <Poster title={card.title} path={card.posterPath} size="md" sizes="128px" className="rounded-xl" />
        <div className="flex min-w-0 flex-col gap-2">
          <p className="label text-muted">{cardMeta(card)}</p>
          <h2 className="text-2xl leading-tight font-black sm:text-3xl">{card.title}</h2>
          {!card.book && card.originalTitle !== card.title && <p className="text-sm text-muted">{card.originalTitle}</p>}
          {card.book && makersLabel(card) && <p className="font-semibold">{makersLabel(card)}</p>}
          <div className="flex flex-wrap gap-2 text-[13px] font-semibold">
            <span className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 shadow-[inset_0_0_0_1.5px_var(--line)]">
              <Star className="size-3.5 fill-current" aria-hidden /> {card.rating.toFixed(1)}
              <span className="font-normal opacity-70">
                {ratingScale(card)} · {ratingCountLabel(card)}
              </span>
            </span>
            {bestseller && <span className="rounded-lg px-2.5 py-1 shadow-[inset_0_0_0_1.5px_var(--line)]">{bestseller}</span>}
            {card.streamingOn.map((s) => (
              <span key={s} className="inline-flex items-center gap-1.5 rounded-lg bg-accent px-2.5 py-1 text-on-accent">
                <Check className="size-3.5" aria-hidden /> On {s}
              </span>
            ))}
            {airing && <span className="rounded-lg px-2.5 py-1 shadow-[inset_0_0_0_1.5px_var(--line)]">{airing}</span>}
          </div>
        </div>
      </div>

      {topics.length > 0 && <p className="text-sm text-muted">{topics.join(" · ")}</p>}
      {card.overview ? (
        <p className="leading-relaxed whitespace-pre-line">{card.overview}</p>
      ) : (
        <p className="text-muted">No synopsis in the catalogue.</p>
      )}
      {(start || read) && (
        <div className="flex flex-col gap-0.5 rounded-2xl bg-soft px-4 py-3">
          <span className="font-bold">{start ? "Start with Season 1" : read}</span>
          {start && <span className="text-sm text-muted">{start}</span>}
        </div>
      )}
      {card.people.length > 0 && <PeopleLine people={card.people} followedName={card.followedName} />}
      {card.link && <LinkStrip link={card.link} />}

      <div className="flex flex-wrap gap-2">
        <a href={where.href} target="_blank" rel="noreferrer noopener" className={buttonClasses("solid", "md")}>
          {where.label} <ExternalLink className="size-4" aria-hidden />
        </a>
        {card.trailerKey && (
          <a
            href={`https://www.youtube.com/watch?v=${card.trailerKey}`}
            target="_blank"
            rel="noreferrer noopener"
            className={buttonClasses("outline", "md")}
          >
            <Play className="size-4 fill-current" aria-hidden /> Trailer
          </a>
        )}
      </div>
      <p className="text-xs text-muted">
        {card.book
          ? "Book data and ratings from Open Library; bestseller weeks from the New York Times lists."
          : "Data and ratings from TMDb; streaming from JustWatch, via TMDb."}
      </p>
    </div>
  );
}
