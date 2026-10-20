import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { AppFrame } from "@/components/shell/app-frame";
import { CoverFlow } from "@/components/flow/cover-flow";
import { FollowAvoid, TitleButtons } from "@/components/people/person-controls";
import { Avatar } from "@/components/people/avatar";
import { DetailsButton } from "@/components/library/title-details";
import { buttonClasses } from "@/components/ui/button";
import { PAGE_LIMIT, personWorks } from "@/lib/people/works";
import { peoplePrefsFor } from "@/lib/people/server";
import { personKey, type PersonSource } from "@/lib/people/types";
import { statesFor, type Media } from "@/lib/picks/server";
import { bookTags } from "@/lib/books/rules";
import { requireOwner } from "@/lib/session";
import type { MovieCandidate } from "@/lib/taste/types";

export const metadata = { title: "Person" };

const ROLE: Record<string, string> = {
  director: "Director",
  creator: "Creator",
  writer: "Writer",
  actor: "Actor",
  author: "Author",
};

export default function PersonPage({ params, searchParams }: PageProps<"/people/[source]/[id]">) {
  // Every person is a different URL, known only per request (the header reads
  // it too), so the whole page renders inside the boundary.
  return (
    <Suspense fallback={<div className="min-h-dvh bg-bg" />}>
      <PersonFromParams params={params} searchParams={searchParams} />
    </Suspense>
  );
}

async function PersonFromParams({
  params,
  searchParams,
}: {
  params: PageProps<"/people/[source]/[id]">["params"];
  searchParams: PageProps<"/people/[source]/[id]">["searchParams"];
}) {
  const [{ source, id }, query] = await Promise.all([params, searchParams]);
  // The role you came from ("Directed by …"), if it's a known one.
  const as = typeof query.as === "string" && query.as in ROLE ? query.as : null;
  const src: PersonSource | null = source === "tmdb" ? "tmdb" : source === "ol" ? "openlibrary" : null;
  const num = Number(id);
  if (!src || !Number.isInteger(num) || num <= 0) notFound();
  return (
    <AppFrame>
      <Suspense fallback={<p className="text-muted">Loading their work…</p>}>
        <Person source={src} id={num} as={as} />
      </Suspense>
    </AppFrame>
  );
}

type Row = { media: Media; candidate: MovieCandidate; pages?: number | null; tags?: string[] };

async function Person({ source, id, as }: { source: PersonSource; id: number; as: string | null }) {
  const owner = await requireOwner();
  const [works, prefs] = await Promise.all([personWorks(source, id).catch(() => null), peoplePrefsFor(owner.id)]);
  if (!works) notFound();
  const { person } = works;
  const pref = prefs.find((p) => personKey(p.person) === personKey(person))?.kind;

  const sections: { title: string; media: Media; total: number; rows: Row[] }[] = [
    {
      title: "Films",
      media: "movie" as const,
      total: works.films.length,
      rows: works.films.slice(0, PAGE_LIMIT).map((w) => ({ media: "movie" as const, candidate: w.candidate })),
    },
    {
      title: "Series",
      media: "series" as const,
      total: works.series.length,
      rows: works.series.slice(0, PAGE_LIMIT).map((w) => ({ media: "series" as const, candidate: w.candidate })),
    },
    {
      title: "Books",
      media: "book" as const,
      total: works.books.length,
      rows: works.books
        .slice(0, PAGE_LIMIT)
        .map((b) => ({ media: "book" as const, candidate: b, pages: b.pages, tags: bookTags(b.subjects) })),
    },
  ].filter((s) => s.rows.length > 0);

  const states = new Map(
    await Promise.all(
      sections.map(async (s) => [s.media, await statesFor(owner.id, s.media, s.rows.map((r) => r.candidate.id))] as const),
    ),
  );
  const count = sections.reduce((n, s) => n + s.total, 0);
  const dealHref = (media: Media) =>
    `/${media === "movie" ? "movies" : media === "series" ? "series" : "books"}?with=${personKey(person)}&name=${encodeURIComponent(person.name)}`;

  return (
    <div className="flex flex-col gap-10">
      <header className="flex flex-col gap-5">
        <Link href="/people" className="self-start text-sm font-bold text-muted hover:text-fg">
          ← People
        </Link>
        <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:gap-8">
          <div className="flex min-w-0 items-center gap-5">
            <Avatar name={person.name} photo={works.photo} size="lg" />
            <div className="flex min-w-0 flex-col gap-2">
              <span className="label text-muted">
                {ROLE[as ?? person.role] ?? "Person"}
                {as && as !== person.role && ROLE[person.role] ? ` · also ${ROLE[person.role].toLowerCase()}` : ""} · {count}{" "}
                {person.role === "author" ? (count === 1 ? "book" : "books") : count === 1 ? "title" : "titles"} for you
              </span>
              {/* Sized to its column: a long name wraps rather than running under the posters. */}
              <h1 className="display text-[clamp(2.25rem,5vw,4.75rem)] [overflow-wrap:anywhere]">{person.name}</h1>
            </div>
          </div>
          <div className="flex flex-col gap-3 lg:ml-auto lg:items-end">
            <FollowAvoid person={person} initial={pref === "follow" || pref === "avoid" ? pref : null} />
            <div className="flex flex-wrap gap-2 lg:justify-end">
              {sections.map((s) => (
                <Link key={s.media} href={dealHref(s.media)} className={buttonClasses("solid", "lg")}>
                  {sections.length > 1 ? `Deal ${s.title.toLowerCase()} from ${person.name}` : `Deal from ${person.name}`} →
                </Link>
              ))}
            </div>
            <p className="max-w-[44ch] text-sm text-muted lg:text-right">
              Mood and time as usual; only their work, and nothing you&apos;ve seen, saved or turned down.
            </p>
          </div>
        </div>
      </header>

      {sections.length === 0 && <p className="text-muted">Nothing of theirs fits your rules.</p>}
      {sections.map((s, n) => (
        <section key={s.media} aria-labelledby={`works-${s.media}`} className="flex flex-col gap-2">
          <h2 id={`works-${s.media}`} className={sections.length > 1 ? "text-xl font-black" : "sr-only"}>
            {s.title} · {s.total}
          </h2>
          <CoverFlow
            label={`${person.name}: ${s.title.toLowerCase()}`}
            tint={n === 0}
            items={s.rows.map((r) => {
              const state = states.get(s.media)?.get(r.candidate.id);
              return { key: String(r.candidate.id), title: r.candidate.title, image: r.candidate.posterPath, done: !!state?.seen };
            })}
            infos={s.rows.map((r) => {
              const state = states.get(s.media)?.get(r.candidate.id);
              const stars = state?.rating ? Math.round(state.rating / 2) : 0;
              const status = state?.inProgress
                ? s.media === "book"
                  ? "Reading"
                  : "Watching"
                : state?.seen
                  ? `${s.media === "book" ? "Read" : "Seen"}${stars ? ` ${"★".repeat(stars)}` : ""}`
                  : state?.saved
                    ? "Saved"
                    : state?.disliked
                      ? "Not for me"
                      : null;
              return (
                <div key={r.candidate.id} className="flex flex-col items-center gap-3 text-center">
                  <div className="flex flex-col items-center gap-0.5">
                    <DetailsButton media={s.media} id={r.candidate.id} title={r.candidate.title} className="text-xl leading-tight font-black">
                      {r.candidate.title}
                    </DetailsButton>
                    <p className="text-sm text-muted">
                      {[r.candidate.year, r.pages ? `${r.pages} pages` : null, r.candidate.voteCount ? `★ ${r.candidate.voteAverage.toFixed(1)}` : null]
                        .filter(Boolean)
                        .join(" · ")}
                    </p>
                  </div>
                  {status ? (
                    <span className="rounded-md bg-soft px-2 py-1 text-xs font-bold shadow-[inset_0_0_0_1.5px_var(--line)]">{status}</span>
                  ) : (
                    <TitleButtons
                      media={s.media}
                      title={{ id: r.candidate.id, language: r.candidate.language, genreIds: r.candidate.genreIds, tags: r.tags }}
                    />
                  )}
                </div>
              );
            })}
          />
          {s.total > s.rows.length && (
            <p className="text-center text-sm text-muted">
              Their best-known {s.rows.length} of {s.total}. &ldquo;Deal from {person.name}&rdquo; draws on all of them.
            </p>
          )}
        </section>
      ))}
      {works.hiddenByLanguage.length > 0 && (
        <p className="text-center text-sm text-muted">Not shown, by your language rules: {works.hiddenByLanguage.join(", ")}.</p>
      )}
    </div>
  );
}
