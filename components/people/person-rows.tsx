import "server-only";
import type { FlowPage } from "@/components/flow/more-flow";
import { DetailsButton } from "@/components/library/title-details";
import { TitleButtons } from "@/components/people/person-controls";
import { statesFor } from "@/lib/picks/server";
import type { PageWork } from "@/lib/people/works";

/** One page of a person's work as flow cards, with each title's status or its buttons underneath. */
export async function personRows(userId: string, works: PageWork[]): Promise<FlowPage> {
  if (!works.length) return { items: [], infos: [] };
  const media = works[0].media;
  const states = await statesFor(userId, media, works.map((w) => w.candidate.id));
  return {
    items: works.map((w) => ({
      key: String(w.candidate.id),
      title: w.candidate.title,
      image: w.candidate.posterPath,
      done: !!states.get(w.candidate.id)?.seen,
      badge: w.outside ? "Outside your rules" : null,
    })),
    infos: works.map((w) => {
      const c = w.candidate;
      const state = states.get(c.id);
      const stars = state?.rating ? Math.round(state.rating / 2) : 0;
      const status = state?.inProgress
        ? media === "book"
          ? "Reading"
          : media === "movie"
            ? "Picked for tonight"
            : "Watching"
        : state?.seen
          ? `${media === "book" ? "Read" : "Seen"}${stars ? ` ${"★".repeat(stars)}` : ""}`
          : state?.saved
            ? "Saved"
            : state?.disliked
              ? "Not for me"
              : null;
      return (
        <div key={c.id} className="flex flex-col items-center gap-3 text-center">
          <div className="flex flex-col items-center gap-0.5">
            <DetailsButton media={media} id={c.id} title={c.title} className="text-xl leading-tight font-black">
              {c.title}
            </DetailsButton>
            <p className="text-sm text-muted">
              {[c.year, w.pages ? `${w.pages} pages` : null, c.voteCount ? `★ ${c.voteAverage.toFixed(1)}` : null, w.outside ? "outside your rules" : null]
                .filter(Boolean)
                .join(" · ")}
            </p>
          </div>
          {status ? (
            <span className="rounded-md bg-soft px-2 py-1 text-xs font-bold shadow-[inset_0_0_0_1.5px_var(--line)]">{status}</span>
          ) : (
            <TitleButtons media={media} label={c.title} title={{ id: c.id, language: c.language, genreIds: c.genreIds, tags: w.tags }} />
          )}
        </div>
      );
    }),
  };
}
