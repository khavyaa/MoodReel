"use client";

import { useState, useTransition } from "react";
import { Star } from "lucide-react";
import { answerCheckIn, answerWatched } from "@/app/(app)/library-actions";
import type { CheckInAnswer, FollowUpAnswer } from "@/lib/picks/server";
import { cn } from "@/lib/cn";

/**
 * "Did you watch it?" Yes asks for optional stars; Not yet puts it back on
 * your saved list; Skipped it just stops asking.
 */
export function WatchAnswer({
  sessionId,
  onDone,
  quiet = false,
}: {
  sessionId: string;
  onDone?: (answer: FollowUpAnswer) => void;
  /** Don't refresh the page after answering. */
  quiet?: boolean;
}) {
  const [rating, setRating] = useState(false);
  const [pending, startTransition] = useTransition();

  function answer(a: FollowUpAnswer, stars: number | null = null) {
    startTransition(async () => {
      await answerWatched(sessionId, a, stars, { refresh: !quiet });
      onDone?.(a);
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
              onClick={() => answer("watched", n)}
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
          onClick={() => answer("watched")}
          className="text-sm font-semibold underline underline-offset-4"
        >
          Skip rating
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-wrap gap-2">
      <AnswerButton onClick={() => setRating(true)} disabled={pending} primary>
        Yes, watched it
      </AnswerButton>
      <AnswerButton onClick={() => answer("later")} disabled={pending}>
        Not yet
      </AnswerButton>
      <AnswerButton onClick={() => answer("skipped")} disabled={pending}>
        Skipped it
      </AnswerButton>
    </div>
  );
}

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

/** The card on the start screen, asked once about your last pick. */
export function WatchPrompt({
  sessionId,
  title,
  posterUrl,
}: {
  sessionId: string;
  title: string;
  posterUrl: string | null;
}) {
  const [answered, setAnswered] = useState<FollowUpAnswer | null>(null);
  if (answered) {
    return (
      <p role="status" className="mb-6 rounded-2xl bg-soft px-4 py-3 text-sm font-semibold">
        {answered === "watched" ? "Noted. It's in your history." : answered === "later" ? `${title} is back in Saved.` : "Got it."}
      </p>
    );
  }
  return (
    <section
      aria-label="Your last pick"
      className="mb-8 flex items-center gap-4 rounded-3xl bg-soft p-4 sm:p-5"
    >
      {posterUrl && (
        // eslint-disable-next-line @next/next/no-img-element -- a 56px thumb straight from TMDb's CDN
        <img src={posterUrl} alt="" className="aspect-[2/3] w-14 shrink-0 rounded-lg object-cover" />
      )}
      <div className="flex min-w-0 flex-col gap-3">
        <p className="font-bold">
          Did you watch <span className="italic">{title}</span>?
        </p>
        <WatchAnswer sessionId={sessionId} onDone={setAnswered} quiet />
      </div>
    </section>
  );
}

/**
 * "Still watching?" for a series on your Watching list. Finished asks for
 * optional stars; dropped takes it off the list and counts like "not for me".
 */
export function CheckInAnswers({
  media = "series",
  seriesId,
  onDone,
  quiet = false,
  showStillWatching = true,
}: {
  media?: "series" | "book";
  seriesId: number;
  onDone?: (answer: CheckInAnswer) => void;
  quiet?: boolean;
  showStillWatching?: boolean;
}) {
  const [rating, setRating] = useState(false);
  const [pending, startTransition] = useTransition();

  function answer(a: CheckInAnswer, stars: number | null = null) {
    startTransition(async () => {
      await answerCheckIn(media, seriesId, a, stars, { refresh: !quiet });
      onDone?.(a);
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
      {showStillWatching && (
        <AnswerButton onClick={() => answer("watching")} disabled={pending} primary>
          {media === "book" ? "Still reading" : "Still watching"}
        </AnswerButton>
      )}
      <AnswerButton onClick={() => setRating(true)} disabled={pending}>
        Finished it
      </AnswerButton>
      <AnswerButton onClick={() => answer("dropped")} disabled={pending}>
        {media === "book" ? "Gave up" : "Dropped it"}
      </AnswerButton>
    </div>
  );
}

/** The card on the series or books start screen. */
export function CheckInPrompt({
  media = "series",
  seriesId,
  title,
  posterUrl,
}: {
  media?: "series" | "book";
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
          ? `Enjoy it. We'll ask again in ${book ? "a week" : "a few days"}.`
          : answered === "finished"
            ? `Nice. ${title} is in your history.`
            : `${book ? "Put down" : "Dropped"}. ${title} won't come back.`}
      </p>
    );
  }
  return (
    <section aria-label={book ? "A book you're reading" : "A show you're watching"} className="mb-8 flex items-center gap-4 rounded-3xl bg-soft p-4 sm:p-5">
      {posterUrl && (
        // eslint-disable-next-line @next/next/no-img-element -- a 56px thumb straight from TMDb's CDN
        <img src={posterUrl} alt="" className="aspect-[2/3] w-14 shrink-0 rounded-lg object-cover" />
      )}
      <div className="flex min-w-0 flex-col gap-3">
        <p className="font-bold">
          {book ? "Still reading" : "Still watching"} <span className="italic">{title}</span>?
        </p>
        <CheckInAnswers media={media} seriesId={seriesId} onDone={setAnswered} quiet />
      </div>
    </section>
  );
}
