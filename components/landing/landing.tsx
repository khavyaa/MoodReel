"use client";

import Link from "next/link";
import { CoverFlow } from "@/components/flow/cover-flow";
import { TintFrame } from "@/components/flow/tint-frame";
import { PasskeySignIn } from "@/components/auth/passkey-sign-in";
import { buttonClasses } from "@/components/ui/button";
import { MOODS, type MoodId } from "@/lib/moods";

type Story = { mood: MoodId; kicker: string; title: string; line: string; more: string; chips?: readonly string[] };

/** The story, a card at a time, each in a mood's colour (Gripping first, as the app opens). */
const STORY: Story[] = [
  {
    mood: "gripping",
    kicker: "MoodReel",
    title: "Three taps. One pick.",
    line: "Films, series and books for the mood you're in.",
    more: "Swipe a short deck, settle it head to head, and you're done.",
  },
  {
    mood: "mind",
    kicker: "Step 1",
    title: "Pick a mood",
    line: "Seven moods, an energy, and the time you have.",
    more: "Gripping tonight? Funny? Moving?",
    chips: ["Gripping", "Dark", "Funny", "Moving", "Feel-good"],
  },
  {
    mood: "dark",
    kicker: "Step 2",
    title: "Swipe a short deck",
    line: "Fifteen titles that fit, not a wall of them.",
    more: "Save, skip, seen it, not for me. It learns as you go.",
    chips: ["← Skip", "Save →"],
  },
  {
    mood: "funny",
    kicker: "Step 3",
    title: "One pick",
    line: "Your saves go head to head.",
    more: "The winner, where to watch it, and why it won.",
    chips: ["Tonight's pick"],
  },
  {
    mood: "feelgood",
    kicker: "Books on screen",
    title: "Read it? Watch it",
    line: "Films of books you've read come first.",
    more: "With the book right there on the card.",
  },
  {
    mood: "moving",
    kicker: "People",
    title: "Who you watch for",
    line: "Follow directors, actors and authors.",
    more: "Or deal a whole deck from one of them.",
  },
  {
    mood: "romantic",
    kicker: "Lists",
    title: "Worth getting through",
    line: "Oscar, Palme d'Or and Booker winners, and more.",
    more: "Your progress on each, and decks straight from them.",
  },
];

/**
 * The landing page: one screen, no scrolling. The story turns as a cover
 * flow, the same one the app uses, and the page takes each card's mood
 * colour. Signing in is a passkey; there's no sign-up anywhere.
 */
export function Landing() {
  return (
    <TintFrame className="flex h-dvh flex-col overflow-hidden">
      <header className="mx-auto flex w-full max-w-[1440px] items-center justify-between gap-4 px-5 pt-[max(1rem,env(safe-area-inset-top))] sm:px-8 lg:px-12 lg:pt-6">
        <span className="display text-[22px] leading-none sm:text-[26px]">MoodReel</span>
        <Link href="/sign-in" className={buttonClasses("outline", "sm")}>
          Sign in
        </Link>
      </header>
      <main className="mx-auto flex min-h-0 w-full max-w-[1440px] flex-1 flex-col gap-3 px-5 pt-2 pb-[max(1.25rem,env(safe-area-inset-bottom))] sm:px-8 lg:px-12 lg:pb-8">
        <h1 className="sr-only">MoodReel: three taps, one pick. Films, series and books for the mood you&apos;re in.</h1>
        <CoverFlow
          fit
          loop
          autoplay={4000}
          label="What MoodReel does"
          items={STORY.map((s) => ({ key: s.mood, title: s.title, image: null, colour: MOODS[s.mood].color }))}
          faces={STORY.map((s) => (
            <StoryCard key={s.mood} story={s} />
          ))}
          infos={STORY.map((s) => (
            <div key={s.mood} className="flex flex-col items-center gap-0.5 text-center">
              <p className="text-lg leading-snug font-bold">{s.line}</p>
              <p className="text-muted">{s.more}</p>
            </div>
          ))}
        />
        <PasskeySignIn label="Sign in with your passkey" centred />
      </main>
    </TintFrame>
  );
}

function StoryCard({ story }: { story: Story }) {
  const mood = MOODS[story.mood];
  return (
    <div className="flex size-full flex-col justify-between p-[7%] text-left" style={{ background: mood.color, color: mood.ink }}>
      <span className="label opacity-80">{story.kicker}</span>
      <span className="display text-[clamp(1.6rem,2.6vw,2.4rem)]">{story.title}</span>
      <span className="flex min-h-6 flex-wrap gap-1">
        {story.chips?.map((chip) => (
          <span key={chip} className="rounded-full border px-2 py-0.5 text-[10px] font-semibold" style={{ borderColor: mood.ink }}>
            {chip}
          </span>
        ))}
      </span>
    </div>
  );
}
