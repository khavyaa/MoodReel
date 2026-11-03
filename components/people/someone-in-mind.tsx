"use client";

import { useEffect, useState } from "react";
import { ArrowRight, Search, X } from "lucide-react";
import { searchPeople, type PersonMatch } from "@/app/(app)/people-actions";
import { cn } from "@/lib/cn";
import { Avatar } from "./avatar";

export type ChosenPerson = { key: string; name: string };

/** Matches shown before "more with that name". */
const FIRST = 3;

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
  const [active, setActive] = useState(0);
  const [showAll, setShowAll] = useState(false);
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

  // The last answer stays up while you keep typing, instead of blanking.
  const matches = results.matches;
  const shown = showAll ? matches : matches.slice(0, FIRST);
  const open = query.trim().length >= 2;
  const choose = (m: PersonMatch) => {
    onChange({ key: m.key, name: m.name });
    setQuery("");
  };

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Escape") return setQuery("");
    if (!shown.length) return;
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      const step = e.key === "ArrowDown" ? 1 : -1;
      setActive((a) => (a + step + shown.length) % shown.length);
    } else if (e.key === "Enter") {
      e.preventDefault();
      choose(shown[Math.min(active, shown.length - 1)]);
    }
  }

  return (
    <div className="flex flex-col gap-2 sm:max-w-md">
      <label htmlFor="someone" className="label text-muted">
        {label} <span className="normal-case">· optional</span>
      </label>
      <div className="relative">
        <Search className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 opacity-60" aria-hidden />
        <input
          id="someone"
          type="text"
          inputMode="search"
          enterKeyHint="search"
          role="combobox"
          aria-expanded={open && shown.length > 0}
          aria-controls="someone-matches"
          aria-activedescendant={open && shown.length ? `someone-${active}` : undefined}
          autoComplete="off"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setActive(0);
            setShowAll(false);
          }}
          onKeyDown={onKeyDown}
          placeholder={media === "book" ? "Author's name" : "Director, actor or writer"}
          className="h-12 w-full rounded-2xl border-2 border-line bg-transparent pr-12 pl-10 text-base font-semibold placeholder:font-normal placeholder:opacity-60 focus:border-current focus:outline-none"
        />
        {query && (
          <button
            type="button"
            onClick={() => setQuery("")}
            aria-label="Clear"
            className="absolute top-1/2 right-1 grid size-10 -translate-y-1/2 place-items-center rounded-full hover:bg-soft"
          >
            <X className="size-4" aria-hidden />
          </button>
        )}
      </div>
      {open && (
        <div className="rounded-3xl p-1.5 shadow-[inset_0_0_0_2px_var(--line)]">
          {searching && matches.length === 0 && <p className="px-3 py-2 text-sm text-muted">Searching…</p>}
          {!searching && matches.length === 0 && <p className="px-3 py-2 text-sm text-muted">No one by that name.</p>}
          <ul id="someone-matches" role="listbox" aria-label="Matching people" className="flex flex-col gap-0.5">
            {shown.map((m, i) => (
              <li
                key={m.key}
                id={`someone-${i}`}
                role="option"
                aria-selected={i === active}
                onClick={() => choose(m)}
                onMouseMove={() => setActive(i)}
                className={cn(
                  "flex cursor-pointer items-center gap-3 rounded-2xl p-2 pr-3",
                  i === active && "bg-fg text-bg",
                )}
              >
                <Avatar name={m.name} photo={m.photo} className="size-11" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-bold">{m.name}</span>
                  <span className={cn("block truncate text-sm", i === active ? "opacity-80" : "text-muted")}>{m.detail}</span>
                </span>
                {i === active && <ArrowRight className="size-4 shrink-0" aria-hidden />}
              </li>
            ))}
          </ul>
          {!showAll && matches.length > FIRST && (
            <button
              type="button"
              onClick={() => setShowAll(true)}
              className="w-full rounded-2xl px-3 py-2 text-sm font-semibold text-muted hover:bg-soft"
            >
              Show {matches.length - FIRST} more
            </button>
          )}
        </div>
      )}
    </div>
  );
}
