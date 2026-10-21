import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { AppFrame } from "@/components/shell/app-frame";
import { MoreFlow } from "@/components/flow/more-flow";
import { listRows } from "@/components/lists/list-rows";
import { moreListTitles } from "@/app/(app)/flow-actions";
import { FollowListButton, Progress } from "@/components/lists/list-controls";
import { buttonClasses } from "@/components/ui/button";
import { followedListSlugs, listEntries, seenCount } from "@/lib/lists/server";
import { requireOwner } from "@/lib/session";
import { LIST_PAGE } from "@/lib/picks/server";

export const metadata = { title: "List" };

export default function ListPage({ params }: PageProps<"/lists/[slug]">) {
  // Every list is a different URL, known only per request, so the whole page renders inside the boundary.
  return (
    <Suspense fallback={<div className="min-h-dvh bg-bg" />}>
      <ListFromParams params={params} />
    </Suspense>
  );
}

async function ListFromParams({ params }: { params: PageProps<"/lists/[slug]">["params"] }) {
  const { slug } = await params;
  return (
    <AppFrame>
      <Suspense fallback={<p className="text-muted">Loading the list…</p>}>
        <List slug={slug} />
      </Suspense>
    </AppFrame>
  );
}

const MEDIA_PATH = { movie: "movies", series: "series", book: "books" } as const;

async function List({ slug }: { slug: string }) {
  const owner = await requireOwner();
  const list = await listEntries(slug).catch(() => null);
  if (!list) notFound();
  const { def, entries } = list;
  const ids = entries.map((e) => e.id);
  const [seen, followed, first] = await Promise.all([
    seenCount(owner.id, def.media, ids),
    followedListSlugs(owner.id),
    listRows(owner.id, def, entries.slice(0, LIST_PAGE), 0),
  ]);
  const word = def.media === "book" ? "read" : "seen";

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
        <MoreFlow label="Titles on this list" first={first} total={entries.length} load={moreListTitles.bind(null, def.slug)} />
      )}
    </div>
  );
}
