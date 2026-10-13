"use client";

import { useState, useTransition } from "react";
import { BookOpen, Check, Clapperboard } from "lucide-react";
import type { TitleLink } from "@/lib/adaptations/rules";
import { knowIt } from "@/app/(app)/[media]/actions";
import { cn } from "@/lib/cn";
import { Poster } from "./poster";

const stars = (rating: number | null) => (rating ? " · " + "★".repeat(Math.max(1, Math.round(rating / 2))) : "");

/** "You've read the book", "You've seen the film": the card's badge, when you know the story. */
export function knownLabel(link: TitleLink | null | undefined): string | null {
  if (!link?.known) return null;
  return link.media === "book" ? "You've read the book" : link.media === "movie" ? "You've seen the film" : "You've seen the series";
}

/** What the link is, from the card's side. */
export function linkHeading(link: TitleLink): string {
  return link.media === "book" ? "Based on the book" : link.media === "movie" ? "Also a film" : "Also a series";
}

/** A short chip for lists: "Also a book · David Grann", "Also a series · you've seen it". */
export function linkChip(link: TitleLink): string {
  const what = link.media === "book" ? "Also a book" : link.media === "movie" ? "Also a film" : "Also a series";
  if (link.known) return `${what} · you've ${link.media === "book" ? "read" : "seen"} it`;
  return link.by ? `${what} · ${link.by}` : what;
}

/** One line for History: "Book: read it, ★★★★" or "Based on Stieg Larsson's book". */
export function linkLine(link: TitleLink): string {
  if (link.media !== "book") return linkChip(link);
  if (link.known) return `Book: read it${link.rating ? `, ${"★".repeat(Math.max(1, Math.round(link.rating / 2)))}` : ""}`;
  return link.by ? `Based on ${link.by}'s book` : "Based on a book";
}

/** The strip under a card's badges: the linked title, and whether you know it. */
export function LinkStrip({ link, className }: { link: TitleLink; className?: string }) {
  const Icon = link.media === "book" ? BookOpen : Clapperboard;
  return (
    <div
      className={cn(
        "flex max-w-md items-center gap-3 rounded-2xl bg-soft px-3 py-2.5 shadow-[inset_0_0_0_1.5px_var(--line)]",
        className,
      )}
    >
      <div className="w-8 shrink-0">
        <Poster title={link.title} path={link.posterPath} size="sm" sizes="32px" className="rounded-[4px] shadow-none" />
      </div>
      <div className="flex min-w-0 flex-col">
        <span className="label inline-flex items-center gap-1.5 text-muted">
          <Icon className="size-3" aria-hidden /> {linkHeading(link)}
        </span>
        <span className="truncate text-sm font-bold">
          {link.title}
          {link.by || link.year ? <span className="font-normal"> · {[link.by, link.year].filter(Boolean).join(", ")}</span> : null}
        </span>
        {link.known && (
          <span className="text-xs font-semibold text-muted">
            {link.media === "book" ? "Read it" : "Seen it"}
            {stars(link.rating)}
          </span>
        )}
      </div>
    </div>
  );
}

/**
 * The pick screen's book panel: the book it's based on, and "I've read it"
 * when you haven't said so yet (it counts as a Read it swipe on the book).
 */
export function PickBookPanel({ link }: { link: TitleLink }) {
  const [known, setKnown] = useState(link.known);
  const [pending, start] = useTransition();
  return (
    <section aria-label={linkHeading(link)} className="flex max-w-md flex-col gap-3">
      <LinkStrip link={{ ...link, known }} />
      {link.media === "book" && !known && (
        <button
          type="button"
          disabled={pending}
          onClick={() =>
            start(async () => {
              setKnown(true);
              try {
                await knowIt("book", { id: link.id, language: link.language, genreIds: link.genreIds, tags: link.tags });
              } catch {
                setKnown(false);
              }
            })
          }
          className="inline-flex h-11 items-center justify-center gap-2 self-start rounded-full border-2 border-line px-5 text-sm font-bold hover:bg-soft disabled:opacity-60"
        >
          <Check className="size-4" aria-hidden /> I&apos;ve read it
        </button>
      )}
    </section>
  );
}
