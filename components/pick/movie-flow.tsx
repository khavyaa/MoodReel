"use client";

import { useCallback, useRef, useState } from "react";
import { dealMovies, noSavesThisTime, pickMovie, swipeMovie } from "@/app/(app)/[media]/actions";
import type { DeckCard } from "@/lib/deck/build-movies";
import { DECK_SIZE } from "@/lib/deck/compose";
import { choose, deckIsDone, startFinale, type Finale } from "@/lib/deck/finale";
import { buttonClasses } from "@/components/ui/button";
import { DeckScreen, type SwipeAction } from "./deck-screen";
import { FinaleScreen } from "./finale-screen";
import { FlowFrame } from "./flow-frame";
import { PickScreen } from "./pick-screen";
import { TapsScreen, type TapsValue } from "./taps-screen";

type Step =
  | { kind: "taps" }
  | { kind: "dealing" }
  | { kind: "error"; message: string }
  | { kind: "empty" }
  | {
      kind: "deck";
      sessionId: string;
      cards: DeckCard[];
      index: number;
      saves: DeckCard[];
      missing: string[];
      last: SwipeAction;
    }
  | { kind: "finale"; sessionId: string; finale: Finale<DeckCard>; saves: DeckCard[] }
  | { kind: "pick"; sessionId: string; pick: DeckCard; saves: DeckCard[]; why: string | null };

const titleRef = (c: DeckCard) => ({ id: c.id, language: c.language, genreIds: c.genreIds });

export function MovieFlow() {
  const [taps, setTaps] = useState<TapsValue>({ mood: "gripping", energy: 1, time: 1 });
  const [step, setStep] = useState<Step>({ kind: "taps" });

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
      index: 0,
      saves: [],
      missing: result.missingLanguages,
      last: "skipped",
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
    (sessionId: string, saves: DeckCard[]) => {
      if (saves.length === 0) {
        void enqueue(() => noSavesThisTime(sessionId));
        setStep({ kind: "empty" });
        return;
      }
      const finale = startFinale(saves);
      if (!finale) reveal(sessionId, saves[0], saves);
      else setStep({ kind: "finale", sessionId, finale, saves });
    },
    [enqueue, reveal],
  );

  const onSwipe = useCallback(
    (action: SwipeAction) => {
      if (step.kind !== "deck") return;
      const card = step.cards[step.index];
      if (!card) return;
      void enqueue(() => swipeMovie(step.sessionId, titleRef(card), action));
      const saves = action === "saved" ? [...step.saves, card] : step.saves;
      const index = step.index + 1;
      if (deckIsDone(index, step.cards.length, saves.length)) finishDeck(step.sessionId, saves);
      else setStep({ ...step, index, saves, last: action });
    },
    [enqueue, finishDeck, step],
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

  const toTaps = useCallback(() => setStep({ kind: "taps" }), []);

  return (
    <FlowFrame mood={taps.mood}>
      {step.kind === "taps" && <TapsScreen value={taps} onChange={setTaps} onDeal={deal} />}

      {step.kind === "dealing" && (
        <div className="flex flex-1 flex-col items-center justify-center gap-6" role="status">
          <div className="aspect-[2/3] w-[min(56vw,300px)] animate-pulse rounded-2xl bg-soft" />
          <p className="label">Dealing {DECK_SIZE} films…</p>
        </div>
      )}

      {step.kind === "deck" && (
        <DeckScreen
          cards={step.cards}
          index={step.index}
          saves={step.saves}
          lastAction={step.last}
          missingLanguages={step.missing}
          onSwipe={onSwipe}
        />
      )}

      {step.kind === "finale" && <FinaleScreen finale={step.finale} onChoose={onChoose} />}

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
