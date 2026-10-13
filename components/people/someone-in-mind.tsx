"use client";

import { useEffect, useState } from "react";
import { Search, X } from "lucide-react";
import { searchPeople, type PersonMatch } from "@/app/(app)/people-actions";

export type ChosenPerson = { key: string; name: string };

/**
 * "With someone in mind?" on the start screen: pick a director, actor, writer
 * or author and the deck comes from their work only. Optional.
 */
export function SomeoneInMind({
  media,
  value,
  onChange,
}: {
  media: "movie" | "series" | "book";
  value: ChosenPerson | null;
  onChange: (next: ChosenPerson | null) => void;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<{ for: string; matches: PersonMatch[] }>({ for: "", matches: [] });
  const searching = query.trim().length >= 2 && results.for !== query.trim();

  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) return;
    const timer = setTimeout(async () => {
      const matches = await searchPeople(media, q).catch(() => []);
      setResults({ for: q, matches });
    }, 300);
    return () => clearTimeout(timer);
  }, [media, query]);

  const label = media === "book" ? "An author in mind?" : "With someone in mind?";

  if (value) {
    return (
      <div className="flex flex-col gap-3">
        <span className="label text-muted">{label}</span>
        <div className="flex items-center gap-2 self-start rounded-full bg-fg py-1.5 pr-1.5 pl-4 font-bold text-bg">
          {value.name}
          <button
            type="button"
            onClick={() => onChange(null)}
            aria-label={`Deal without ${value.name}`}
            className="grid size-8 place-items-center rounded-full hover:bg-bg/20"
          >
            <X className="size-4" aria-hidden />
          </button>
        </div>
        <p className="text-sm opacity-80">The deck comes from their work only; mood and time still count.</p>
      </div>
    );
  }

  const matches = results.for === query.trim() ? results.matches : [];
  return (
    <div className="flex flex-col gap-2">
      <label htmlFor="someone" className="label text-muted">
        {label} <span className="normal-case opacity-70">· optional</span>
      </label>
      <div className="relative">
        <Search className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 opacity-60" aria-hidden />
        <input
          id="someone"
          type="search"
          autoComplete="off"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={media === "book" ? "Author's name" : "Director, actor or writer"}
          className="h-12 w-full rounded-2xl border-2 border-line bg-transparent pr-3 pl-10 text-base font-semibold placeholder:font-normal placeholder:opacity-60 focus:border-current focus:outline-none sm:max-w-md"
        />
      </div>
      {query.trim().length >= 2 && (
        <ul aria-label="Matching people" className="flex flex-col gap-1 sm:max-w-md">
          {searching && <li className="px-1 text-sm opacity-70">Searching…</li>}
          {!searching && matches.length === 0 && <li className="px-1 text-sm opacity-70">No one by that name.</li>}
          {matches.map((m) => (
            <li key={m.key}>
              <button
                type="button"
                onClick={() => {
                  onChange({ key: m.key, name: m.name });
                  setQuery("");
                }}
                className="w-full rounded-xl px-3 py-2 text-left hover:bg-soft"
              >
                <span className="font-bold">{m.name}</span> <span className="text-sm opacity-70">· {m.detail}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
