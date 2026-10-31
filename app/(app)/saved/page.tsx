import Link from "next/link";
import { Suspense } from "react";
import { AppFrame } from "@/components/shell/app-frame";
import { buttonClasses } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { LibrarySkeleton } from "@/components/library/library-skeleton";
import { SavedScreen } from "@/components/library/saved-screen";
import { libraryKey, libraryTitles } from "@/lib/library";
import { withLinksByKey } from "@/lib/adaptations/server";
import { inProgress, providersFor, savedCounts } from "@/lib/picks/server";
import { savedPage } from "@/lib/library-pages";
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
  // A type filter (?type=movie), in the address so Back works.
  const type = params.type === "movie" || params.type === "series" || params.type === "book" ? params.type : null;
  const [counts, first, tonight, watching, reading, providers] = await Promise.all([
    savedCounts(owner.id),
    savedPage(owner.id, type, 0),
    inProgress(owner.id, "movie"),
    inProgress(owner.id, "series"),
    inProgress(owner.id, "book"),
    providersFor(owner.id),
  ]);
  if (counts.movie + counts.series + counts.book === 0 && tonight.length + watching.length + reading.length === 0) {
    return (
      <AppFrame>
        <EmptyState
          eyebrow="Saved"
          title="Nothing saved yet"
          body="Everything you swipe right on and don't pick lands here, so you can come back to it another night. Films you picked for tonight, series you're watching and books you're reading show up here too."
          action={
            <Link href="/movies" className={buttonClasses("solid", "lg", "self-start")}>
              Pick something
            </Link>
          }
        />
      </AppFrame>
    );
  }

  const cards = await libraryTitles(
    [
      ...tonight.map((t) => ({ media: "movie" as const, id: t.id })),
      ...watching.map((w) => ({ media: "series" as const, id: w.id })),
      ...reading.map((r) => ({ media: "book" as const, id: r.id })),
    ],
    providers,
  ).then((found) => withLinksByKey(owner.id, found));
  const entries = (media: "movie" | "series" | "book", list: { id: number; since: Date }[]) =>
    list.flatMap((w) => {
      const show = cards.get(libraryKey(media, w.id));
      return show ? [{ since: w.since.toISOString(), show }] : [];
    });
  // Titles whose details couldn't be fetched just now stay listed, as placeholders.
  const unavailable = [
    ...first.unavailable,
    ...tonight.filter((t) => !cards.has(libraryKey("movie", t.id))).map((t) => ({ media: "movie" as const, id: t.id, list: "tonight" as const })),
    ...watching.filter((w) => !cards.has(libraryKey("series", w.id))).map((w) => ({ media: "series" as const, id: w.id, list: "watching" as const })),
    ...reading.filter((r) => !cards.has(libraryKey("book", r.id))).map((r) => ({ media: "book" as const, id: r.id, list: "reading" as const })),
  ];
  return (
    <SavedScreen
      items={first.movies}
      fetched={first.fetched}
      tonight={entries("movie", tonight)}
      watching={entries("series", watching)}
      reading={entries("book", reading)}
      counts={counts}
      filter={type ?? "all"}
      unavailable={unavailable}
    />
  );
}
