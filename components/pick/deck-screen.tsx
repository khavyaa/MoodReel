"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, animate, motion, useMotionValue, useReducedMotion, useTransform } from "motion/react";
import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp, Award, Check, Heart, Star, Undo2 } from "lucide-react";
import { PeopleLine } from "@/components/people/people-line";
import { DECK_SIZE } from "@/lib/deck/compose";
import { LinkStrip, knownLabel } from "./title-link";
import type { DeckCard } from "@/lib/deck/build-movies";
import { MAX_SAVES } from "@/lib/deck/finale";
import { airingLabel, bestsellerLabel, cardMeta, makersLabel, ratingCountLabel, ratingScale } from "@/lib/card-meta";
import { cn } from "@/lib/cn";
import { Poster } from "./poster";
import { DetailsButton } from "@/components/library/title-details";
import { usePosterColour } from "@/components/flow/use-poster-colour";

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
  /** A swipe, and for Seen it the stars, if you gave any. */
  onSwipe: (action: SwipeAction, stars?: number) => void;
  onUndo: (() => void) | null;
  /** Dealt from one person's work. */
  fromName?: string | null;
}) {
  const card = cards[index];
  // Seen it holds the card in front with stars over it: a star rates it and sends it off,
  // any other action sends it off unrated, and Undo just closes the stars.
  const [rating, setRating] = useState<number | null>(null);
  const holding = rating !== null && rating === card?.id;
  const swipe = useCallback(
    (action: SwipeAction) => {
      if (holding) {
        setRating(null);
        onSwipe("seen");
        return;
      }
      if (action === "seen" && card) {
        setRating(card.id);
        return;
      }
      onSwipe(action);
    },
    [holding, card, onSwipe],
  );
  const undo = useMemo(() => (holding ? () => setRating(null) : onUndo), [holding, onUndo]);
  const rate = useCallback(
    (stars: number) => {
      if (!card) return;
      setRating(null);
      onSwipe("seen", stars);
    },
    [card, onSwipe],
  );

  // Keys on a laptop: arrows to swipe, Z or ⌘Z to undo. Ignored while typing.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const target = e.target as HTMLElement | null;
      if (target?.closest("input, textarea, select, [contenteditable]")) return;
      if (e.key.toLowerCase() === "z" && !e.altKey && !e.shiftKey) {
        if (undo) {
          e.preventDefault();
          undo();
        }
        return;
      }
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      // Stars over a card just marked seen: 1 to 5 rate it.
      if (holding && /^[1-5]$/.test(e.key)) {
        e.preventDefault();
        rate(Number(e.key));
        return;
      }
      const action = KEYS[e.key];
      if (action) {
        e.preventDefault();
        swipe(action);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [swipe, undo, holding, rate]);

  if (!card) return null;

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3 lg:gap-6">
      {fromName && <p className="label -mb-2 text-muted">From {fromName}</p>}
      <Progress total={cards.length} index={index} saves={saves} />
      {index === 0 && cards.length < DECK_SIZE && (
        <p role="status" className="text-sm text-muted">
          {cards.length === 1 ? "Only one fits" : `Only ${cards.length} fit`} {fromName ? `from ${fromName}` : "tonight"}: everything else
          that matches is seen, saved or turned down, or outside your rules.
        </p>
      )}
      {missingLanguages.length > 0 && (
        <p role="status" className="rounded-2xl bg-soft px-4 py-2 text-sm">
          Couldn&apos;t load {missingLanguages.join(", ")} films this time, so they&apos;re missing from this deck.
        </p>
      )}

      {/* The card is sized from the screen's height, so card, details and buttons fit one screen. */}
      <div className="grid min-h-0 flex-1 content-center items-center gap-4 lg:grid-cols-[auto_minmax(0,1fr)] lg:gap-14">
        {/*
          The pile: the next two cards sit underneath, already loaded. When the
          top card leaves, they slide forward instead of a new card popping in.
        */}
        <div className="relative isolate mx-auto aspect-[2/3] w-[min(72vw,280px,calc((100dvh-26rem)*2/3))] lg:mx-0 lg:w-[min(380px,calc((100dvh-19rem)*2/3))]">
          <PosterGlow path={card.posterPath} />
          <AnimatePresence custom={exitAs} initial={false}>
            {cards
              .slice(index, index + PILE)
              .map((c, depth) => (
                <SwipeCard
                  key={c.id}
                  card={c}
                  depth={depth}
                  returnFrom={returning?.id === c.id ? returning.action : null}
                  onSwipe={swipe}
                  rating={depth === 0 && holding}
                  onRate={rate}
                />
              ))
              .reverse()}
          </AnimatePresence>
        </div>

        <CardInfo key={card.id} card={card} />
      </div>

      <div className="mt-auto flex flex-col gap-2 lg:mt-0 lg:flex-row lg:items-center lg:gap-3">
        <div className="grid grid-cols-[1fr_1fr_1fr_1.25fr] gap-2 lg:flex lg:gap-3">
          <ActionButton label="Skip" hint="←" icon={<ArrowLeft className="size-5" aria-hidden />} onClick={() => swipe("skipped")} />
          <ActionButton label="Not for me" hint="↓" icon={<ArrowDown className="size-5" aria-hidden />} onClick={() => swipe("disliked")} />
          <ActionButton
            label={card.media === "book" ? "Read it" : "Seen it"}
            hint="↑"
            icon={<ArrowUp className="size-5" aria-hidden />}
            onClick={() => swipe("seen")}
          />
          <ActionButton label="Save" hint="→" icon={<ArrowRight className="size-5" aria-hidden />} onClick={() => swipe("saved")} primary />
        </div>
        <div className="flex min-h-9 items-center justify-between gap-4 lg:ml-auto">
          <p className="hidden text-xs text-muted sm:block lg:hidden">Skip brings it back in a couple of months. Not for me never does.</p>
          <button
            type="button"
            onClick={undo ?? undefined}
            disabled={!undo}
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
  rating,
  onRate,
}: {
  card: DeckCard;
  depth: number;
  returnFrom: SwipeAction | null;
  onSwipe: (a: SwipeAction) => void;
  /** Marked seen: stars over the card until you rate it or move on. */
  rating: boolean;
  onRate: (stars: number) => void;
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
          if (action === "seen" && !rating) {
            // Seen it keeps the card here, with stars over it.
            animate(x, 0, SETTLE);
            animate(y, 0, SETTLE);
            onSwipe(action);
          } else if (action) {
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
        {rating && <RateOverlay title={card.title} book={card.media === "book"} onRate={onRate} />}
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
    // A phone shows the essentials (facts, title, badges) and keeps the synopsis and people behind More,
    // so the card and its buttons fit one screen; a laptop shows everything beside the card.
    <div className="flex min-w-0 flex-col gap-2 lg:gap-4">
      <p className="label truncate text-muted">{cardMeta(card)}</p>
      <h2 className="display line-clamp-2 text-[clamp(1.9rem,min(8vw,5dvh),2.75rem)] lg:line-clamp-none lg:text-[clamp(2.25rem,min(6vw,9dvh),5.5rem)]">
        {card.title}
      </h2>
      {card.book && card.people.length > 0 && (
        <PeopleLine people={card.people} followedName={card.followedName} className="-mt-1 hidden lg:flex" />
      )}
      {card.book && people && <p className={cn("-mt-1 truncate font-bold lg:text-lg", card.people.length > 0 && "lg:hidden")}>{people}</p>}
      {!card.book && card.originalTitle !== card.title && <p className="-mt-1 hidden text-sm text-muted lg:block">{card.originalTitle}</p>}

      <div className="flex max-h-[4.25rem] flex-wrap gap-2 overflow-hidden lg:max-h-none">
        <Badge>
          <Star className="size-3.5 fill-current" aria-hidden />
          {card.rating.toFixed(1)}
          <span className="font-normal opacity-70">
            {ratingScale(card)} · {ratingCountLabel(card)}
          </span>
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
        {knownLabel(card.link) && <Badge strong>{knownLabel(card.link)}</Badge>}
        {card.listName && (
          <Badge strong>
            <Award className="size-3.5" aria-hidden /> On {card.listName}
          </Badge>
        )}
      </div>
      <DetailsButton card={card} media={card.media} id={card.id} title={card.title} className="self-start text-sm font-bold underline underline-offset-4 lg:hidden">
        More about it
      </DetailsButton>
      <div className="hidden min-w-0 flex-col gap-4 lg:flex">
        {card.link && <LinkStrip link={card.link} />}
        {card.genres.length > 0 && <p className="text-sm text-muted">{card.genres.slice(0, 4).join(" · ")}</p>}
        <Overview text={card.overview} />
        {card.series?.firstSeasonEpisodes ? <p className="text-sm text-muted">Season 1: {card.series.firstSeasonEpisodes} episodes</p> : null}
        {!card.book && card.people.length > 0 && <PeopleLine people={card.people} followedName={card.followedName} />}
      </div>
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

/**
 * A soft halo of the top card's colour behind the pile. The mood stays the
 * page's colour; only the light behind the card changes as you swipe.
 */
function PosterGlow({ path }: { path: string | null }) {
  const colour = usePosterColour(path);
  return (
    <motion.div
      aria-hidden
      className="pointer-events-none absolute -inset-[16%] -z-10 rounded-[50%] blur-[48px]"
      initial={false}
      animate={{ backgroundColor: colour ?? "rgba(0,0,0,0)", opacity: colour ? 0.7 : 0 }}
      transition={{ duration: 0.7, ease: "easeOut" }}
    />
  );
}

/** Over a card just marked seen: how was it? A star rates it (and sends it off); any other swipe moves on unrated. */
function RateOverlay({ title, book, onRate }: { title: string; book: boolean; onRate: (stars: number) => void }) {
  const [shown, setShown] = useState(0);
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="absolute inset-0 flex flex-col items-center justify-center gap-2 rounded-2xl bg-black/70 text-white"
      onPointerDown={(e) => e.stopPropagation()}
    >
      <span className="label opacity-90">{book ? "Read" : "Seen"} · how was it?</span>
      <div role="group" aria-label={`Rate ${title}`} className="flex">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            aria-label={`${n} star${n > 1 ? "s" : ""}`}
            disabled={shown > 0}
            onClick={() => {
              setShown(n);
              setTimeout(() => onRate(n), 350);
            }}
            className="p-1 sm:p-1.5"
          >
            <Star className={cn("size-6 transition-transform sm:size-8", n <= shown ? "scale-110 fill-current" : "opacity-60")} aria-hidden />
          </button>
        ))}
      </div>
      <span className="text-xs opacity-75">
        or keep swiping<span className="hidden lg:inline"> · 1–5 on the keyboard</span>
      </span>
    </motion.div>
  );
}
