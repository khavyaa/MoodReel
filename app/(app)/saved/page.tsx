import Link from "next/link";
import { Suspense } from "react";
import { AppFrame } from "@/components/shell/app-frame";
import { buttonClasses } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { LibrarySkeleton } from "@/components/library/library-skeleton";
import { SavedScreen } from "@/components/library/saved-screen";
import { PeopleSection } from "@/components/people/people-section";
import { libraryKey, libraryTitles } from "@/lib/library";
import { Pager, pageFrom } from "@/components/library/pager";
import { withLinksByKey } from "@/lib/adaptations/server";
import { LIST_PAGE, inProgress, providersFor, savedCounts, savedTitles } from "@/lib/picks/server";
import { requireOwner } from "@/lib/session";

export const metadata = { title: "Saved" };

export default function SavedPage({ searchParams }: PageProps<"/saved">) {
  return (
    <Suspense
      fallback={
        <AppFrame>
          <LibrarySkeleton eyebrow="Saved" />
        </AppFrame>
      }
    >
      <Saved searchParams={searchParams} />
    </Suspense>
  );
}

async function Saved({ searchParams }: { searchParams: PageProps<"/saved">["searchParams"] }) {
  const owner = await requireOwner();
  const params = await searchParams;
  // A type filter (?type=movie) and a page (?page=2), both in the address so Back works.
  const type = params.type === "movie" || params.type === "series" || params.type === "book" ? params.type : null;
  const counts = await savedCounts(owner.id);
  const inView = type ? counts[type] : counts.movie + counts.series + counts.book;
  const pages = Math.max(1, Math.ceil(inView / LIST_PAGE));
  const page = pageFrom(params.page, pages);
  const [saved, watching, reading, providers] = await Promise.all([
    savedTitles(owner.id, LIST_PAGE, type ?? undefined, (page - 1) * LIST_PAGE),
    inProgress(owner.id, "series"),
    inProgress(owner.id, "book"),
    providersFor(owner.id),
  ]);
  if (counts.movie + counts.series + counts.book === 0 && watching.length === 0 && reading.length === 0) {
    return (
      <AppFrame>
        <EmptyState
          eyebrow="Saved"
          title="Nothing saved yet"
          body="Everything you swipe right on and don't pick lands here, so you can come back to it another night. Series you're watching and books you're reading show up here too."
          action={
            <Link href="/movies" className={buttonClasses("solid", "lg", "self-start")}>
              Pick something
            </Link>
          }
        />
        <Suspense fallback={null}>
          <PeopleSection />
        </Suspense>
      </AppFrame>
    );
  }

  const cards = await libraryTitles(
    [
      ...saved,
      ...watching.map((w) => ({ media: "series" as const, id: w.id })),
      ...reading.map((r) => ({ media: "book" as const, id: r.id })),
    ],
    providers,
  ).then((found) => withLinksByKey(owner.id, found));
  const items = saved.flatMap((s) => cards.get(libraryKey(s.media, s.id)) ?? []);
  const entries = (media: "series" | "book", list: { id: number; since: Date }[]) =>
    list.flatMap((w) => {
      const show = cards.get(libraryKey(media, w.id));
      return show ? [{ since: w.since.toISOString(), show }] : [];
    });
  // Titles whose details couldn't be fetched just now stay listed, as placeholders.
  const unavailable = [
    ...saved.filter((s) => !cards.has(libraryKey(s.media, s.id))).map((s) => ({ media: s.media, id: s.id, list: "saved" as const })),
    ...watching.filter((w) => !cards.has(libraryKey("series", w.id))).map((w) => ({ media: "series" as const, id: w.id, list: "watching" as const })),
    ...reading.filter((r) => !cards.has(libraryKey("book", r.id))).map((r) => ({ media: "book" as const, id: r.id, list: "reading" as const })),
  ];
  const hrefFor = (n: number) => `/saved?${new URLSearchParams({ ...(type ? { type } : {}), ...(n > 1 ? { page: String(n) } : {}) })}`;
  return (
    <SavedScreen
      items={items}
      watching={entries("series", watching)}
      reading={entries("book", reading)}
      people={
        <Suspense fallback={null}>
          <PeopleSection />
        </Suspense>
      }
      counts={counts}
      filter={type ?? "all"}
      unavailable={unavailable}
      pager={<Pager page={page} pages={pages} href={hrefFor} label="Saved pages" />}
    />
  );
}
