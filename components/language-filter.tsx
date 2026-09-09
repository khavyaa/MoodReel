"use client";

import { LANGUAGES, type LanguageCode } from "@/lib/types";
import { cn } from "@/lib/utils";

export function LanguageFilter({
  value,
  onChange,
  className,
}: {
  value: LanguageCode[];
  onChange: (next: LanguageCode[]) => void;
  className?: string;
}) {
  function toggle(code: LanguageCode) {
    const next = value.includes(code) ? value.filter((c) => c !== code) : [...value, code];
    // Never let the user filter down to nothing - an empty deck is not a useful state.
    onChange(next.length ? next : value);
  }

  return (
    <div className={cn("flex flex-wrap gap-2", className)} role="group" aria-label="Languages">
      {LANGUAGES.map((language) => {
        const active = value.includes(language.code);
        return (
          <button
            key={language.code}
            type="button"
            onClick={() => toggle(language.code)}
            aria-pressed={active}
            className={cn(
              "rounded-full border px-4 py-2 text-sm transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ember-300",
              active
                ? "border-ember-400/70 bg-ember-400/15 text-ember-300"
                : "border-ink-700 bg-ink-850 text-ink-300 hover:border-ink-600 hover:text-ink-100",
            )}
          >
            <span className="font-medium">{language.label}</span>
            <span className="ml-2 text-ink-400">{language.native}</span>
          </button>
        );
      })}
    </div>
  );
}
