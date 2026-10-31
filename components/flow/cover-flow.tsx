"use client";

import { createContext, useCallback, useContext, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { animate, motion, useAnimate, useMotionValue, useReducedMotion, useTransform, type MotionValue } from "motion/react";
import { Check, ChevronLeft, ChevronRight } from "lucide-react";
import { Poster, imageUrl } from "@/components/pick/poster";
import { Avatar, photoUrl } from "@/components/people/avatar";
import { tintOf } from "@/lib/tint";
import { cn } from "@/lib/cn";
import { useSetTint } from "./tint-frame";

export type FlowItem = {
  key: string;
  title: string;
  /** A poster path ("/x.jpg", "ol:123"), or a person's photo ref when `round`. */
  image: string | null;
  /** People: a round photo instead of a poster. */
  round?: boolean;
  /** A small label on the poster ("Won 2020", "Part 2"). */
  badge?: string | null;
  /** Seen, read or finished: a tick, and the poster goes quiet. */
  done?: boolean;
  /** The page's tint for this item, when it has no image to take one from. */
  colour?: string;
};

/**
 * What's under a poster can reach its flow: mark the poster done (the tick
 * shows on it too) and move the flow on to the next card once you've acted.
 */
type FlowItemControls = { markDone: (done: boolean) => void; advance: () => void };
const FlowItemContext = createContext<FlowItemControls | null>(null);
export const useMarkDone = () => useContext(FlowItemContext)?.markDone ?? null;
export const useAdvance = () => useContext(FlowItemContext)?.advance ?? null;

/** How long an action's result shows before the next card comes forward. */
export const ADVANCE_AFTER = 450;
/** Posters this far from the front load their images; the rest wait their turn. */
const NEAR = 6;

/** Springy: a little overshoot, then it settles. */
const SPRING = { type: "spring", stiffness: 260, damping: 21, mass: 0.9 } as const;
const GENTLE = { duration: 0.2 } as const;

/** Poster width by flow width: phone, tablet, laptop. */
const widthFor = (w: number) => (w < 640 ? 168 : w < 1024 ? 200 : 236);
/** A flow that fills the room (the landing page) can take bigger cards when the room allows. */
const roomyWidthFor = (w: number) => (w < 640 ? 200 : w < 1024 ? 250 : 300);

const thumb = (item: FlowItem) =>
  !item.image ? null : item.round ? photoUrl(item.image, "sm") : imageUrl(item.image, "sm");

/**
 * Cover flow: one poster in front, its neighbours tilted away. Swipe or drag
 * it, use the arrows (or arrow keys), or tap a side poster to bring it
 * forward. What's under the front poster (`infos[i]`, often rendered on the
 * server) stays mounted for every poster, so buttons keep their state as you
 * browse. The page takes the front poster's tint. Reduce Motion drops the
 * tilt and the springs for quick fades.
 *
 * Long lists come a page at a time: `total` is how many there are in all,
 * and `onNearEnd` asks for more as you near the end of what's loaded, so the
 * flow (and the strip, "12 of 87") runs through everything with no page numbers.
 *
 * The landing page uses it too: `faces` in place of posters, `autoplay` to
 * turn by itself (waiting a while after you touch it), and `fit` to size the
 * cards to the room there is, so the page never scrolls.
 */
export function CoverFlow({
  items,
  infos,
  label,
  tint = true,
  faces,
  autoplay,
  fit = false,
  loop = false,
  total,
  onNearEnd,
  className,
}: {
  items: FlowItem[];
  infos: ReactNode[];
  /** Cards to show in place of posters. */
  faces?: ReactNode[];
  /** Turn to the next card every this many milliseconds, round and round, until you take over. */
  autoplay?: number;
  /** Fill the height it's given and size the cards to fit it. */
  fit?: boolean;
  /** Round and round: the last card sits before the first, so the front one always has neighbours both sides. */
  loop?: boolean;
  /** How many there are in all, when only some are loaded. */
  total?: number;
  /** Called as you near the end of what's loaded (the caller loads more and passes them in). */
  onNearEnd?: () => void;
  /** Names the list of posters ("Saved titles"). */
  label: string;
  /** Whether this flow tints the page before you touch it (the first flow on a page does). */
  tint?: boolean;
  className?: string;
}) {
  const reduced = useReducedMotion() ?? false;
  const stage = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(168);
  const [index, setIndex] = useState(0);
  const [done, setDone] = useState<Record<string, boolean>>({});
  const [touched, setTouched] = useState(tint);
  const pos = useMotionValue(0);
  const panned = useRef(false);
  const panFrom = useRef(0);
  const touchedAt = useRef(0);
  const setTint = useSetTint();
  const [info, animateInfo] = useAnimate();

  const last = items.length - 1;
  const step = width * (reduced ? 0.75 : 0.6);
  const wrap = (n: number) => ((n % items.length) + items.length) % items.length;
  // Looping, `index` keeps counting past the end (so the turn is always forward); `current` is the card.
  const current = loop ? wrap(index) : Math.min(index, Math.max(0, last));
  const portraits = items.every((item) => item.round);

  useLayoutEffect(() => {
    const el = stage.current;
    if (!el) return;
    const measure = () =>
      setWidth(fit ? Math.max(110, Math.min(roomyWidthFor(el.clientWidth), (el.clientHeight - 48) / 1.5)) : widthFor(el.clientWidth));
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, [fit]);

  const go = useCallback(
    (target: number, byItself = false) => {
      const next = loop ? target : Math.max(0, Math.min(last, target));
      setIndex(next);
      setTouched(true);
      if (!byItself) touchedAt.current = Date.now();
      animate(pos, next, reduced ? GENTLE : SPRING);
    },
    [last, pos, reduced, loop],
  );
  /** One card on (or back), or straight to card `i` (the short way round when looping). */
  const move = (by: number) => go((loop ? index : current) + by);
  const show = (i: number) => {
    if (!loop) return go(i);
    const ahead = wrap(i - current);
    go(index + (ahead > items.length / 2 ? ahead - items.length : ahead));
  };

  // Turning by itself: round and round, resting for a while after you've touched it. Never under Reduce Motion.
  useEffect(() => {
    if (!autoplay || reduced || last < 1) return;
    const timer = setInterval(() => {
      if (Date.now() - touchedAt.current < autoplay * 2.4) return;
      go(loop ? index + 1 : current === last ? 0 : current + 1, true);
    }, autoplay);
    return () => clearInterval(timer);
  }, [autoplay, reduced, last, current, index, loop, go]);

  // A title removed from the list (Saved → Seen it) leaves the flow on a neighbour.
  // (`current` already stays in range; this slides the posters to match.)
  useEffect(() => {
    if (!loop && last >= 0 && pos.get() > last) animate(pos, last, reduced ? GENTLE : SPRING);
  }, [last, pos, reduced, loop]);

  useEffect(() => {
    if (onNearEnd && items.length < (total ?? 0) && current >= items.length - NEAR) onNearEnd();
  }, [onNearEnd, current, items.length, total]);

  // The page wears the front poster's colour (not a person's photo: those stay in the brand tint).
  const front = items[current];
  const src = front && !front.round ? thumb(front) : null;
  const given = front?.colour ?? null;
  useEffect(() => {
    if (!touched) return;
    if (given) return setTint(given);
    if (!src) return;
    let live = true;
    tintOf(src).then((color) => live && color && setTint(color));
    return () => {
      live = false;
    };
  }, [src, given, touched, setTint]);

  // Moving with the keyboard: focus follows the poster in front, not the one that just slid aside.
  useEffect(() => {
    const posters = stage.current;
    if (!posters || !posters.contains(document.activeElement)) return;
    posters.querySelector<HTMLButtonElement>('button[aria-current="true"]')?.focus({ preventScroll: true });
  }, [current]);

  useEffect(() => {
    if (!info.current || reduced) return;
    animateInfo(info.current, { opacity: [0.25, 1], y: [6, 0] }, { duration: 0.28, ease: "easeOut" });
  }, [current, info, animateInfo, reduced]);

  if (!items.length) return null;

  return (
    <section
      aria-roledescription="carousel"
      aria-label={label}
      className={cn("flex flex-col items-center gap-3 outline-none", fit && "min-h-0 flex-1", className)}
      tabIndex={-1}
      onKeyDown={(e) => {
        if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
        if (e.key === "ArrowRight") move(1);
        else if (e.key === "ArrowLeft") move(-1);
        else return;
        e.preventDefault();
      }}
    >
      <motion.div
        ref={stage}
        className={cn(
          "relative isolate w-full cursor-grab overflow-hidden select-none active:cursor-grabbing",
          fit && "min-h-0 flex-1",
        )}
        style={fit ? { touchAction: "pan-y" } : { height: (portraits ? width * 0.92 : width * 1.5) + 64, touchAction: "pan-y" }}
        onPanStart={() => {
          panned.current = true;
          panFrom.current = pos.get();
          setTouched(true);
        }}
        onPan={(_, p) => {
          const at = panFrom.current - p.offset.x / step;
          pos.set(loop ? at : Math.max(-0.45, Math.min(last + 0.45, at)));
        }}
        onPanEnd={(_, p) => {
          go(Math.round(panFrom.current - (p.offset.x + p.velocity.x * 0.18) / step));
          // The click that ends a drag isn't a tap on a poster.
          setTimeout(() => (panned.current = false), 0);
        }}
      >
        <ul aria-label={label} className="absolute inset-0">
          {items.map((item, i) => (
            <Card
              key={item.key}
              item={item}
              i={i}
              pos={pos}
              step={step}
              width={width}
              reduced={reduced}
              front={i === current}
              done={done[item.key] ?? item.done ?? false}
              portraits={portraits}
              face={faces?.[i]}
              near={Math.abs(i - current) <= NEAR || (loop && items.length - Math.abs(i - current) <= NEAR)}
              centred={fit}
              loop={loop ? items.length : 0}
              onSelect={() => !panned.current && i !== current && show(i)}
            />
          ))}
        </ul>
      </motion.div>

      <div className="flex w-full max-w-xl flex-col items-center gap-3">
        <div ref={info} className="w-full">
          {items.map((item, i) => (
            <div key={item.key} hidden={i !== current} className="w-full">
              <FlowItemContext
                value={{
                  markDone: (d: boolean) => setDone((all) => ({ ...all, [item.key]: d })),
                  advance: () => setTimeout(() => move(1), ADVANCE_AFTER),
                }}
              >
                {infos[i]}
              </FlowItemContext>
            </div>
          ))}
        </div>
        {items.length > 1 && (
          <div className="flex w-full items-center gap-3">
            <button
              type="button"
              onClick={() => move(-1)}
              disabled={!loop && current === 0}
              aria-label="Previous"
              className="grid size-11 shrink-0 place-items-center rounded-full border-2 border-line hover:bg-soft disabled:opacity-30"
            >
              <ChevronLeft className="size-5" aria-hidden />
            </button>
            <Strip count={total ?? items.length} loaded={items.length} current={current} onJump={show} />
            <button
              type="button"
              onClick={() => move(1)}
              disabled={!loop && current === last}
              aria-label="Next"
              className="grid size-11 shrink-0 place-items-center rounded-full border-2 border-line hover:bg-soft disabled:opacity-30"
            >
              <ChevronRight className="size-5" aria-hidden />
            </button>
          </div>
        )}
        <p className="text-xs font-semibold text-muted" aria-live="polite">
          {current + 1} of {(total ?? items.length).toLocaleString("en-IN")}
          <span className="sr-only">: {front?.title}</span>
        </p>
      </div>
    </section>
  );
}

function Card({
  item,
  i,
  pos,
  step,
  width,
  reduced,
  front,
  done,
  portraits,
  face,
  centred,
  loop,
  near,
  onSelect,
}: {
  item: FlowItem;
  i: number;
  pos: MotionValue<number>;
  step: number;
  width: number;
  reduced: boolean;
  front: boolean;
  done: boolean;
  portraits: boolean;
  face?: ReactNode;
  /** Close enough to the front to load its image. */
  near: boolean;
  /** Sit in the middle of the stage's height (a flow that fills the room) rather than at its top. */
  centred: boolean;
  /** Looping, how many cards go round (0 when not): each sits on whichever side of the front is nearer. */
  loop: number;
  onSelect: () => void;
}) {
  const offset = useTransform(pos, (p) => (loop ? ((((i - p + loop / 2) % loop) + loop) % loop) - loop / 2 : i - p));
  const x = useTransform(offset, (o) => o * step);
  const rotateY = useTransform(offset, (o) => (reduced ? 0 : Math.max(-50, Math.min(50, -o * 38))));
  const scale = useTransform(offset, (o) => 1 - Math.min(Math.abs(o), 3) * (reduced ? 0.06 : 0.1));
  // Looping, two neighbours a side, so the ring never shows its seam.
  // The nearest neighbours stay solid (one never shows through another); further out they fade.
  const opacity = useTransform(offset, (o) => {
    const away = Math.abs(o);
    return away > (loop ? 2.6 : 3.4) ? 0 : away <= 1.2 ? 1 : 1 - (away - 1.2) * 0.4;
  });
  const zIndex = useTransform(offset, (o) => 100 - Math.round(Math.abs(o) * 10));
  const size = item.round ? width * 0.92 : width;

  return (
    <motion.li
      style={{
        x,
        rotateY,
        scale,
        opacity,
        zIndex,
        transformPerspective: 900,
        width: size,
        marginLeft: -size / 2,
        // A portrait among posters sits at their middle; a row of portraits needs no room for posters.
        top: centred ? `calc(50% - ${(width * 1.5) / 2}px)` : item.round && !portraits ? width * 0.3 : 16,
      }}
      className="absolute left-1/2"
    >
      <button
        type="button"
        onClick={onSelect}
        aria-label={`Show ${item.title}`}
        aria-current={front ? "true" : undefined}
        tabIndex={front ? 0 : -1}
        className={cn("relative block w-full transition-[filter] duration-500", done && "saturate-[.45]")}
      >
        {face ? (
          <div className="aspect-[2/3] w-full overflow-hidden rounded-2xl shadow-[0_24px_48px_-24px_rgba(0,0,0,0.55)]">{face}</div>
        ) : item.round ? (
          <Avatar
            name={item.title}
            photo={item.image}
            size="lg"
            className="block aspect-square h-auto w-full text-5xl shadow-[0_24px_48px_-24px_rgba(0,0,0,0.55)] sm:h-auto sm:w-full"
          />
        ) : (
          <Poster title={item.title} path={near ? item.image : null} size="md" sizes={`${width}px`} priority={i < 3} className="rounded-xl" />
        )}
        {item.badge && (
          <span className="absolute top-2 left-2 rounded-full bg-raised px-2 py-0.5 text-[11px] font-bold text-fg">
            {item.badge}
          </span>
        )}
        <motion.span
          aria-hidden
          initial={false}
          animate={{ scale: done ? 1 : 0 }}
          transition={reduced ? GENTLE : { type: "spring", stiffness: 520, damping: 16 }}
          className={cn(
            "absolute grid size-7 place-items-center rounded-full bg-raised text-fg",
            item.round ? "right-[8%] bottom-[8%]" : "top-2 right-2",
          )}
        >
          <Check className="size-4" />
        </motion.span>
      </button>
    </motion.li>
  );
}

/**
 * Where you are in everything (not only what's loaded); tap a mark to jump.
 * Long flows are grouped so marks stay tappable. A jump past what's loaded goes
 * as far as there is, and the rest loads from there.
 */
function Strip({ count, loaded, current, onJump }: { count: number; loaded: number; current: number; onJump: (i: number) => void }) {
  const marks = Math.min(count, 30);
  const at = Math.round((current * (marks - 1)) / Math.max(1, count - 1));
  return (
    <div aria-hidden className="flex h-6 min-w-0 flex-1 items-center gap-1">
      {Array.from({ length: marks }, (_, m) => (
        <span
          key={m}
          onClick={() => onJump(Math.min(loaded - 1, Math.round((m * (count - 1)) / Math.max(1, marks - 1))))}
          className={cn(
            "h-1.5 flex-1 cursor-pointer rounded-full bg-current transition-[opacity,height] duration-300",
            m === at ? "h-3 opacity-100" : "opacity-25 hover:opacity-50",
          )}
        />
      ))}
    </div>
  );
}
