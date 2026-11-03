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
  adaptations = false,
  onAdaptations,
  listName = null,
  onClearList,
}: {
  media: "movie" | "series" | "book";
  value: TapsValue;
  onChange: (next: TapsValue) => void;
  onDeal: () => void;
  person?: ChosenPerson | null;
  onPerson?: (next: ChosenPerson | null) => void;
  /** "Adaptations only": films and series only. */
  adaptations?: boolean;
  onAdaptations?: (next: boolean) => void;
  /** Dealing from a list (a list page's "Deal from this list"), and how to stop. */
  listName?: string | null;
  onClearList?: () => void;
}) {
  const media = MEDIA[kind === "movie" ? "movies" : kind === "series" ? "series" : "books"];
  const series = kind === "series";
  const book = kind === "book";
  const timeLabel = series ? "Commitment" : book ? "Length" : "Time";
  const dealButton = (
    <button
      type="button"
      onClick={onDeal}
      className="inline-flex h-14 w-full items-center justify-center gap-3 rounded-full bg-accent px-8 text-lg font-bold text-on-accent transition-opacity hover:opacity-90"
    >
      {person
        ? `Deal from ${person.name}`
        : listName
          ? `Deal from ${listName}`
          : adaptations && !book
            ? `Deal ${DECK_SIZE} adaptations`
            : `Deal ${DECK_SIZE} ${series ? "series" : book ? "books" : "films"}`}
      <ArrowRight className="size-5" aria-hidden />
    </button>
  );

  return (
    <div className="grid flex-1 grid-cols-1 gap-10 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)] lg:gap-16">
      <div className="flex flex-col gap-7">
        <h1 className="display text-[clamp(2.75rem,min(8.5vw,10dvh),7.5rem)]">{media.ask}</h1>

        {listName ? (
          <p className="flex flex-wrap items-center gap-2 text-sm">
            <span className="label text-muted">From the list</span>
            <span className="rounded-full bg-soft px-3 py-1 font-bold shadow-[inset_0_0_0_1.5px_var(--line)]">{listName}</span>
            {onClearList && (
              <button type="button" onClick={onClearList} className="font-semibold text-muted underline-offset-4 hover:underline">
                Deal without it
              </button>
            )}
          </p>
        ) : (
          onPerson && <SomeoneInMind media={kind} value={person} onChange={onPerson} />
        )}

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

        {onAdaptations && !book && !person && !listName && (
          <AdaptationsSwitch on={adaptations} onChange={onAdaptations} noun={series ? "Series" : "Films"} />
        )}

        {/* Phone: Deal stays in reach at the bottom, above the tab bar. On a laptop it lives in the panel. */}
        <div className="sticky bottom-[calc(4.75rem+env(safe-area-inset-bottom))] z-30 -mx-5 bg-[linear-gradient(transparent,var(--surface)_40%)] px-5 pt-6 pb-2 sm:-mx-8 sm:px-8 lg:hidden">
          {dealButton}
        </div>
      </div>

      {/* Laptop only: a read-back of what you're asking for, and Deal, held in view beside the choices. */}
      <aside className="sticky top-8 hidden max-h-[calc(100dvh-8rem)] flex-col gap-6 self-start overflow-hidden rounded-3xl bg-soft p-8 lg:flex">
        <div className="flex flex-col gap-3">
          <span className="label text-muted">{book ? "Your next read feels" : "Tonight feels"}</span>
          <p className="display text-[clamp(3rem,min(7vw,11dvh),7.5rem)]">{MOODS[value.mood].label}</p>
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
            {person ? (
              <>Only {person.name}&apos;s work you haven&apos;t seen, saved or turned down, for this mood and time.</>
            ) : listName ? (
              <>Only titles on {listName} you haven&apos;t seen, saved or turned down, for this mood and time.</>
            ) : book ? (
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
        {dealButton}
      </aside>
    </div>
  );
}

/** "Adaptations only": a deck of films or series based on books, the ones from books you've read first. */
function AdaptationsSwitch({ on, onChange, noun }: { on: boolean; onChange: (next: boolean) => void; noun: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      onClick={() => onChange(!on)}
      className={cn(
        "flex items-center gap-4 rounded-2xl border-2 px-4 py-3 text-left transition-colors sm:max-w-md",
        on ? "border-fg" : "border-line hover:bg-soft",
      )}
    >
      <span className="flex flex-1 flex-col gap-0.5">
        <span className="font-bold">Adaptations only</span>
        <span className="text-sm text-muted">{noun} based on a book. Ones you&apos;ve read come first.</span>
      </span>
      <span
        aria-hidden
        className={cn(
          "relative h-7 w-12 shrink-0 rounded-full transition-colors",
          on ? "bg-fg" : "shadow-[inset_0_0_0_2px_var(--line)]",
        )}
      >
        <span className={cn("absolute top-1 size-5 rounded-full transition-[left]", on ? "left-6 bg-bg" : "left-1 bg-muted")} />
      </span>
    </button>
  );
}
