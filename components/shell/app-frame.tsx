import type { CSSProperties, ReactNode } from "react";
import { MOODS, type MoodId } from "@/lib/moods";
import { cn } from "@/lib/cn";
import { AppHeader } from "./app-header";
import { BottomNav } from "./bottom-nav";
import { TintFrame } from "@/components/flow/tint-frame";

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

  const content = (
    <>
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
    </>
  );
  // Mood screens wear the mood; the rest can take a poster's tint from a cover flow.
  if (mood) {
    return (
      <div className="mood flex min-h-dvh flex-1 flex-col" style={style}>
        {content}
      </div>
    );
  }
  return <TintFrame className="flex min-h-dvh flex-1 flex-col">{content}</TintFrame>;
}
