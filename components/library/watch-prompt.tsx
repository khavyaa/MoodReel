"use client";

import { useState, useTransition } from "react";
import { Star } from "lucide-react";
import { useRouter } from "next/navigation";
import { answerCheckIn, undoLibrary } from "@/app/(app)/library-actions";
import { useToast } from "@/components/ui/toast";
import type { CheckInAnswer, Media } from "@/lib/picks/server";
import { cn } from "@/lib/cn";

function AnswerButton({
  children,
  onClick,
  disabled,
  primary,
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled: boolean;
  primary?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "inline-flex h-10 items-center rounded-full border-2 px-4 text-sm font-bold transition-colors disabled:opacity-60",
        primary ? "border-accent bg-accent text-on-accent" : "border-line hover:bg-soft",
      )}
    >
      {children}
    </button>
  );
}

/** The answers, in each kind's words. */
const WORDS: Record<Media, { list: string; still: string; finished: string; dropped: string; notStarted: string }> = {
  movie: { list: "Tonight", still: "Not yet", finished: "Watched it", dropped: "Didn't finish", notStarted: "Not tonight after all" },
  series: { list: "Watching", still: "Still watching", finished: "Finished it", dropped: "Dropped it", notStarted: "Not started yet" },
  book: { list: "Reading", still: "Still reading", finished: "Finished it", dropped: "Gave up", notStarted: "Not started yet" },
};

/**
 * "Still watching?" for a series on your Watching list (a book on Reading, a
 * film on Tonight). Finished asks for optional stars; dropped takes it off the
 * list and counts like "not for me".
 */
export function CheckInAnswers({
  media = "series",
  seriesId,
  title,
  since,
  onDone,
  quiet = false,
  showStillWatching = true,
}: {
  media?: Media;
  seriesId: number;
  /** For the Undo toast. */
  title?: string;
  /** When it went on Watching / Reading, so Undo puts it back from then. */
  since?: string | null;
  onDone?: (answer: CheckInAnswer) => void;
  quiet?: boolean;
  showStillWatching?: boolean;
}) {
  const [rating, setRating] = useState(false);
  const [pending, startTransition] = useTransition();
  const toast = useToast();
  const router = useRouter();
  const book = media === "book";
  const words = WORDS[media];

  function answer(a: CheckInAnswer, stars: number | null = null) {
    startTransition(async () => {
      await answerCheckIn(media, seriesId, a, stars, { refresh: !quiet });
      onDone?.(a);
      if (a === "watching") return;
      const name = title ?? (book ? "That book" : media === "movie" ? "That film" : "That series");
      toast({
        message:
          a === "finished"
            ? `${media === "movie" ? "Watched" : "Finished"}: ${name}`
            : a === "dropped"
              ? media === "movie"
                ? `Didn't finish ${name}`
                : `${book ? "Gave up on" : "Dropped"} ${name}`
              : `${name} is back in Saved`,
        undone: `${name} is back on your ${words.list} list`,
        undo: async () => {
          await undoLibrary({ media, id: seriesId, kind: a, watchingSince: since ?? new Date().toISOString() });
          router.refresh();
        },
      });
    });
  }

  if (rating) {
    return (
      <div className="flex flex-wrap items-center gap-3">
        <span className="text-sm font-semibold">How was it?</span>
        <div role="group" aria-label="Rate it" className="flex">
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              key={n}
              type="button"
              disabled={pending}
              onClick={() => answer("finished", n)}
              aria-label={`${n} star${n > 1 ? "s" : ""}`}
              className="group -m-0.5 p-1.5"
            >
              <Star className="size-6 opacity-40 group-hover:fill-current group-hover:opacity-100" aria-hidden />
            </button>
          ))}
        </div>
        <button
          type="button"
          disabled={pending}
          onClick={() => answer("finished")}
          className="text-sm font-semibold underline underline-offset-4"
        >
          Skip rating
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-wrap gap-2">
      {media === "movie" && (
        <AnswerButton onClick={() => setRating(true)} disabled={pending} primary>
          {words.finished}
        </AnswerButton>
      )}
      {showStillWatching && (
        <AnswerButton onClick={() => answer("watching")} disabled={pending} primary={media !== "movie"}>
          {words.still}
        </AnswerButton>
      )}
      {media !== "movie" && (
        <AnswerButton onClick={() => setRating(true)} disabled={pending}>
          {words.finished}
        </AnswerButton>
      )}
      <AnswerButton onClick={() => answer("dropped")} disabled={pending}>
        {words.dropped}
      </AnswerButton>
      <AnswerButton onClick={() => answer("not-started")} disabled={pending}>
        {words.notStarted}
      </AnswerButton>
    </div>
  );
}

/** The card on the start screen. */
export function CheckInPrompt({
  media = "series",
  seriesId,
  title,
  posterUrl,
}: {
  media?: Media;
  seriesId: number;
  title: string;
  posterUrl: string | null;
}) {
  const [answered, setAnswered] = useState<CheckInAnswer | null>(null);
  const book = media === "book";
  if (answered) {
    return (
      <p role="status" className="mb-6 rounded-2xl bg-soft px-4 py-3 text-sm font-semibold">
        {answered === "watching"
          ? media === "movie"
            ? "We'll ask again tomorrow."
            : `Enjoy it. We'll ask again in ${book ? "a week" : "a few days"}.`
          : answered === "finished"
            ? `Nice. ${title} is in your history.`
            : answered === "not-started"
              ? `${title} is back in Saved for another night.`
              : `${media === "movie" ? "Noted" : book ? "Put down" : "Dropped"}. ${title} won't come back.`}
      </p>
    );
  }
  return (
    <section
      aria-label={media === "movie" ? "Your last pick" : book ? "A book you're reading" : "A show you're watching"}
      className="mb-8 flex items-center gap-4 rounded-3xl bg-soft p-4 sm:p-5">
      {posterUrl && (
        // eslint-disable-next-line @next/next/no-img-element -- a 56px thumb straight from TMDb's CDN
        <img src={posterUrl} alt="" className="aspect-[2/3] w-14 shrink-0 rounded-lg object-cover" />
      )}
      <div className="flex min-w-0 flex-col gap-3">
        <p className="font-bold">
          {media === "movie" ? "Still on for" : book ? "Still reading" : "Still watching"} <span className="italic">{title}</span>?
        </p>
        <CheckInAnswers media={media} seriesId={seriesId} title={title} onDone={setAnswered} quiet />
      </div>
    </section>
  );
}
