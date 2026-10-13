"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, animate, motion, useMotionValue, useReducedMotion, useTransform } from "framer-motion";
import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp, Check, Heart, Star, Undo2 } from "lucide-react";
import { PeopleLine } from "@/components/people/people-line";
import type { DeckCard } from "@/lib/deck/build-movies";
import { MAX_SAVES } from "@/lib/deck/finale";
import { airingLabel, bestsellerLabel, cardMeta, makersLabel, ratingCountLabel } from "@/lib/card-meta";
import { cn } from "@/lib/cn";
import { Poster } from "./poster";

export type SwipeAction = "saved" | "skipped" | "seen" | "disliked";
/** How the card leaving the pile goes: the way it was swiped, or quietly to the back on undo. */
export type ExitAs = SwipeAction | "undo";

const EXIT: Record<SwipeAction, { x: number; y: number; rotate: number }> = {
  saved: { x: 640, y: 40, rotate: 16 },
  skipped: { x: -640, y: 40, rotate: -16 },
  seen: { x: 0, y: -820, rotate: 0 },
  disliked: { x: 0, y: 820, rotate: 0 },
};

/** Cards rendered in the pile: the one you're deciding on and two beneath it. */
const PILE = 3;
/** Where each card in the pile rests, top first. */
// Every property an entrance or exit touches is listed, so a card coming back
// from an undo (which starts off-screen) always lands back in the pile.
const RESTING = [
  { x: 0, scale: 1, y: 0, rotate: 0, opacity: 1, zIndex: 3 },
  { x: 0, scale: 0.94, y: 14, rotate: -3, opacity: 1, zIndex: 2 },
  { x: 0, scale: 0.88, y: 28, rotate: 2.5, opacity: 0.7, zIndex: 1 },
] as const;
const BEHIND = { ...RESTING[PILE - 1], scale: 0.82, y: 40, opacity: 0 };
/** A soft, quick settle: no bounce, so it reads the same on 60 and 120 Hz screens. */
const SETTLE = { type: "spring", stiffness: 420, damping: 38, mass: 0.9 } as const;

const KEYS: Record<string, SwipeAction> = {
  ArrowLeft: "skipped",
  ArrowRight: "saved",
  ArrowUp: "seen",
  ArrowDown: "disliked",
};

/** Distance or flick speed that commits a swipe instead of springing back. */
const COMMIT = 110;
const FLICK = 700;

export function DeckScreen({
  cards,
  index,
  saves,
  exitAs,
  returning,
  missingLanguages,
  onSwipe,
  onUndo,
  fromName = null,
}: {
  cards: DeckCard[];
  index: number;
  saves: DeckCard[];
  exitAs: ExitAs;
  /** A card coming back after an undo, and the way it had gone. */
  returning: { id: number; action: SwipeAction } | null;
  missingLanguages: string[];
  onSwipe: (action: SwipeAction) => void;
  onUndo: (() => void) | null;
  /** Dealt from one person's work. */
  fromName?: string | null;
}) {
  const card = cards[index];

  // Keys on a laptop: arrows to swipe, Z or ⌘Z to undo. Ignored while typing.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const target = e.target as HTMLElement | null;
      if (target?.closest("input, textarea, select, [contenteditable]")) return;
      if (e.key.toLowerCase() === "z" && !e.altKey && !e.shiftKey) {
        if (onUndo) {
          e.preventDefault();
          onUndo();
        }
        return;
      }
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const action = KEYS[e.key];
      if (action) {
        e.preventDefault();
        onSwipe(action);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onSwipe, onUndo]);

  if (!card) return null;

  return (
    <div className="flex flex-1 flex-col gap-4 lg:gap-8">
      {fromName && <p className="label -mb-2 text-muted">From {fromName}</p>}
      <Progress total={cards.length} index={index} saves={saves} />
      {missingLanguages.length > 0 && (
        <p role="status" className="rounded-2xl bg-soft px-4 py-2 text-sm">
          Couldn&apos;t load {missingLanguages.join(", ")} films this time, so they&apos;re missing from this deck.
        </p>
      )}

      <div className="grid flex-1 items-center gap-6 lg:grid-cols-[minmax(280px,380px)_minmax(0,1fr)] lg:gap-14">
        {/*
          The pile: the next two cards sit underneath, already loaded. When the
          top card leaves, they slide forward instead of a new card popping in.
        */}
        <div className="relative mx-auto aspect-[2/3] w-[min(50vw,240px)] lg:w-full lg:max-w-[380px]">
          <AnimatePresence custom={exitAs} initial={false}>
            {cards
              .slice(index, index + PILE)
              .map((c, depth) => (
                <SwipeCard
                  key={c.id}
                  card={c}
                  depth={depth}
                  returnFrom={returning?.id === c.id ? returning.action : null}
                  onSwipe={onSwipe}
                />
              ))
              .reverse()}
          </AnimatePresence>
        </div>

        <CardInfo key={card.id} card={card} />
      </div>

      <div className="mt-auto flex flex-col gap-2 lg:mt-0 lg:flex-row lg:items-center lg:gap-3">
        <div className="grid grid-cols-[1fr_1fr_1fr_1.25fr] gap-2 lg:flex lg:gap-3">
          <ActionButton label="Skip" hint="←" icon={<ArrowLeft className="size-5" aria-hidden />} onClick={() => onSwipe("skipped")} />
          <ActionButton label="Not for me" hint="↓" icon={<ArrowDown className="size-5" aria-hidden />} onClick={() => onSwipe("disliked")} />
          <ActionButton
            label={card.media === "book" ? "Read it" : "Seen it"}
            hint="↑"
            icon={<ArrowUp className="size-5" aria-hidden />}
            onClick={() => onSwipe("seen")}
          />
          <ActionButton label="Save" hint="→" icon={<ArrowRight className="size-5" aria-hidden />} onClick={() => onSwipe("saved")} primary />
        </div>
        <div className="flex min-h-9 items-center justify-between gap-4 lg:ml-auto">
          <p className="text-xs text-muted lg:hidden">Skip brings it back in a couple of months. Not for me never does.</p>
          <button
            type="button"
            onClick={onUndo ?? undefined}
            disabled={!onUndo}
            aria-keyshortcuts="Z"
            className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full px-3 text-sm font-bold underline-offset-4 hover:underline disabled:invisible"
          >
            <Undo2 className="size-4" aria-hidden /> Undo
            <kbd aria-hidden className="hidden font-mono text-xs opacity-60 lg:inline">Z</kbd>
          </button>
        </div>
      </div>
      <p aria-live="polite" className="sr-only">
        {card.title}, card {index + 1} of {cards.length}.
      </p>
    </div>
  );
}

function SwipeCard({
  card,
  depth,
  returnFrom,
  onSwipe,
}: {
  card: DeckCard;
  depth: number;
  returnFrom: SwipeAction | null;
  onSwipe: (a: SwipeAction) => void;
}) {
  const reduce = useReducedMotion();
  const isTop = depth === 0;
  // Drag lives on an inner layer, the pile position and the exit on the outer
  // one, so a card flies off from wherever your finger let go of it.
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const rotate = useTransform(x, [-320, 320], [-14, 14]);
  const saveHint = useTransform(x, [40, 140], [0, 1]);
  const skipHint = useTransform(x, [-140, -40], [1, 0]);
  const seenHint = useTransform(y, [-140, -40], [1, 0]);
  const nopeHint = useTransform(y, [40, 140], [0, 1]);
  const committed = useRef(false);

  return (
    <motion.div
      aria-hidden={!isTop}
      className={cn("absolute inset-0 will-change-transform", !isTop && "pointer-events-none")}
      variants={{
        // The card leaves the way you sent it: right for save, left for skip, up for seen.
        exit: (a: ExitAs) =>
          reduce
            ? { opacity: 0, transition: { duration: 0.15 } }
            : a === "undo"
              ? { ...BEHIND, transition: { duration: 0.2 } }
              : { ...EXIT[a], opacity: 0, zIndex: PILE + 1, transition: { duration: 0.38, ease: [0.3, 0.7, 0.4, 1] } },
      }}
      // New cards rise from behind the pile; an undone card comes back from where it went.
      initial={reduce ? false : returnFrom ? { ...EXIT[returnFrom], opacity: 0, zIndex: PILE + 1 } : BEHIND}
      animate={reduce ? { ...RESTING[depth], rotate: 0 } : RESTING[depth]}
      exit="exit"
      transition={SETTLE}
    >
      <motion.div
        className={cn("h-full", isTop && "cursor-grab touch-none active:cursor-grabbing")}
        style={{ x, y, rotate }}
        drag={isTop}
        dragElastic={0.9}
        dragMomentum={false}
        // A card back from an undo may be the same instance that was swiped: each drag starts fresh.
        onDragStart={() => {
          committed.current = false;
        }}
        onDragEnd={(_, info: { offset: { x: number; y: number }; velocity: { x: number; y: number } }) => {
          if (committed.current) return;
          const { offset, velocity } = info;
          let action: SwipeAction | null = null;
          const vertical = Math.abs(offset.y) > Math.abs(offset.x);
          if (vertical && (offset.y < -COMMIT || velocity.y < -FLICK)) action = "seen";
          else if (vertical && (offset.y > COMMIT || velocity.y > FLICK)) action = "disliked";
          else if (offset.x > COMMIT || velocity.x > FLICK) action = "saved";
          else if (offset.x < -COMMIT || velocity.x < -FLICK) action = "skipped";
          if (action) {
            committed.current = true;
            onSwipe(action);
          } else {
            // Not far enough: spring back to the pile.
            animate(x, 0, SETTLE);
            animate(y, 0, SETTLE);
          }
        }}
      >
        <Poster title={card.title} path={card.posterPath} sizes="(min-width: 1024px) 380px, 50vw" priority={depth < 2} />
        {isTop && (
          <>
            <Stamp label="Save" opacity={saveHint} className="left-4 -rotate-12" />
            <Stamp label="Skip" opacity={skipHint} className="right-4 rotate-12" />
            <Stamp label={card.media === "book" ? "Read it" : "Seen it"} opacity={seenHint} className="left-1/2 -translate-x-1/2" />
            <Stamp label="Not for me" opacity={nopeHint} className="top-auto bottom-5 left-1/2 -translate-x-1/2 whitespace-nowrap" />
          </>
        )}
      </motion.div>
    </motion.div>
  );
}

function Stamp({
  label,
  opacity,
  className,
}: {
  label: string;
  opacity: ReturnType<typeof useTransform<number, number>>;
  className?: string;
}) {
  return (
    <motion.span
      aria-hidden
      style={{ opacity }}
      className={cn(
        "pointer-events-none absolute top-5 rounded-xl border-[3px] border-white bg-black/30 px-3 py-1 text-lg font-black tracking-widest text-white uppercase backdrop-blur-sm",
        className,
      )}
    >
      {label}
    </motion.span>
  );
}

function CardInfo({ card }: { card: DeckCard }) {
  const people = makersLabel(card);
  const airing = airingLabel(card);
  const bestseller = bestsellerLabel(card);
  return (
    <div className="flex min-w-0 flex-col gap-3 lg:gap-4">
      <p className="label text-muted">{cardMeta(card)}</p>
      <h2 className="display text-[clamp(2.25rem,6vw,5.5rem)]">{card.title}</h2>
      {card.book && card.people.length > 0 && <PeopleLine people={card.people} followedName={card.followedName} className="-mt-1" />}
      {card.book && !card.people.length && people && <p className="-mt-1 font-bold lg:text-lg">{people}</p>}
      {!card.book && card.originalTitle !== card.title && <p className="-mt-1 text-sm text-muted">{card.originalTitle}</p>}

      <div className="flex flex-wrap gap-2">
        <Badge>
          <Star className="size-3.5 fill-current" aria-hidden />
          {card.rating.toFixed(1)}
          <span className="font-normal opacity-70">· {ratingCountLabel(card)}</span>
        </Badge>
        {bestseller && <Badge strong>{bestseller}</Badge>}
        {card.streamingOn.map((s) => (
          <Badge key={s} strong>
            <Check className="size-3.5" aria-hidden /> On {s}
          </Badge>
        ))}
        {airing && <Badge>{airing}</Badge>}
        {card.gate && <Badge>{card.gate === "acclaimed" ? `Acclaimed ${card.languageLabel}` : `${card.languageLabel} crime`}</Badge>}
        {card.followedName && (
          <Badge strong>
            <Heart className="size-3.5 fill-current" aria-hidden /> You follow {card.followedName}
          </Badge>
        )}
      </div>

      {card.genres.length > 0 && <p className="hidden text-sm text-muted sm:block">{card.genres.slice(0, 4).join(" · ")}</p>}
      <Overview text={card.overview} />
      {card.series?.firstSeasonEpisodes ? (
        <p className="hidden text-sm text-muted sm:block">Season 1: {card.series.firstSeasonEpisodes} episodes</p>
      ) : null}
      {!card.book && card.people.length > 0 && (
        <>
          <PeopleLine people={card.people} followedName={card.followedName} compact className="sm:hidden" />
          <PeopleLine people={card.people} followedName={card.followedName} className="hidden sm:flex" />
        </>
      )}
    </div>
  );
}

/** The synopsis, clamped to fit beside the poster, with "More" when it doesn't. */
function Overview({ text }: { text: string }) {
  const [open, setOpen] = useState(false);
  const [clipped, setClipped] = useState(false);
  // Whether the clamp actually cuts anything depends on screen width, so it's measured, not guessed.
  const measure = useCallback((el: HTMLParagraphElement | null) => {
    if (!el) return;
    const check = () => setClipped(el.scrollHeight > el.clientHeight + 1);
    check();
    const observer = new ResizeObserver(check);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  if (!text) return null;
  return (
    <div className="flex max-w-[60ch] flex-col items-start gap-1">
      <p
        ref={open ? undefined : measure}
        className={cn("text-[15px] leading-relaxed lg:text-lg", !open && "line-clamp-3 lg:line-clamp-5")}
      >
        {text}
      </p>
      {(clipped || open) && (
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          className="text-sm font-bold underline underline-offset-4"
        >
          {open ? "Less" : "More"}
        </button>
      )}
    </div>
  );
}

function Badge({ children, strong }: { children: React.ReactNode; strong?: boolean }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-[13px] font-semibold",
        strong ? "bg-accent text-on-accent" : "bg-soft shadow-[inset_0_0_0_1.5px_var(--line)]",
      )}
    >
      {children}
    </span>
  );
}

function ActionButton({
  label,
  hint,
  icon,
  onClick,
  primary,
}: {
  label: string;
  hint: string;
  icon: React.ReactNode;
  onClick: () => void;
  primary?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={`${label} (${hint})`}
      aria-keyshortcuts={{ "←": "ArrowLeft", "→": "ArrowRight", "↑": "ArrowUp", "↓": "ArrowDown" }[hint]}
      className={cn(
        // iPhone: icon over a short label, four across. Laptop: one pill each.
        "inline-flex h-16 flex-col items-center justify-center gap-0.5 rounded-2xl border-2 px-1 text-xs font-bold whitespace-nowrap transition-colors sm:h-14 sm:flex-row sm:gap-2 sm:rounded-full sm:px-6 sm:text-base",
        primary
          ? "border-accent bg-accent text-on-accent hover:opacity-90"
          : "border-line hover:bg-soft",
      )}
    >
      {icon}
      {label}
    </button>
  );
}

function Progress({ total, index, saves }: { total: number; index: number; saves: DeckCard[] }) {
  return (
    <div className="flex items-center gap-4">
      <ol className="flex flex-1 gap-1" aria-label={`Card ${index + 1} of ${total}`}>
        {Array.from({ length: total }, (_, i) => (
          <li
            key={i}
            className={cn(
              "h-1.5 flex-1 rounded-full",
              i < index ? "bg-current opacity-40" : i === index ? "bg-current" : "bg-line",
            )}
          />
        ))}
      </ol>
      <span className="label tabular-nums">
        {index + 1}/{total}
      </span>
      <ol className="flex gap-1.5" aria-label={`${saves.length} of ${MAX_SAVES} saved`}>
        {Array.from({ length: MAX_SAVES }, (_, i) => (
          <li key={i} className="w-6 lg:w-8">
            {saves[i] ? (
              <Poster title={saves[i].title} path={saves[i].posterPath} size="sm" sizes="32px" className="rounded-md shadow-none" />
            ) : (
              <div className="aspect-[2/3] rounded-md border-2 border-dashed border-line" />
            )}
          </li>
        ))}
      </ol>
    </div>
  );
}
