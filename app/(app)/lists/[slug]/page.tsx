import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { AppFrame } from "@/components/shell/app-frame";
import { Poster } from "@/components/pick/poster";
import { DetailsButton } from "@/components/library/title-details";
import { Pager, pageFrom } from "@/components/library/pager";
import { TitleButtons } from "@/components/people/person-controls";
import { FollowListButton, Progress } from "@/components/lists/list-controls";
import { buttonClasses } from "@/components/ui/button";
import { libraryKey, libraryTitles } from "@/lib/library";
import { followedListSlugs, listEntries, seenCount } from "@/lib/lists/server";
import { LIST_PAGE, providersFor, statesFor } from "@/lib/picks/server";
import { requireOwner } from "@/lib/session";

export const metadata = { title: "List" };

export default function ListPage({ params, searchParams }: PageProps<"/lists/[slug]">) {
  // Every list is a different URL, known only per request, so the whole page renders inside the boundary.
  return (
    <Suspense fallback={<div className="min-h-dvh bg-bg" />}>
      <ListFromParams params={params} searchParams={searchParams} />
    </Suspense>
  );
}

async function ListFromParams({
  params,
  searchParams,
}: {
  params: PageProps<"/lists/[slug]">["params"];
  searchParams: PageProps<"/lists/[slug]">["searchParams"];
}) {
  const [{ slug }, query] = await Promise.all([params, searchParams]);
  return (
    <AppFrame>
      <Suspense fallback={<p className="text-muted">Loading the list…</p>}>
        <List slug={slug} page={query.page} />
      </Suspense>
    </AppFrame>
  );
}

const MEDIA_PATH = { movie: "movies", series: "series", book: "books" } as const;

async function List({ slug, page: pageParam }: { slug: string; page: string | string[] | undefined }) {
  const owner = await requireOwner();
  const list = await listEntries(slug).catch(() => null);
  if (!list) notFound();
  const { def, entries } = list;
  const pages = Math.max(1, Math.ceil(entries.length / LIST_PAGE));
  const page = pageFrom(pageParam, pages);
  const slice = entries.slice((page - 1) * LIST_PAGE, page * LIST_PAGE);
  const ids = entries.map((e) => e.id);
  const [seen, followed, cards, states] = await Promise.all([
    seenCount(owner.id, def.media, ids),
    followedListSlugs(owner.id),
    providersFor(owner.id).then((p) => libraryTitles(slice.map((e) => ({ media: def.media, id: e.id })), p)),
    statesFor(owner.id, def.media, slice.map((e) => e.id)),
  ]);
  const word = def.media === "book" ? "read" : "seen";
  const marker = (index: number, year: number | null) =>
    def.source.kind === "wikidata" ? (year ? `Won ${year}` : null) : def.source.kind === "tmdb-top" ? `#${index + 1}` : `Part ${index + 1}`;

  return (
    <div className="flex flex-col gap-8">
      <Link href="/lists" className="text-sm font-bold text-muted hover:text-fg">
        ← Lists
      </Link>
      <header className="flex flex-col gap-4">
        <span className="label text-muted">
          {def.media === "book" ? "Books" : def.media === "series" ? "Series" : "Films"} · {entries.length}
        </span>
        <h1 className="display text-[clamp(2.75rem,7vw,6rem)]">{def.title}</h1>
        <p className="max-w-[60ch] text-muted">{def.blurb}</p>
        <div className="max-w-md">
          <Progress seen={seen} total={entries.length} word={word} />
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href={`/${MEDIA_PATH[def.media]}?list=${encodeURIComponent(def.slug)}&name=${encodeURIComponent(def.title)}`}
            className={buttonClasses("solid", "lg")}
          >
            Deal from this list →
          </Link>
          <FollowListButton slug={def.slug} initial={followed.includes(def.slug)} />
        </div>
      </header>

      {entries.length === 0 ? (
        <p className="text-muted">This list hasn&apos;t loaded yet. Try again in a moment.</p>
      ) : (
        <ul aria-label="Titles on this list" className="grid gap-x-10 gap-y-5 md:grid-cols-2">
          {slice.map((e, i) => {
            const card = cards.get(libraryKey(def.media, e.id));
            const state = states.get(e.id);
            const status = state?.seen
              ? `${def.media === "book" ? "Read" : "Seen"}${state.rating ? ` ${"★".repeat(Math.round(state.rating / 2))}` : ""}`
              : state?.saved
                ? "Saved"
                : state?.disliked
                  ? "Not for me"
                  : null;
            const title = card?.title ?? `${def.media === "book" ? "A book" : "A title"} that didn't load just now`;
            return (
              <li key={e.id} className="grid grid-cols-[56px_minmax(0,1fr)] gap-4">
                <Poster title={title} path={card?.posterPath ?? null} size="sm" sizes="56px" className="rounded-lg shadow-none" />
                <div className="flex min-w-0 flex-col gap-1.5">
                  <p className="label text-muted">{[marker((page - 1) * LIST_PAGE + i, e.year), card?.year].filter(Boolean).join(" · ")}</p>
                  {card ? (
                    <DetailsButton card={card} media={def.media} id={e.id} title={card.title} className="block max-w-full truncate text-left font-black">
                      {card.title}
                    </DetailsButton>
                  ) : (
                    <p className="text-sm text-muted">{title}</p>
                  )}
                  {status ? (
                    <span className="self-start rounded-md bg-soft px-2 py-1 text-xs font-bold shadow-[inset_0_0_0_1.5px_var(--line)]">{status}</span>
                  ) : card ? (
                    <TitleButtons
                      media={def.media}
                      title={{ id: e.id, language: card.language, genreIds: card.genreIds, tags: card.book?.tags }}
                    />
                  ) : null}
                </div>
              </li>
            );
          })}
        </ul>
      )}
      <Pager page={page} pages={pages} href={(n) => `/lists/${def.slug}${n > 1 ? `?page=${n}` : ""}`} label="List pages" />
    </div>
  );
}
