import "server-only";
import type { FlowPage } from "@/components/flow/more-flow";
import { DetailsButton } from "@/components/library/title-details";
import { TitleButtons } from "@/components/people/person-controls";
import { libraryKey, libraryTitles } from "@/lib/library";
import type { ListDef } from "@/lib/lists/catalog";
import { providersFor, statesFor } from "@/lib/picks/server";

type Entry = { id: number; year: number | null };

/** "Won 2020", "#12", "Part 2": where a title stands on its list. */
export function listMarker(def: ListDef, index: number, year: number | null) {
  return def.source.kind === "wikidata" ? (year ? `Won ${year}` : null) : def.source.kind === "tmdb-top" ? `#${index + 1}` : `Part ${index + 1}`;
}

/** One page of a list (starting at `from`) as flow cards, with each title's status or its buttons underneath. */
export async function listRows(userId: string, def: ListDef, entries: Entry[], from: number): Promise<FlowPage> {
  if (!entries.length) return { items: [], infos: [] };
  const [cards, states] = await Promise.all([
    providersFor(userId).then((p) => libraryTitles(entries.map((e) => ({ media: def.media, id: e.id })), p)),
    statesFor(userId, def.media, entries.map((e) => e.id)),
  ]);
  const titleOf = (id: number) => cards.get(libraryKey(def.media, id))?.title ?? `${def.media === "book" ? "A book" : "A title"} that didn't load just now`;
  return {
    items: entries.map((e, i) => ({
      key: String(e.id),
      title: titleOf(e.id),
      image: cards.get(libraryKey(def.media, e.id))?.posterPath ?? null,
      badge: listMarker(def, from + i, e.year),
      done: !!states.get(e.id)?.seen,
    })),
    infos: entries.map((e, i) => {
      const card = cards.get(libraryKey(def.media, e.id));
      const state = states.get(e.id);
      const status = state?.seen
        ? `${def.media === "book" ? "Read" : "Seen"}${state.rating ? ` ${"★".repeat(Math.round(state.rating / 2))}` : ""}`
        : state?.saved
          ? "Saved"
          : state?.disliked
            ? "Not for me"
            : null;
      return (
        <div key={e.id} className="flex flex-col items-center gap-3 text-center">
          <div className="flex flex-col items-center gap-0.5">
            <p className="label text-muted">{[listMarker(def, from + i, e.year), card?.year].filter(Boolean).join(" · ")}</p>
            {card ? (
              <DetailsButton card={card} media={def.media} id={e.id} title={card.title} className="text-xl leading-tight font-black">
                {card.title}
              </DetailsButton>
            ) : (
              <p className="text-sm text-muted">This one didn&apos;t load just now.</p>
            )}
          </div>
          {status ? (
            <span className="rounded-md bg-soft px-2 py-1 text-xs font-bold shadow-[inset_0_0_0_1.5px_var(--line)]">{status}</span>
          ) : card ? (
            <TitleButtons
              media={def.media}
              label={card.title}
              title={{ id: e.id, language: card.language, genreIds: card.genreIds, tags: card.book?.tags }}
            />
          ) : null}
        </div>
      );
    }),
  };
}
