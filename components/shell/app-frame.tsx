import type { CSSProperties, ReactNode } from "react";
import { MOODS, type MoodId } from "@/lib/moods";
import { cn } from "@/lib/cn";
import { AppHeader } from "./app-header";
import { BottomNav } from "./bottom-nav";

/*
 * The frame every signed-in screen sits in. Given a mood, the whole frame,
 * header included, becomes the mood surface (bold & playful) or takes the mood
 * as its accent (cinematic dark). Laptop: one header row with everything.
 * iPhone: a slim header plus a bottom bar in thumb reach.
 */
export function AppFrame({
  mood,
  children,
  className,
}: {
  mood?: MoodId;
  children: ReactNode;
  className?: string;
}) {
  const style = mood
    ? ({ "--m": MOODS[mood].color, "--mi": MOODS[mood].ink } as CSSProperties)
    : undefined;

  return (
    <div className={cn("flex min-h-dvh flex-1 flex-col", mood && "mood")} style={style}>
      <AppHeader />
      <main
        className={cn(
          "mx-auto flex w-full max-w-[1440px] flex-1 flex-col px-5 pt-6 pb-28 sm:px-8 lg:px-12 lg:pt-10 lg:pb-14",
          className,
        )}
      >
        {children}
      </main>
      <BottomNav />
    </div>
  );
}
