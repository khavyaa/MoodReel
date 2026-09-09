"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  AnimatePresence,
  motion,
  useMotionValue,
  useTransform,
  type PanInfo,
} from "framer-motion";
import { Bookmark, Check, Info, X } from "lucide-react";
import { MovieCard } from "@/components/movie-card";
import type { MovieActionType, MovieCard as MovieCardType } from "@/lib/types";
import { cn } from "@/lib/utils";

export type SwipeDirection = "left" | "right" | "up";

const DIRECTION_ACTION: Record<SwipeDirection, MovieActionType> = {
  left: "skipped",
  right: "liked",
  up: "watched",
};

/** Distance (px) or flick velocity that commits a swipe instead of springing back. */
const COMMIT_DISTANCE = 110;
const COMMIT_VELOCITY = 600;

export function SwipeDeck({
  movies,
  onAction,
  onOpenDetails,
  onExhausted,
}: {
  movies: MovieCardType[];
  onAction: (movie: MovieCardType, action: MovieActionType) => void;
  onOpenDetails: (movie: MovieCardType) => void;
  onExhausted?: () => void;
}) {
  const [index, setIndex] = useState(0);
  const [exitDirection, setExitDirection] = useState<SwipeDirection>("left");
  // A drag ends with a synthetic click; without this, every swipe would also
  // open the details page.
  const draggedRef = useRef(false);

  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const rotate = useTransform(x, [-320, 0, 320], [-16, 0, 16]);
  const likeOpacity = useTransform(x, [30, 130], [0, 1]);
  const skipOpacity = useTransform(x, [-130, -30], [1, 0]);
  const watchedOpacity = useTransform(y, [-130, -30], [1, 0]);

  const current = movies[index];
  const stack = movies.slice(index, index + 3);

  const commit = useCallback(
    (direction: SwipeDirection) => {
      const movie = movies[index];
      if (!movie) return;
      setExitDirection(direction);
      onAction(movie, DIRECTION_ACTION[direction]);
      setIndex((i) => i + 1);
      draggedRef.current = false;
      x.set(0);
      y.set(0);
      if (index === movies.length - 1) onExhausted?.();
    },
    [index, movies, onAction, onExhausted, x, y],
  );

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null;
      if (target && ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName)) return;
      if (!current) return;
      switch (event.key) {
        case "ArrowLeft":
          event.preventDefault();
          commit("left");
          break;
        case "ArrowRight":
          event.preventDefault();
          commit("right");
          break;
        case "ArrowUp":
          event.preventDefault();
          commit("up");
          break;
        case "Enter":
          event.preventDefault();
          onOpenDetails(current);
          break;
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [commit, current, onOpenDetails]);

  function handleDragEnd(_event: unknown, info: PanInfo) {
    const { offset, velocity } = info;
    if (offset.y < -COMMIT_DISTANCE || velocity.y < -COMMIT_VELOCITY) return commit("up");
    if (offset.x > COMMIT_DISTANCE || velocity.x > COMMIT_VELOCITY) return commit("right");
    if (offset.x < -COMMIT_DISTANCE || velocity.x < -COMMIT_VELOCITY) return commit("left");
    x.set(0);
    y.set(0);
  }

  const exitTarget = {
    left: { x: -600, y: 40, rotate: -22 },
    right: { x: 600, y: 40, rotate: 22 },
    up: { x: 0, y: -800, rotate: 0 },
  }[exitDirection];

  return (
    <div className="flex w-full flex-col items-center gap-5">
      <div className="deck-surface relative aspect-[2/3] w-full max-w-sm">
        <AnimatePresence initial={false}>
          {stack
            .map((movie, stackIndex) => {
              const isTop = stackIndex === 0;
              return (
                <motion.div
                  key={movie.id}
                  className={cn("absolute inset-0", isTop ? "z-20 cursor-grab active:cursor-grabbing" : "z-10")}
                  style={isTop ? { x, y, rotate } : undefined}
                  drag={isTop}
                  dragElastic={0.55}
                  dragMomentum={false}
                  onDragStart={isTop ? () => { draggedRef.current = true; } : undefined}
                  onDragEnd={isTop ? handleDragEnd : undefined}
                  onClick={
                    isTop
                      ? () => {
                          if (draggedRef.current) {
                            draggedRef.current = false;
                            return;
                          }
                          onOpenDetails(movie);
                        }
                      : undefined
                  }
                  initial={{ scale: 0.94, y: 16, opacity: 0 }}
                  animate={{
                    scale: 1 - stackIndex * 0.04,
                    y: stackIndex * 12,
                    opacity: 1,
                  }}
                  exit={{ ...exitTarget, opacity: 0, transition: { duration: 0.28 } }}
                  transition={{ type: "spring", stiffness: 320, damping: 32 }}
                >
                  <MovieCard movie={movie} priority={isTop} />

                  {isTop && (
                    <>
                      <SwipeBadge
                        label="Watchlist"
                        opacity={likeOpacity}
                        className="left-5 top-5 border-mint-glow/60 bg-mint-glow/15 text-mint-glow"
                      />
                      <SwipeBadge
                        label="Skip"
                        opacity={skipOpacity}
                        className="right-5 top-5 border-rose-glow/60 bg-rose-glow/15 text-rose-glow"
                      />
                      <SwipeBadge
                        label="Watched"
                        opacity={watchedOpacity}
                        className="left-1/2 top-5 -translate-x-1/2 border-ember-400/60 bg-ember-400/15 text-ember-300"
                      />
                    </>
                  )}
                </motion.div>
              );
            })
            // Paint the top card last so it sits above the stack without z-index churn.
            .reverse()}
        </AnimatePresence>
      </div>

      <div className="flex items-center gap-3" aria-label="Card actions">
        <ActionButton
          label="Skip"
          onClick={() => commit("left")}
          disabled={!current}
          className="border-rose-glow/30 text-rose-glow hover:bg-rose-glow/15"
        >
          <X className="size-6" aria-hidden />
        </ActionButton>
        <ActionButton
          label="Mark watched"
          onClick={() => commit("up")}
          disabled={!current}
          className="border-ember-400/30 text-ember-300 hover:bg-ember-400/15"
        >
          <Check className="size-6" aria-hidden />
        </ActionButton>
        <ActionButton
          label="Details"
          onClick={() => current && onOpenDetails(current)}
          disabled={!current}
          className="border-ink-700 text-ink-300 hover:bg-ink-850"
        >
          <Info className="size-6" aria-hidden />
        </ActionButton>
        <ActionButton
          label="Add to watchlist"
          onClick={() => commit("right")}
          disabled={!current}
          className="border-mint-glow/30 text-mint-glow hover:bg-mint-glow/15"
        >
          <Bookmark className="size-6" aria-hidden />
        </ActionButton>
      </div>

      <p className="text-center text-xs text-ink-400">
        Swipe or use <kbd className="font-mono">←</kbd> skip · <kbd className="font-mono">→</kbd>{" "}
        watchlist · <kbd className="font-mono">↑</kbd> watched · <kbd className="font-mono">↵</kbd>{" "}
        details
      </p>
      <p aria-live="polite" className="sr-only">
        {current
          ? `${current.title}. Card ${index + 1} of ${movies.length}.`
          : "No more cards in this deck."}
      </p>
    </div>
  );
}

function SwipeBadge({
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
        "pointer-events-none absolute rounded-xl border-2 px-3 py-1.5 text-sm font-bold uppercase tracking-widest backdrop-blur-sm",
        className,
      )}
    >
      {label}
    </motion.span>
  );
}

function ActionButton({
  label,
  children,
  className,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { label: string }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className={cn(
        "grid size-14 place-items-center rounded-full border bg-ink-900 transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ember-300 disabled:opacity-40",
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}
