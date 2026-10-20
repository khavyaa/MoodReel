"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Search } from "lucide-react";
import { searchPeople, type PersonMatch } from "@/app/(app)/people-actions";
import { parsePersonKey, personHref } from "@/lib/people/types";
import { Avatar } from "./avatar";

/** Search anyone: directors, actors and writers (TMDb) and authors (Open Library), in one box. */
export function PeopleSearch() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<{ screen: PersonMatch[]; books: PersonMatch[] } | null>(null);

  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) return;
    let live = true;
    const timer = setTimeout(async () => {
      const [screen, books] = await Promise.all([
        searchPeople("movie", q).catch(() => []),
        searchPeople("book", q).catch(() => []),
      ]);
      if (live) setResults({ screen, books });
    }, 300);
    return () => {
      live = false;
      clearTimeout(timer);
    };
  }, [query]);

  const shown = query.trim().length >= 2 ? results : null;
  return (
    <div className="flex flex-col gap-3">
      <label className="flex h-12 items-center gap-3 rounded-2xl px-4 shadow-[inset_0_0_0_2px_var(--line)] focus-within:shadow-[inset_0_0_0_2px_var(--fg)]">
        <Search className="size-5 text-muted" aria-hidden />
        <span className="sr-only">Search people</span>
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="A director, actor, writer or author"
          className="h-full min-w-0 flex-1 bg-transparent outline-none placeholder:text-muted"
        />
      </label>
      {shown && (
        <div className="grid gap-6 md:grid-cols-2">
          <Results title="Films & series" matches={shown.screen} />
          <Results title="Authors" matches={shown.books} />
        </div>
      )}
    </div>
  );
}

function Results({ title, matches }: { title: string; matches: PersonMatch[] }) {
  return (
    <section aria-label={title} className="flex flex-col gap-2">
      <h3 className="label text-muted">{title}</h3>
      {matches.length === 0 ? (
        <p className="text-sm text-muted">No one by that name.</p>
      ) : (
        <ul className="flex flex-col gap-1">
          {matches.map((m) => {
            const person = parsePersonKey(m.key);
            if (!person) return null;
            return (
              <li key={m.key}>
                <Link href={personHref(person)} className="flex items-center gap-3 rounded-xl p-2 hover:bg-soft">
                  <Avatar name={m.name} photo={m.photo} />
                  <span className="min-w-0">
                    <span className="block truncate font-bold">{m.name}</span>
                    <span className="block truncate text-sm text-muted">{m.detail}</span>
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
