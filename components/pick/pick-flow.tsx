"use client";

import { useCallback, useEffect, useState, type ReactNode } from "react";
import { useOffline } from "next/offline";
import { useRouter, useSearchParams } from "next/navigation";
import { parsePersonKey } from "@/lib/people/types";
import type { ChosenPerson } from "@/components/people/someone-in-mind";
import {
  abandon,
  deal as dealDeck,
  noSavesThisTime,
  pick as pickTitle,
  resumeDeck,
  resumeOffer,
  swipe,
  undo as undoSwipe,
  type ResumeOffer,
} from "@/app/(app)/[media]/actions";
import type { DeckCard } from "@/lib/deck/build-movies";
import { DECK_SIZE } from "@/lib/deck/compose";
import { MEDIA, MOODS, type MoodId } from "@/lib/moods";
import { choose, deckIsDone, startFinale, type Finale } from "@/lib/deck/finale";
import { buttonClasses } from "@/components/ui/button";
import { DeckScreen, type ExitAs, type SwipeAction } from "./deck-screen";
import { FinaleScreen } from "./finale-screen";
import { FlowFrame } from "./flow-frame";
import { usePosterColour } from "@/components/flow/use-poster-colour";
import { PickScreen } from "./pick-screen";
import { TapsScreen, type TapsValue } from "./taps-screen";
import { SaveStatusBar, useSaveQueue } from "./save-queue";

/** A new deal waits this long at most for earlier saves, so it doesn't deal what you just swiped. */
const DEAL_WAITS_FOR_SAVES_MS = 8000;

/** Back in the app after this long, the start screen checks for a due "Did you watch it?" card. */
const RECHECK_AFTER_MS = 60_000;

type Step =
  | { kind: "taps" }
  | { kind: "dealing" }
  | { kind: "error"; message: string }
  /** "none": nothing fit at all; "passed": you went through the deck and saved nothing. */
  | { kind: "empty"; reason: "none" | "passed" }
  | DeckStep
  | {
      kind: "finale";
      sessionId: string;
      finale: Finale<DeckCard>;
      saves: DeckCard[];
      /** The deck it came from, so "Back to the deck" can undo the last save. Null when picking from Saved. */
      deck: DeckStep | null;
    }
  | {
      kind: "pick";
      sessionId: string;
      pick: DeckCard;
      saves: DeckCard[];
      why: string | null;
      /** The pick is recorded (on your History, off your Saved list). */
      recorded: boolean;
    };

type DeckStep = {
  kind: "deck";
  sessionId: string;
  cards: DeckCard[];
  /** What you did with each card so far, in order; its length is where you are in the deck. */
  actions: SwipeAction[];
  missing: string[];
  exitAs: ExitAs;
  returning: { id: number; action: SwipeAction } | null;
};

const titleRef = (c: DeckCard) => ({ id: c.id, language: c.language, genreIds: c.genreIds, tags: c.book?.tags });

const savesOf = (d: DeckStep) => d.cards.filter((_, i) => d.actions[i] === "saved");

/** A shortlist that skips the deck, from "Pick from my saved". With one film, it's already the pick. */
export type FlowStart = { sessionId: string; cards: DeckCard[]; taps: TapsValue; why: string | null };

/** The whole run for films or series: taps → deck → head-to-head → tonight's pick. */
export function PickFlow({
  media,
  start,
  notice,
  onExit,
}: {
  media: "movie" | "series" | "book";
  start?: FlowStart;
  notice?: ReactNode;
  onExit?: () => void;
}) {
  const config = MEDIA[media === "movie" ? "movies" : media === "series" ? "series" : "books"];
  const noun = media === "movie" ? "films" : media === "series" ? "series" : "books";
  const [taps, setTaps] = useState<TapsValue>(start?.taps ?? { mood: config.moods[0], energy: 1, time: 1 });
  const [step, setStep] = useState<Step>(() => {
    if (!start) return { kind: "taps" };
    const finale = startFinale(start.cards);
    if (finale) return { kind: "finale", sessionId: start.sessionId, finale, saves: start.cards, deck: null };
    // A single saved title is picked on the server before the flow starts.
    return { kind: "pick", sessionId: start.sessionId, pick: start.cards[0], saves: start.cards, why: start.why, recorded: true };
  });

  // Swipes, undos and the pick save in the background, in order; see save-queue.
  const { enqueue, retry, settled, status: saveStatus } = useSaveQueue();

  // A person from the URL (a person page's "Deal from …", the People list) or the start screen's search.
  const params = useSearchParams();
  const [person, setPerson] = useState<ChosenPerson | null>(() => {
    const key = params.get("with");
    const name = params.get("name");
    return key && name && parsePersonKey(key) ? { key, name } : null;
  });

  // A list from the URL (a list page's "Deal from this list").
  const [list, setList] = useState<{ slug: string; name: string } | null>(() => {
    const slug = params.get("list");
    const name = params.get("name");
    return slug && name && !params.get("with") ? { slug, name } : null;
  });

  const [adaptations, setAdaptations] = useState(false);

  const deal = useCallback(async (from: ChosenPerson | null = person, onlyAdaptations = adaptations, fromList = list) => {
    setStep({ kind: "dealing" });
    // Earlier swipes first, so the new deck can't deal what you just turned down.
    await Promise.race([settled(), new Promise((r) => setTimeout(r, DEAL_WAITS_FOR_SAVES_MS))]);
    const result = await dealDeck(
      media,
      taps,
      from?.key ?? null,
      Boolean(onlyAdaptations && !from && !fromList),
      from ? null : (fromList?.slug ?? null),
    ).catch(() => null);
    if (!result || !result.ok) {
      setStep({ kind: "error", message: result?.error ?? "Couldn't deal a deck just now." });
      return;
    }
    if (result.cards.length === 0) {
      setStep({ kind: "empty", reason: "none" });
      return;
    }
    setStep({
      kind: "deck",
      sessionId: result.sessionId,
      cards: result.cards,
      actions: [],
      missing: result.missingLanguages,
      exitAs: "skipped",
      returning: null,
    });
  }, [media, taps, person, adaptations, list, settled]);

  const reveal = useCallback(
    (sessionId: string, pick: DeckCard, saves: DeckCard[]) => {
      setStep({ kind: "pick", sessionId, pick, saves, why: null, recorded: false });
      enqueue(async () => {
        const { why } = await pickTitle(
          sessionId,
          {
            ...titleRef(pick),
            title: pick.title,
            rating: pick.rating,
            votes: pick.votes,
            runtime: pick.runtime,
            languageLabel: pick.languageLabel,
            gate: pick.gate,
            streamingOn: pick.streamingOn,
            directors: pick.directors,
            overview: pick.overview,
            seasons: pick.series?.seasons ?? null,
            firstSeasonEpisodes: pick.series?.firstSeasonEpisodes ?? null,
            book: pick.book ? { authors: pick.book.authors, pages: pick.book.pages, nytWeeks: pick.book.nytWeeks } : null,
          },
          { mood: taps.mood, energy: taps.energy, beat: saves.length - 1 },
        );
        setStep((s) => (s.kind === "pick" && s.pick.id === pick.id ? { ...s, why, recorded: true } : s));
      });
    },
    [enqueue, taps.mood, taps.energy],
  );

  const finishDeck = useCallback(
    (deck: DeckStep) => {
      const saves = savesOf(deck);
      if (saves.length === 0) {
        enqueue(() => noSavesThisTime(deck.sessionId));
        setStep({ kind: "empty", reason: "passed" });
        return;
      }
      const finale = startFinale(saves);
      if (!finale) reveal(deck.sessionId, saves[0], saves);
      else setStep({ kind: "finale", sessionId: deck.sessionId, finale, saves, deck });
    },
    [enqueue, reveal],
  );

  const onSwipe = useCallback(
    (action: SwipeAction) => {
      if (step.kind !== "deck") return;
      const card = step.cards[step.actions.length];
      if (!card) return;
      enqueue(() => swipe(step.sessionId, titleRef(card), action));
      const next: DeckStep = { ...step, actions: [...step.actions, action], exitAs: action, returning: null };
      if (deckIsDone(next.actions.length, next.cards.length, savesOf(next).length)) finishDeck(next);
      else setStep(next);
    },
    [enqueue, finishDeck, step],
  );

  /** Step back one card: it returns to the top of the pile and its swipe is erased. */
  const undo = useCallback(
    (deck: DeckStep) => {
      const i = deck.actions.length - 1;
      if (i < 0) return;
      const card = deck.cards[i];
      const action = deck.actions[i];
      enqueue(() => undoSwipe(deck.sessionId, card.id));
      setStep({ ...deck, actions: deck.actions.slice(0, i), exitAs: "undo", returning: { id: card.id, action } });
    },
    [enqueue],
  );

  // An unfinished deck from the last day (the app was closed or reloaded mid-deck) is offered on the start screen.
  const [offer, setOffer] = useState<ResumeOffer | null>(null);
  const onStartScreen = step.kind === "taps" && !start;
  useEffect(() => {
    if (!onStartScreen) return;
    let live = true;
    resumeOffer(media)
      .then((found) => live && setOffer(found))
      .catch(() => undefined);
    return () => {
      live = false;
    };
  }, [onStartScreen, media]);

  const resume = useCallback(async () => {
    setStep({ kind: "dealing" });
    const result = await resumeDeck(media).catch(() => null);
    setOffer(null);
    if (!result || !result.ok) {
      setStep({ kind: "error", message: result?.error ?? "Couldn't load that deck just now." });
      return;
    }
    setTaps(result.taps as TapsValue);
    const deck: DeckStep = {
      kind: "deck",
      sessionId: result.sessionId,
      cards: result.cards,
      actions: result.actions,
      missing: [],
      exitAs: "skipped",
      returning: null,
    };
    if (deckIsDone(deck.actions.length, deck.cards.length, savesOf(deck).length)) finishDeck(deck);
    else setStep(deck);
  }, [media, finishDeck]);

  const startAgain = useCallback(() => {
    if (!offer) return;
    enqueue(() => abandon(offer.sessionId));
    setOffer(null);
  }, [enqueue, offer]);

  const onChoose = useCallback(
    (side: "champion" | "challenger") => {
      if (step.kind !== "finale") return;
      const result = choose(step.finale, side);
      if (result.done) reveal(step.sessionId, result.winner, step.saves);
      else setStep({ ...step, finale: result.finale });
    },
    [reveal, step],
  );

  // The "Did you watch it?" / "Still watching?" card is rendered on the server
  // with the page. The home-screen app resumes rather than reloads, and "Start
  // again" doesn't reload either, so ask the server again at those moments:
  // otherwise a card that's become due never shows.
  const router = useRouter();
  const onTaps = step.kind === "taps";
  useEffect(() => {
    if (!onTaps) return;
    let hiddenAt = 0;
    const onVisibility = () => {
      if (document.visibilityState === "hidden") hiddenAt = Date.now();
      else if (hiddenAt && Date.now() - hiddenAt >= RECHECK_AFTER_MS && navigator.onLine) router.refresh();
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, [onTaps, router]);

  const pickTint = usePosterColour(step.kind === "pick" ? step.pick.posterPath : null);

  const toTaps = useCallback(() => {
    if (onExit) return onExit();
    setStep({ kind: "taps" });
    if (navigator.onLine) router.refresh();
  }, [onExit, router]);

  return (
    <FlowFrame mood={taps.mood} tint={pickTint}>
      <SaveStatusBar status={saveStatus} onRetry={() => void retry()} />
      {step.kind === "taps" && (
        <>
          {notice}
          {offer && <ResumeCard offer={offer} noun={noun} onResume={() => void resume()} onStartAgain={startAgain} />}
          <TapsScreen
            media={media}
            value={taps}
            onChange={setTaps}
            onDeal={() => deal()}
            person={person}
            onPerson={setPerson}
            adaptations={adaptations}
            onAdaptations={setAdaptations}
            listName={person ? null : (list?.name ?? null)}
            onClearList={() => setList(null)}
          />
        </>
      )}

      {step.kind === "dealing" && (
        <div className="flex flex-1 flex-col items-center justify-center gap-6" role="status">
          <div className="aspect-[2/3] w-[min(56vw,300px)] animate-pulse rounded-2xl bg-soft" />
          <DealingLabel noun={noun} />
        </div>
      )}

      {step.kind === "deck" && (
        <DeckScreen
          cards={step.cards}
          index={step.actions.length}
          saves={savesOf(step)}
          exitAs={step.exitAs}
          returning={step.returning}
          missingLanguages={step.missing}
          fromName={person?.name ?? list?.name ?? null}
          onSwipe={onSwipe}
          onUndo={step.actions.length > 0 ? () => undo(step) : null}
        />
      )}

      {step.kind === "finale" && (
        <FinaleScreen
          finale={step.finale}
          onChoose={onChoose}
          onBack={step.deck ? () => undo(step.deck!) : null}
          fromSaved={!step.deck}
        />
      )}

      {step.kind === "pick" && (
        <PickScreen
          pick={step.pick}
          mood={taps.mood}
          why={step.why}
          resultLabel={config.result}
          savedForLater={step.saves.filter((c) => c.id !== step.pick.id)}
          recorded={step.recorded}
          saveFailed={saveStatus === "failed"}
          onAgain={toTaps}
        />
      )}

      {step.kind === "empty" && person && (
        <Message
          title={`Nothing left from ${person.name}.`}
          body="Everything of theirs that fits is seen, saved or turned down. Try a longer slot, or deal without them."
          primary={{
            label: "Deal without them",
            onClick: () => {
              setPerson(null);
              void deal(null);
            },
          }}
          secondary={{ label: "Change the taps", onClick: toTaps }}
        />
      )}
      {step.kind === "empty" && !person && list && (
        <Message
          title={`Nothing left from ${list.name}.`}
          body="Nothing on it fits this mood and slot that you haven't seen, saved or turned down. Try another mood, a longer slot, or deal without the list."
          primary={{
            label: "Deal without the list",
            onClick: () => {
              setList(null);
              void deal(null, adaptations, null);
            },
          }}
          secondary={{ label: "Change the taps", onClick: toTaps }}
        />
      )}
      {step.kind === "empty" && !person && !list && adaptations && (
        <Message
          title="No adaptations left for this mood."
          body="The films and series of books that fit are seen, saved or turned down. Deal without the switch, or try another mood."
          primary={{
            label: "Deal without the switch",
            onClick: () => {
              setAdaptations(false);
              void deal(null, false);
            },
          }}
          secondary={{ label: "Change the taps", onClick: toTaps }}
        />
      )}
      {step.kind === "empty" && step.reason === "none" && !person && !list && !adaptations && (
        <Message
          title="Nothing fits right now."
          body={`Every one of the ${noun} that fit this mood and time is already seen, saved or turned down. Try another mood or a longer slot.`}
          primary={{ label: "Change the taps", onClick: toTaps }}
          secondary={{ label: "Try again", onClick: () => deal() }}
        />
      )}
      {step.kind === "empty" && step.reason === "passed" && !person && !list && !adaptations && (
        <Message
          title="Nothing grabbed you."
          body={`That's useful too: those won't come back for a while. Deal ${DECK_SIZE} more, or change the mood.`}
          primary={{ label: `Deal ${DECK_SIZE} more`, onClick: () => deal() }}
          secondary={{ label: "Change the taps", onClick: toTaps }}
        />
      )}

      {step.kind === "error" && (
        <Message
          title="The deck didn't deal."
          body={step.message}
          primary={{ label: "Try again", onClick: () => deal() }}
          secondary={{ label: "Change the taps", onClick: toTaps }}
        />
      )}
    </FlowFrame>
  );
}

/** "Pick up where you left off": the unfinished deck, how far you got, Resume or Start again. */
function ResumeCard({
  offer,
  noun,
  onResume,
  onStartAgain,
}: {
  offer: ResumeOffer;
  noun: string;
  onResume: () => void;
  onStartAgain: () => void;
}) {
  const mood = MOODS[offer.mood as MoodId]?.label ?? offer.mood;
  return (
    <section
      aria-label="Unfinished deck"
      className="mb-6 flex flex-wrap items-center gap-x-6 gap-y-3 rounded-2xl bg-soft px-5 py-4 shadow-[inset_0_0_0_1.5px_var(--line)]"
    >
      <div className="flex min-w-0 grow basis-60 flex-col gap-0.5">
        <p className="font-bold">Pick up where you left off</p>
        <p className="text-sm text-muted">
          {mood} {noun} · card {Math.min(offer.dealt + 1, offer.total)} of {offer.total}
          {offer.saves > 0 ? ` · ${offer.saves} saved` : ""}
        </p>
      </div>
      <div className="flex gap-2">
        <button type="button" onClick={onResume} className={buttonClasses("solid", "md")}>
          Resume
        </button>
        <button type="button" onClick={onStartAgain} className={buttonClasses("ghost", "md")}>
          Start again
        </button>
      </div>
    </section>
  );
}

function Message({
  title,
  body,
  primary,
  secondary,
}: {
  title: string;
  body: string;
  primary: { label: string; onClick: () => void };
  secondary: { label: string; onClick: () => void };
}) {
  return (
    <div className="flex max-w-3xl flex-1 flex-col justify-center gap-5" role="status">
      <h1 className="display text-[clamp(3rem,8vw,7rem)]">{title}</h1>
      <p className="max-w-[48ch] text-lg">{body}</p>
      <div className="flex flex-wrap gap-3">
        <button type="button" onClick={primary.onClick} className={buttonClasses("solid", "lg")}>
          {primary.label}
        </button>
        <button type="button" onClick={secondary.onClick} className={buttonClasses("outline", "lg")}>
          {secondary.label}
        </button>
      </div>
    </div>
  );
}

/** "Dealing up to 15 films…" (a narrow mood or a person's work can deal fewer), or, offline, that it's waiting: the deal is sent when the connection returns. */
function DealingLabel({ noun }: { noun: string }) {
  const offline = useOffline();
  return (
    <p className="label">
      {offline ? `Offline: dealing as soon as you're back` : `Dealing up to ${DECK_SIZE} ${noun}…`}
    </p>
  );
}
