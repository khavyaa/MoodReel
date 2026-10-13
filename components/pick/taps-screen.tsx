"use client";

import { ArrowRight } from "lucide-react";
import { ENERGY, MEDIA, MOODS, type MoodId } from "@/lib/moods";
import { DECK_SIZE } from "@/lib/deck/compose";
import { cn } from "@/lib/cn";
import { SomeoneInMind, type ChosenPerson } from "@/components/people/someone-in-mind";

export type TapsValue = { mood: MoodId; energy: 0 | 1 | 2; time: 0 | 1 | 2 };

const MOOD_LINES: Record<MoodId, string> = {
  gripping: "Thrillers, crime and mysteries that don't let go.",
  dark: "Heavy, morally messy, nothing tied up neatly.",
  mind: "Twists, loops and endings you'll argue about.",
  funny: "Proper comedies for grown-ups. No kids' films.",
  feelgood: "Warm films that leave you lighter.",
  moving: "Dramas that land somewhere real.",
  romantic: "Love stories, slow burns and grand gestures.",
};

export function Chip({
  pressed,
  onClick,
  children,
}: {
  pressed: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      onClick={onClick}
      className={cn(
        "inline-flex h-11 items-center gap-2 rounded-full border-2 px-4 text-[15px] font-semibold transition-colors sm:px-5",
        pressed ? "border-accent bg-accent text-on-accent" : "border-line hover:bg-soft",
      )}
    >
      {children}
    </button>
  );
}

const SERIES_LINES: Partial<Record<MoodId, string>> = {
  gripping: "Crime, mysteries and thrillers you'll want the next episode of.",
  dark: "Heavy, morally messy shows that don't look away.",
  mind: "Time loops, other worlds and stories that mess with you.",
  funny: "Comedies for grown-ups. No kids' shows, no laugh-track filler.",
  feelgood: "Warm shows to settle into: family, friendship, gentle laughs.",
  moving: "Dramas and documentaries that land somewhere real.",
};

const BOOK_LINES: Partial<Record<MoodId, string>> = {
  gripping: "Thrillers, crime and mysteries you'll read in one go.",
  dark: "Psychological, unsettling, or bleak in the best way.",
  mind: "Science fiction and speculative stories that bend your head.",
  funny: "Books that make you laugh out loud. Satire, wit, comic novels.",
  feelgood: "Warm stories about people being good to each other.",
  moving: "Literary fiction, memoirs and lives that stay with you.",
};

export function TapsScreen({
  media: kind,
  value,
  onChange,
  onDeal,
  person = null,
  onPerson,
}: {
  media: "movie" | "series" | "book";
  value: TapsValue;
  onChange: (next: TapsValue) => void;
  onDeal: () => void;
  person?: ChosenPerson | null;
  onPerson?: (next: ChosenPerson | null) => void;
}) {
  const media = MEDIA[kind === "movie" ? "movies" : kind === "series" ? "series" : "books"];
  const series = kind === "series";
  const book = kind === "book";
  const timeLabel = series ? "Commitment" : book ? "Length" : "Time";
  return (
    <div className="grid flex-1 gap-10 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)] lg:gap-16">
      <div className="flex flex-col gap-7">
        <h1 className="display text-[clamp(3.25rem,8.5vw,7.5rem)]">{media.ask}</h1>

        {onPerson && <SomeoneInMind media={kind} value={person} onChange={onPerson} />}

        <fieldset className="flex flex-col gap-3">
          <legend className="label mb-3 text-muted">Mood</legend>
          <div className="flex flex-wrap gap-2">
            {media.moods.map((id) => (
              <Chip key={id} pressed={value.mood === id} onClick={() => onChange({ ...value, mood: id })}>
                <span
                  aria-hidden
                  className="size-3.5 rounded-full shadow-[0_0_0_2px_color-mix(in_srgb,currentColor_35%,transparent)]"
                  style={{ background: MOODS[id].color }}
                />
                {MOODS[id].label}
              </Chip>
            ))}
          </div>
        </fieldset>

        <fieldset className="flex flex-col gap-3">
          <legend className="label mb-3 text-muted">Energy</legend>
          <div className="flex flex-wrap gap-2">
            {ENERGY.map((label, n) => (
              <Chip
                key={label}
                pressed={value.energy === n}
                onClick={() => onChange({ ...value, energy: n as TapsValue["energy"] })}
              >
                {label}
              </Chip>
            ))}
          </div>
        </fieldset>

        <fieldset className="flex flex-col gap-3">
          <legend className="label mb-3 text-muted">{timeLabel}</legend>
          <div className="flex flex-wrap gap-2">
            {media.time.map((label, n) => (
              <Chip key={label} pressed={value.time === n} onClick={() => onChange({ ...value, time: n as TapsValue["time"] })}>
                {label}
              </Chip>
            ))}
          </div>
        </fieldset>

        <button
          type="button"
          onClick={onDeal}
          className="mt-2 inline-flex h-14 w-full items-center justify-center gap-3 rounded-full bg-accent px-8 text-lg font-bold text-on-accent transition-opacity hover:opacity-90 sm:w-auto sm:self-start"
        >
          {person ? `Deal from ${person.name}` : `Deal ${DECK_SIZE} ${series ? "series" : book ? "books" : "films"}`}
          <ArrowRight className="size-5" aria-hidden />
        </button>
      </div>

      {/* Laptop only: a big read-back of what you're asking for. */}
      <aside className="hidden flex-col justify-between rounded-3xl bg-soft p-8 lg:flex">
        <div className="flex flex-col gap-3">
          <span className="label text-muted">Tonight feels</span>
          <p className="display text-[clamp(4rem,7vw,7.5rem)]">{MOODS[value.mood].label}</p>
          <p className="max-w-[34ch] text-lg">
            {(series && SERIES_LINES[value.mood]) || (book && BOOK_LINES[value.mood]) || MOOD_LINES[value.mood]}
          </p>
        </div>
        <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 text-sm">
          <dt className="label pt-0.5 text-muted">Energy</dt>
          <dd>{ENERGY[value.energy]}</dd>
          <dt className="label pt-0.5 text-muted">{timeLabel}</dt>
          <dd>{media.time[value.time]}</dd>
          <dt className="label pt-0.5 text-muted">Deck</dt>
          <dd>
            {book ? (
              <>
                {DECK_SIZE} books in English. No children&apos;s or young adult, romance, self-help or comics. Mostly
                the last 30 years, with the odd classic.
              </>
            ) : series ? (
              <>
                {DECK_SIZE} series, about three in four English, the rest Hindi when it&apos;s well rated. No soaps,
                reality, talk or animation. What&apos;s on your services comes first.
              </>
            ) : (
              <>
                {DECK_SIZE} films, mostly English. Tamil, Malayalam and Hindi when they&apos;re crime, thriller or
                acclaimed. What&apos;s on your services comes first.
              </>
            )}
          </dd>
        </dl>
      </aside>
    </div>
  );
}
