"use client";

import type { CSSProperties, ReactNode } from "react";
import { MOODS, type MoodId } from "@/lib/moods";
import { AppHeader } from "@/components/shell/app-header";
import { BottomNav } from "@/components/shell/bottom-nav";
import { cn } from "@/lib/cn";

/**
 * Same frame as AppFrame, but the mood is live: tapping a mood recolours the
 * whole screen, header and bottom bar included, as in the prototype. Given a
 * tint (tonight's pick), it wears the poster's colour instead. Immersive (the
 * deck and the head-to-head): exactly one screen tall, without the bottom tab
 * bar, so the card and its buttons always fit; the top bar still gets you out.
 */
export function FlowFrame({
  mood,
  tint = null,
  immersive = false,
  children,
}: {
  mood: MoodId;
  tint?: string | null;
  immersive?: boolean;
  children: ReactNode;
}) {
  const style = { "--m": MOODS[mood].color, "--mi": MOODS[mood].ink, ...(tint ? { "--t": tint } : {}) } as CSSProperties;
  // Tonight's pick fades from the mood into the winner's own colour (both classes transition the background).
  return (
    <div
      className={cn("flex flex-col", immersive ? "h-dvh max-h-dvh flex-none overflow-hidden" : "min-h-dvh flex-1", tint ? "tint-frame" : "mood")}
      data-tinted={tint ? "" : undefined}
      style={style}
    >
      <AppHeader />
      <main
        className={cn(
          "mx-auto flex w-full max-w-[1440px] flex-1 flex-col px-5 pt-5 sm:px-8 lg:px-12 lg:pt-8",
          immersive ? "min-h-0 pb-[max(0.75rem,env(safe-area-inset-bottom))] lg:pb-8" : "pb-28 lg:pb-12",
        )}
      >
        {children}
      </main>
      {!immersive && <BottomNav />}
    </div>
  );
}
