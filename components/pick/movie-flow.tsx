"use client";

import { useCallback, useRef, useState, type ReactNode } from "react";
import { dealMovies, noSavesThisTime, pickMovie, swipeMovie, undoMovieSwipe } from "@/app/(app)/[media]/actions";
import type { DeckCard } from "@/lib/deck/build-movies";
import { DECK_SIZE } from "@/lib/deck/compose";
import { choose, deckIsDone, startFinale, type Finale } from "@/lib/deck/finale";
import { buttonClasses } from "@/components/ui/button";
import { DeckScreen, type ExitAs, type SwipeAction } from "./deck-screen";
import { FinaleScreen } from "./finale-screen";
import { FlowFrame } from "./flow-frame";
import { PickScreen } from "./pick-screen";
import { TapsScreen, type TapsValue } from "./taps-screen";

type Step =
  | { kind: "taps" }
  | { kind: "dealing" }
  | { kind: "error"; message: string }
  | { kind: "empty" }
  | DeckStep
  | {
      kind: "finale";
      sessionId: string;
      finale: Finale<DeckCard>;
      saves: DeckCard[];
      /** The deck it came from, so "Back to the deck" can undo the last save. Null when picking from Saved. */
      deck: DeckStep | null;
    }
  | { kind: "pick"; sessionId: string; pick: DeckCard; saves: DeckCard[]; why: string | null };

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

const titleRef = (c: DeckCard) => ({ id: c.id, language: c.language, genreIds: c.genreIds });

const savesOf = (d: DeckStep) => d.cards.filter((_, i) => d.actions[i] === "saved");

/** A shortlist that skips the deck, from "Pick from my saved". With one film, it's already the pick. */
export type FlowStart = { sessionId: string; cards: DeckCard[]; taps: TapsValue; why: string | null };

export function MovieFlow({ start, notice, onExit }: { start?: FlowStart; notice?: ReactNode; onExit?: () => void }) {
  const [taps, setTaps] = useState<TapsValue>(start?.taps ?? { mood: "gripping", energy: 1, time: 1 });
  const [step, setStep] = useState<Step>(() => {
    if (!start) return { kind: "taps" };
    const finale = startFinale(start.cards);
    if (finale) return { kind: "finale", sessionId: start.sessionId, finale, saves: start.cards, deck: null };
    return { kind: "pick", sessionId: start.sessionId, pick: start.cards[0], saves: start.cards, why: start.why };
  });

  // Swipes save in the background, strictly in order, so a fast swiper never
  // races their own saves. A failed save is logged, never blocks the deck.
  const queue = useRef<Promise<unknown>>(Promise.resolve());
  const enqueue = useCallback((job: () => Promise<unknown>) => {
    queue.current = queue.current.then(job).catch((error) => console.warn("[moodreel] save failed", error));
    return queue.current;
  }, []);

  const deal = useCallback(async () => {
    setStep({ kind: "dealing" });
    const result = await dealMovies(taps).catch(() => null);
    if (!result || !result.ok) {
      setStep({ kind: "error", message: result?.error ?? "Couldn't deal a deck just now." });
      return;
    }
    if (result.cards.length === 0) {
      setStep({ kind: "empty" });
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
  }, [taps]);

  const reveal = useCallback(
    (sessionId: string, pick: DeckCard, saves: DeckCard[]) => {
      setStep({ kind: "pick", sessionId, pick, saves, why: null });
      void enqueue(async () => {
        const { why } = await pickMovie(
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
          },
          { mood: taps.mood, energy: taps.energy, beat: saves.length - 1 },
        );
        setStep((s) => (s.kind === "pick" && s.pick.id === pick.id ? { ...s, why } : s));
      });
    },
    [enqueue, taps.mood, taps.energy],
  );

  const finishDeck = useCallback(
    (deck: DeckStep) => {
      const saves = savesOf(deck);
      if (saves.length === 0) {
        void enqueue(() => noSavesThisTime(deck.sessionId));
        setStep({ kind: "empty" });
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
      void enqueue(() => swipeMovie(step.sessionId, titleRef(card), action));
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
      void enqueue(() => undoMovieSwipe(deck.sessionId, card.id));
      setStep({ ...deck, actions: deck.actions.slice(0, i), exitAs: "undo", returning: { id: card.id, action } });
    },
    [enqueue],
  );

  const onChoose = useCallback(
    (side: "champion" | "challenger") => {
      if (step.kind !== "finale") return;
      const result = choose(step.finale, side);
      if (result.done) reveal(step.sessionId, result.winner, step.saves);
      else setStep({ ...step, finale: result.finale });
    },
    [reveal, step],
  );

  const toTaps = useCallback(() => (onExit ? onExit() : setStep({ kind: "taps" })), [onExit]);

  return (
    <FlowFrame mood={taps.mood}>
      {step.kind === "taps" && (
        <>
          {notice}
          <TapsScreen value={taps} onChange={setTaps} onDeal={deal} />
        </>
      )}

      {step.kind === "dealing" && (
        <div className="flex flex-1 flex-col items-center justify-center gap-6" role="status">
          <div className="aspect-[2/3] w-[min(56vw,300px)] animate-pulse rounded-2xl bg-soft" />
          <p className="label">Dealing {DECK_SIZE} films…</p>
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
          savedForLater={step.saves.filter((c) => c.id !== step.pick.id)}
          onAgain={toTaps}
        />
      )}

      {step.kind === "empty" && (
        <Message
          title="Nothing grabbed you."
          body={`That's useful too: those won't come back for a while. Deal ${DECK_SIZE} more, or change the mood.`}
          primary={{ label: `Deal ${DECK_SIZE} more`, onClick: deal }}
          secondary={{ label: "Change the taps", onClick: toTaps }}
        />
      )}

      {step.kind === "error" && (
        <Message
          title="The deck didn't deal."
          body={step.message}
          primary={{ label: "Try again", onClick: deal }}
          secondary={{ label: "Change the taps", onClick: toTaps }}
        />
      )}
    </FlowFrame>
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
