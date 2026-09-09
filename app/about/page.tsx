import Link from "next/link";

export const metadata = {
  title: "About & credits",
  description: "Data sources, attribution and credits for MoodReel.",
};

export default function AboutPage() {
  return (
    <main className="mx-auto w-full max-w-lg flex-1 px-5 pb-16 pt-12">
      <Link href="/" className="font-mono text-xs uppercase tracking-[0.3em] text-ember-400">
        MoodReel
      </Link>
      <h1 className="mt-4 text-3xl font-semibold tracking-tight">About &amp; credits</h1>

      <section className="mt-8 space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-widest text-ink-400">
          What MoodReel is
        </h2>
        <p className="text-sm leading-relaxed text-ink-300">
          MoodReel is a mood-first movie recommender for English, Hindi and Tamil films. Pick a
          mood, swipe through a deck, and the films you have handled stop coming back.
        </p>
      </section>

      <section className="mt-8 space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-widest text-ink-400">
          TMDb attribution
        </h2>
        <div className="rounded-2xl border border-ink-800 bg-ink-900 p-5">
          <svg
            viewBox="0 0 273 35"
            role="img"
            aria-label="The Movie Database"
            className="h-6 w-auto"
          >
            <defs>
              <linearGradient id="tmdb" x1="0" x2="1" y1="0" y2="0">
                <stop offset="0%" stopColor="#90cea1" />
                <stop offset="56%" stopColor="#3cbec9" />
                <stop offset="100%" stopColor="#00b3e5" />
              </linearGradient>
            </defs>
            <rect width="273" height="35" rx="8" fill="url(#tmdb)" />
            <text
              x="136.5"
              y="23.5"
              textAnchor="middle"
              fill="#0d253f"
              fontFamily="system-ui, sans-serif"
              fontSize="15"
              fontWeight="700"
              letterSpacing="0.5"
            >
              THE MOVIE DATABASE
            </text>
          </svg>
          <p className="mt-4 text-sm leading-relaxed text-ink-300">
            This product uses the TMDb API but is not endorsed or certified by TMDb. All movie
            metadata, posters and backdrops are provided by{" "}
            <a
              href="https://www.themoviedb.org/"
              target="_blank"
              rel="noreferrer noopener"
              className="text-ember-300 underline underline-offset-4"
            >
              The Movie Database
            </a>
            .
          </p>
        </div>
        <p className="text-xs leading-relaxed text-ink-500">
          MoodReel stores only TMDb movie ids and your own actions. Titles, posters and ratings are
          fetched from TMDb and cached only briefly, in line with the TMDb API terms of use.
        </p>
      </section>

      <section className="mt-8 space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-widest text-ink-400">
          Streaming availability
        </h2>
        <p className="text-sm leading-relaxed text-ink-300">
          Where MoodReel shows where a film is streaming, that data comes from TMDb and is powered
          by{" "}
          <a
            href="https://www.justwatch.com/"
            target="_blank"
            rel="noreferrer noopener"
            className="text-ember-300 underline underline-offset-4"
          >
            JustWatch
          </a>
          . Availability varies by region and can be out of date.
        </p>
      </section>

      <section className="mt-8 space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-widest text-ink-400">
          Built with
        </h2>
        <ul className="grid gap-1.5 text-sm text-ink-300">
          <li>Next.js, TypeScript and Tailwind CSS</li>
          <li>Supabase for auth and per-user movie history</li>
          <li>Framer Motion for the swipe deck</li>
          <li>Lucide for icons</li>
        </ul>
      </section>

      <p className="mt-10 text-xs text-ink-500">
        MoodReel is a non-commercial personal project.{" "}
        <Link href="/app" className="underline underline-offset-4 hover:text-ink-300">
          Back to the app
        </Link>
      </p>
    </main>
  );
}
