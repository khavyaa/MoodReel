import type { CSSProperties } from "react";
import { BRAND_MOOD, MOODS } from "@/lib/moods";

/*
 * Sign-in and setup share one screen: on a laptop the brand line fills the left
 * and the action sits on the right; on a phone they stack. Never a centred card.
 */
export default function AuthLayout({ children }: LayoutProps<"/">) {
  const mood = MOODS[BRAND_MOOD];
  return (
    <main
      className="mood flex-1 grid min-h-dvh lg:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)]"
      style={{ "--m": mood.color, "--mi": mood.ink } as CSSProperties}
    >
      <section className="flex flex-col justify-between gap-10 px-6 pt-[max(2rem,env(safe-area-inset-top))] pb-8 sm:px-10 lg:px-16 lg:py-14">
        <span className="display text-3xl">MoodReel</span>
        <h1 className="display text-[clamp(4rem,11vw,10rem)]">Three taps. One pick.</h1>
        <p className="max-w-[46ch] text-lg text-muted">
          Movies, series and books for the mood you&apos;re in. Swipe a short deck, settle it head to
          head, and you&apos;re done.
        </p>
      </section>
      <section className="flex flex-col justify-center gap-6 border-t border-line px-6 py-10 pb-[max(2.5rem,env(safe-area-inset-bottom))] sm:px-10 lg:border-t-0 lg:border-l lg:px-16">
        {children}
      </section>
    </main>
  );
}
