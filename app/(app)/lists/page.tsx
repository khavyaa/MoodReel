import Link from "next/link";
import { Suspense } from "react";
import { AppFrame } from "@/components/shell/app-frame";
import { CollectionSearch, Progress } from "@/components/lists/list-controls";
import { LISTS, type ListDef } from "@/lib/lists/catalog";
import { followedListSlugs, listEntries, seenCount, startedCollections } from "@/lib/lists/server";
import { requireOwner } from "@/lib/session";

export const metadata = { title: "Lists" };

const GROUPS: { media: ListDef["media"]; title: string }[] = [
  { media: "movie", title: "Films" },
  { media: "series", title: "Series" },
  { media: "book", title: "Books" },
];

/** Lists: award winners, top-rated lists and film collections, each with how far through it you are. */
export default function ListsPage() {
  return (
    <AppFrame>
      <div className="flex flex-col gap-10">
        <header className="flex flex-col gap-2">
          <span className="label text-muted">Lists</span>
          <h1 className="display text-[clamp(3rem,7vw,6rem)]">Worth getting through</h1>
          <p className="max-w-[60ch] text-muted">
            Follow a list and its titles rank a little higher in your decks, with a badge. Or deal straight from one.
          </p>
        </header>
        <Suspense fallback={<p className="text-muted">Counting what you&apos;ve seen…</p>}>
          <AllLists />
        </Suspense>
        <section aria-labelledby="collections" className="flex flex-col gap-4">
          <h2 id="collections" className="text-2xl font-black">
            Collections
          </h2>
          <Suspense fallback={null}>
            <Started />
          </Suspense>
          <CollectionSearch />
        </section>
      </div>
    </AppFrame>
  );
}

const word = (media: ListDef["media"]) => (media === "book" ? "read" : "seen");

async function AllLists() {
  const owner = await requireOwner();
  const [followed, counts] = await Promise.all([
    followedListSlugs(owner.id),
    Promise.all(
      LISTS.map(async (def) => {
        const list = await listEntries(def.slug).catch(() => null);
        const ids = list?.entries.map((e) => e.id) ?? [];
        return [def.slug, { total: ids.length, seen: await seenCount(owner.id, def.media, ids) }] as const;
      }),
    ),
  ]);
  const progress = new Map(counts);
  const card = (def: ListDef) => {
    const p = progress.get(def.slug) ?? { seen: 0, total: 0 };
    return (
      <li key={def.slug}>
        <Link href={`/lists/${def.slug}`} className="flex h-full flex-col gap-3 rounded-3xl bg-soft p-5 hover:shadow-[inset_0_0_0_2px_var(--line)]">
          <span className="text-lg leading-tight font-black">{def.title}</span>
          <span className="text-sm text-muted">{def.blurb}</span>
          <span className="mt-auto">
            <Progress seen={p.seen} total={p.total} word={word(def.media)} />
          </span>
        </Link>
      </li>
    );
  };
  const followedDefs = followed.flatMap((slug) => LISTS.filter((l) => l.slug === slug));
  return (
    <div className="flex flex-col gap-10">
      {followedDefs.length > 0 && (
        <section aria-labelledby="following-lists" className="flex flex-col gap-4">
          <h2 id="following-lists" className="text-2xl font-black">
            Following · {followedDefs.length}
          </h2>
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{followedDefs.map(card)}</ul>
        </section>
      )}
      {GROUPS.map((g) => (
        <section key={g.media} aria-labelledby={`lists-${g.media}`} className="flex flex-col gap-4">
          <h2 id={`lists-${g.media}`} className="text-2xl font-black">
            {g.title}
          </h2>
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{LISTS.filter((l) => l.media === g.media).map(card)}</ul>
        </section>
      ))}
    </div>
  );
}

/** Franchises you're part-way through, from the films you've seen. */
async function Started() {
  const owner = await requireOwner();
  const started = await startedCollections(owner.id).catch(() => []);
  if (!started.length) {
    return <p className="text-sm text-muted">Film series you&apos;re part-way through show up here. Or find one:</p>;
  }
  return (
    <ul aria-label="Collections you've started" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {started.map((c) => (
        <li key={c.slug}>
          <Link href={`/lists/${c.slug}`} className="flex flex-col gap-3 rounded-3xl bg-soft p-5 hover:shadow-[inset_0_0_0_2px_var(--line)]">
            <span className="text-lg leading-tight font-black">{c.title}</span>
            <Progress seen={c.seen} total={c.total} word="seen" />
          </Link>
        </li>
      ))}
    </ul>
  );
}
