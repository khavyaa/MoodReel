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
};

/** Lets what's under a poster (its buttons) mark it done, so the tick shows on the poster too. */
const MarkDone = createContext<((done: boolean) => void) | null>(null);
export const useMarkDone = () => useContext(MarkDone);

/** Springy: a little overshoot, then it settles. */
const SPRING = { type: "spring", stiffness: 260, damping: 21, mass: 0.9 } as const;
const GENTLE = { duration: 0.2 } as const;

/** Poster width by flow width: phone, tablet, laptop. */
const widthFor = (w: number) => (w < 640 ? 168 : w < 1024 ? 200 : 236);

const thumb = (item: FlowItem) =>
  !item.image ? null : item.round ? photoUrl(item.image, "sm") : imageUrl(item.image, "sm");

/**
 * Cover flow: one poster in front, its neighbours tilted away. Swipe or drag
 * it, use the arrows (or arrow keys), or tap a side poster to bring it
 * forward. What's under the front poster (`infos[i]`, often rendered on the
 * server) stays mounted for every poster, so buttons keep their state as you
 * browse. The page takes the front poster's tint. Reduce Motion drops the
 * tilt and the springs for quick fades.
 */
export function CoverFlow({
  items,
  infos,
  label,
  tint = true,
  className,
}: {
  items: FlowItem[];
  infos: ReactNode[];
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
  const setTint = useSetTint();
  const [info, animateInfo] = useAnimate();

  const last = items.length - 1;
  const step = width * (reduced ? 0.75 : 0.6);
  const current = Math.min(index, Math.max(0, last));
  const portraits = items.every((item) => item.round);

  useLayoutEffect(() => {
    const el = stage.current;
    if (!el) return;
    const measure = () => setWidth(widthFor(el.clientWidth));
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const go = useCallback(
    (target: number) => {
      const next = Math.max(0, Math.min(last, target));
      setIndex(next);
      setTouched(true);
      animate(pos, next, reduced ? GENTLE : SPRING);
    },
    [last, pos, reduced],
  );

  // A title removed from the list (Saved → Seen it) leaves the flow on a neighbour.
  // (`current` already stays in range; this slides the posters to match.)
  useEffect(() => {
    if (last >= 0 && pos.get() > last) animate(pos, last, reduced ? GENTLE : SPRING);
  }, [last, pos, reduced]);

  // The page wears the front poster's colour.
  const front = items[current];
  const src = front ? thumb(front) : null;
  useEffect(() => {
    if (!touched || !src) return;
    let live = true;
    tintOf(src).then((color) => live && color && setTint(color));
    return () => {
      live = false;
    };
  }, [src, touched, setTint]);

  useEffect(() => {
    if (!info.current || reduced) return;
    animateInfo(info.current, { opacity: [0.25, 1], y: [6, 0] }, { duration: 0.28, ease: "easeOut" });
  }, [current, info, animateInfo, reduced]);

  if (!items.length) return null;

  return (
    <section
      aria-roledescription="carousel"
      aria-label={label}
      className={cn("flex flex-col items-center gap-3 outline-none", className)}
      tabIndex={-1}
      onKeyDown={(e) => {
        if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
        if (e.key === "ArrowRight") go(current + 1);
        else if (e.key === "ArrowLeft") go(current - 1);
        else return;
        e.preventDefault();
      }}
    >
      <motion.div
        ref={stage}
        className="relative isolate w-full cursor-grab overflow-hidden select-none active:cursor-grabbing"
        style={{ height: (portraits ? width * 0.92 : width * 1.5) + 64, touchAction: "pan-y" }}
        onPanStart={() => {
          panned.current = true;
          panFrom.current = pos.get();
          setTouched(true);
        }}
        onPan={(_, p) => pos.set(Math.max(-0.45, Math.min(last + 0.45, panFrom.current - p.offset.x / step)))}
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
              onSelect={() => !panned.current && i !== current && go(i)}
            />
          ))}
        </ul>
      </motion.div>

      <div className="flex w-full max-w-xl flex-col items-center gap-3">
        <div ref={info} className="w-full">
          {items.map((item, i) => (
            <div key={item.key} hidden={i !== current} className="w-full">
              <MarkDone value={(d: boolean) => setDone((all) => ({ ...all, [item.key]: d }))}>{infos[i]}</MarkDone>
            </div>
          ))}
        </div>
        {items.length > 1 && (
          <div className="flex w-full items-center gap-3">
            <button
              type="button"
              onClick={() => go(current - 1)}
              disabled={current === 0}
              aria-label="Previous"
              className="grid size-10 shrink-0 place-items-center rounded-full border-2 border-line hover:bg-soft disabled:opacity-30"
            >
              <ChevronLeft className="size-5" aria-hidden />
            </button>
            <Strip count={items.length} current={current} onJump={go} />
            <button
              type="button"
              onClick={() => go(current + 1)}
              disabled={current === last}
              aria-label="Next"
              className="grid size-10 shrink-0 place-items-center rounded-full border-2 border-line hover:bg-soft disabled:opacity-30"
            >
              <ChevronRight className="size-5" aria-hidden />
            </button>
          </div>
        )}
        <p className="sr-only" aria-live="polite">
          {current + 1} of {items.length}: {front?.title}
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
  onSelect: () => void;
}) {
  const offset = useTransform(pos, (p) => i - p);
  const x = useTransform(offset, (o) => o * step);
  const rotateY = useTransform(offset, (o) => (reduced ? 0 : Math.max(-50, Math.min(50, -o * 38))));
  const scale = useTransform(offset, (o) => 1 - Math.min(Math.abs(o), 3) * (reduced ? 0.06 : 0.1));
  const opacity = useTransform(offset, (o) => (Math.abs(o) > 3.4 ? 0 : 1 - Math.abs(o) * 0.2));
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
        top: item.round && !portraits ? width * 0.3 : 16,
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
        {item.round ? (
          <Avatar
            name={item.title}
            photo={item.image}
            size="lg"
            className="block aspect-square h-auto w-full text-5xl shadow-[0_24px_48px_-24px_rgba(0,0,0,0.55)] sm:h-auto sm:w-full"
          />
        ) : (
          <Poster title={item.title} path={item.image} size="md" sizes={`${width}px`} priority={i < 3} className="rounded-xl" />
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

/** Where you are in the flow; tap a mark to jump. Long flows are grouped so marks stay tappable. */
function Strip({ count, current, onJump }: { count: number; current: number; onJump: (i: number) => void }) {
  const marks = Math.min(count, 30);
  const at = Math.round((current * (marks - 1)) / Math.max(1, count - 1));
  return (
    <div aria-hidden className="flex h-6 min-w-0 flex-1 items-center gap-1">
      {Array.from({ length: marks }, (_, m) => (
        <span
          key={m}
          onClick={() => onJump(Math.round((m * (count - 1)) / Math.max(1, marks - 1)))}
          className={cn(
            "h-1.5 flex-1 cursor-pointer rounded-full bg-current transition-[opacity,height] duration-300",
            m === at ? "h-3 opacity-100" : "opacity-25 hover:opacity-50",
          )}
        />
      ))}
    </div>
  );
}
