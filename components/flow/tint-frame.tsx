"use client";

import { createContext, useContext, useState, type CSSProperties, type ReactNode } from "react";
import { cn } from "@/lib/cn";

const SetTint = createContext<(color: string | null) => void>(() => {});

/** Set the page's poster tint from inside a frame (a cover flow does, as you browse). */
export const useSetTint = () => useContext(SetTint);

/**
 * The frame's surface, ready to take a poster's tint (`.tint-frame` in
 * globals.css). Untinted until something inside sets one.
 */
export function TintFrame({ className, style, children }: { className?: string; style?: CSSProperties; children: ReactNode }) {
  const [tint, setTint] = useState<string | null>(null);
  return (
    <SetTint value={setTint}>
      <div
        className={cn("tint-frame", className)}
        data-tinted={tint ? "" : undefined}
        style={tint ? ({ ...style, "--t": tint } as CSSProperties) : style}
      >
        {children}
      </div>
    </SetTint>
  );
}
