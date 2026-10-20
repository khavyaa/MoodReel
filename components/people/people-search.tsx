"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Search } from "lucide-react";
import { searchPeople, type PersonMatch } from "@/app/(app)/people-actions";
import { parsePersonKey, personHref } from "@/lib/people/types";
import { Avatar } from "./avatar";

type Found = { query: string; matches: PersonMatch[] };

/** Does any word of the name start with what's typed ("nol" finds Christopher Nolan)? */
const startsAWord = (name: string, q: string) =>
  name
    .toLowerCase()
    .split(/[\s.-]+/)
    .some((w) => w.startsWith(q)) || name.toLowerCase().startsWith(q);

/**
 * Search anyone: directors, actors and writers (TMDb) and authors (Open
 * Library), in one box. People you already follow or avoid come up the moment
 * you type; each source's answer shows as soon as it arrives (TMDb in a blink,
 * Open Library can take a few seconds), and the last answer stays up while
 * you keep typing instead of blanking.
 */
export function PeopleSearch({ known = [] }: { known?: PersonMatch[] }) {
  const [query, setQuery] = useState("");
  const [screen, setScreen] = useState<Found | null>(null);
  const [books, setBooks] = useState<Found | null>(null);

  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) return;
    let live = true;
    const timer = setTimeout(() => {
      searchPeople("movie", q)
        .catch(() => [])
        .then((matches) => live && setScreen({ query: q, matches }));
      searchPeople("book", q)
        .catch(() => [])
        .then((matches) => live && setBooks({ query: q, matches }));
    }, 200);
    return () => {
      live = false;
      clearTimeout(timer);
    };
  }, [query]);

  const q = query.trim();
  const active = q.length >= 2;
  const yours = q.length >= 1 ? known.filter((p) => startsAWord(p.name, q.toLowerCase())).slice(0, 6) : [];
  const yourKeys = new Set(yours.map((p) => p.key));
  const fresh = (found: Found | null) => (found ? found.matches.filter((m) => !yourKeys.has(m.key)) : null);

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
      {yours.length > 0 && <Results title="Your people" matches={yours} />}
      {active && (
        <div className="grid gap-6 md:grid-cols-2">
          <Results title="Films & series" matches={fresh(screen)} searching={screen?.query !== q} />
          <Results title="Authors" matches={fresh(books)} searching={books?.query !== q} />
        </div>
      )}
    </div>
  );
}

function Results({ title, matches, searching = false }: { title: string; matches: PersonMatch[] | null; searching?: boolean }) {
  return (
    <section aria-label={title} aria-busy={searching} className="flex flex-col gap-2">
      <h3 className="label flex items-center gap-2 text-muted">
        {title}
        {searching && <span className="tracking-normal normal-case">· searching…</span>}
      </h3>
      {matches === null ? null : matches.length === 0 ? (
        !searching && <p className="text-sm text-muted">No one by that name.</p>
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
