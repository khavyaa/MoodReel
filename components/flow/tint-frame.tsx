"use client";

import { createContext, useContext, useState, type CSSProperties, type ReactNode } from "react";
import { cn } from "@/lib/cn";
import { BRAND_MOOD, MOODS } from "@/lib/moods";

/** Where every tinted page starts, and what it falls back to: the brand mood (Gripping), as a pale wash. */
export const BRAND_TINT = MOODS[BRAND_MOOD].color;

const SetTint = createContext<(color: string | null) => void>(() => {});

/** Set the page's poster tint from inside a frame (a cover flow does, as you browse). */
export const useSetTint = () => useContext(SetTint);

/**
 * The frame's surface in a tint (`.tint-frame` in globals.css): the brand's
 * until something inside sets another (a cover flow does, from the poster in
 * front), so no page is ever plain white.
 */
export function TintFrame({ className, style, children }: { className?: string; style?: CSSProperties; children: ReactNode }) {
  const [tint, setTint] = useState<string | null>(null);
  return (
    <SetTint value={setTint}>
      <div className={cn("tint-frame", className)} data-tinted="" style={{ ...style, "--t": tint ?? BRAND_TINT } as CSSProperties}>
        {children}
      </div>
    </SetTint>
  );
}
