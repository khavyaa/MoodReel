"use client";

import { MOOD_LIST, type MoodId } from "@/lib/recommendations/mood-presets";
import { cn } from "@/lib/utils";

export function MoodPicker({
  value,
  onSelect,
}: {
  value: MoodId | null;
  onSelect: (mood: MoodId) => void;
}) {
  return (
    <ul className="grid grid-cols-2 gap-3">
      {MOOD_LIST.map((mood) => {
        const active = value === mood.id;
        return (
          <li key={mood.id}>
            <button
              type="button"
              onClick={() => onSelect(mood.id)}
              aria-pressed={active}
              className={cn(
                "h-full w-full rounded-2xl border p-4 text-left transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ember-300",
                active
                  ? "border-ember-400/70 bg-ember-400/10"
                  : "border-ink-800 bg-ink-900 hover:border-ink-700 hover:bg-ink-850",
              )}
            >
              <span className="text-2xl" aria-hidden>
                {mood.emoji}
              </span>
              <span
                className={cn(
                  "mt-2 block text-sm font-semibold",
                  active ? "text-ember-300" : "text-ink-100",
                )}
              >
                {mood.label}
              </span>
              <span className="mt-1 block text-xs leading-snug text-ink-400">{mood.blurb}</span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
