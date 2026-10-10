"use client";

import { ArrowRight } from "lucide-react";
import { ENERGY, MEDIA, MOODS, type MoodId } from "@/lib/moods";
import { DECK_SIZE } from "@/lib/deck/compose";
import { cn } from "@/lib/cn";

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

export function TapsScreen({
  value,
  onChange,
  onDeal,
}: {
  value: TapsValue;
  onChange: (next: TapsValue) => void;
  onDeal: () => void;
}) {
  const media = MEDIA.movies;
  return (
    <div className="grid flex-1 gap-10 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)] lg:gap-16">
      <div className="flex flex-col gap-7">
        <h1 className="display text-[clamp(3.25rem,8.5vw,7.5rem)]">{media.ask}</h1>

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
          <legend className="label mb-3 text-muted">Time</legend>
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
          Deal {DECK_SIZE} films
          <ArrowRight className="size-5" aria-hidden />
        </button>
      </div>

      {/* Laptop only: a big read-back of what you're asking for. */}
      <aside className="hidden flex-col justify-between rounded-3xl bg-soft p-8 lg:flex">
        <div className="flex flex-col gap-3">
          <span className="label text-muted">Tonight feels</span>
          <p className="display text-[clamp(4rem,7vw,7.5rem)]">{MOODS[value.mood].label}</p>
          <p className="max-w-[34ch] text-lg">{MOOD_LINES[value.mood]}</p>
        </div>
        <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 text-sm">
          <dt className="label pt-0.5 text-muted">Energy</dt>
          <dd>{ENERGY[value.energy]}</dd>
          <dt className="label pt-0.5 text-muted">Time</dt>
          <dd>{media.time[value.time]}</dd>
          <dt className="label pt-0.5 text-muted">Deck</dt>
          <dd>
            {DECK_SIZE} films, mostly English. Tamil, Malayalam and Hindi when they&apos;re crime, thriller or
            acclaimed. What&apos;s on your services comes first.
          </dd>
        </dl>
      </aside>
    </div>
  );
}
