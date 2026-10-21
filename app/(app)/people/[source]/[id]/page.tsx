import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { AppFrame } from "@/components/shell/app-frame";
import { MoreFlow } from "@/components/flow/more-flow";
import { FollowAvoid } from "@/components/people/person-controls";
import { personRows } from "@/components/people/person-rows";
import { morePersonWork } from "@/app/(app)/flow-actions";
import { Avatar } from "@/components/people/avatar";
import { buttonClasses } from "@/components/ui/button";
import { personPage } from "@/lib/people/works";
import { peoplePrefsFor } from "@/lib/people/server";
import { personKey, type PersonSource } from "@/lib/people/types";
import { LIST_PAGE, type Media } from "@/lib/picks/server";
import { requireOwner } from "@/lib/session";

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

async function Person({ source, id, as }: { source: PersonSource; id: number; as: string | null }) {
  const owner = await requireOwner();
  const [page, prefs] = await Promise.all([personPage(source, id).catch(() => null), peoplePrefsFor(owner.id)]);
  if (!page) notFound();
  const { person } = page;
  const pref = prefs.find((p) => personKey(p.person) === personKey(person))?.kind;

  const sections = (
    [
      { title: "Films", media: "movie", works: page.films },
      { title: "Series", media: "series", works: page.series },
      { title: "Books", media: "book", works: page.books },
    ] as const
  ).filter((s) => s.works.length > 0);
  const firsts = await Promise.all(sections.map((s) => personRows(owner.id, s.works.slice(0, LIST_PAGE))));
  const count = sections.reduce((n, s) => n + s.works.length, 0);
  const outside = sections.reduce((n, s) => n + s.works.filter((w) => w.outside).length, 0);
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
            <Avatar name={person.name} photo={page.photo} size="lg" />
            <div className="flex min-w-0 flex-col gap-2">
              <span className="label text-muted">
                {ROLE[as ?? person.role] ?? "Person"}
                {as && as !== person.role && ROLE[person.role] ? ` · also ${ROLE[person.role].toLowerCase()}` : ""} · {count}{" "}
                {person.role === "author" ? (count === 1 ? "book" : "books") : count === 1 ? "title" : "titles"}
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
            <p className="max-w-[46ch] text-sm text-muted lg:text-right">
              {outside > 0
                ? `Everything they've made is here; ${outside} ${outside === 1 ? "is" : "are"} outside your rules, so a deal from them leaves ${outside === 1 ? "it" : "those"} out.`
                : "A deal from them follows your mood and time, and skips what you've seen, saved or turned down."}
            </p>
          </div>
        </div>
      </header>

      {sections.length === 0 && <p className="text-muted">Nothing of theirs on TMDb or Open Library yet.</p>}
      {sections.map((s, n) => (
        <section key={s.media} aria-labelledby={`works-${s.media}`} className="flex flex-col gap-2">
          <h2 id={`works-${s.media}`} className={sections.length > 1 ? "text-xl font-black" : "sr-only"}>
            {s.title} · {s.works.length}
          </h2>
          <MoreFlow
            label={`${person.name}: ${s.title.toLowerCase()}`}
            tint={n === 0}
            first={firsts[n]}
            total={s.works.length}
            load={morePersonWork.bind(null, source, id, s.media)}
          />
        </section>
      ))}
    </div>
  );
}
