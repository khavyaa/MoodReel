# MoodReel

A personal tool for deciding what to watch or read. Three taps (mood, energy, time), a short
swipe deck, a head-to-head between your favourites, and one pick: tonight's movie or series, or
the next book.

Built for one person on an iPhone and a Mac. Sign-in is a passkey; there is no sign-up page.

> **Status:** Phase 4 of the v2 rebuild. Movies, series and books work end to end: taps → deck →
> head-to-head → tonight's pick (or "Read next"), plus Saved (with "Pick from my saved"), History
> with ratings, a "Did you watch it?" check after a film, and Watching / Reading lists with
> check-ins for series and books.

## Run it locally

You need Node 24+ and Docker.

```bash
docker compose up -d          # Postgres 17 on localhost:5433
cp .env.example .env.local    # then fill in BETTER_AUTH_SECRET and OWNER_SETUP_TOKEN
npm install
npm run db:migrate
npm run dev
```

Open http://localhost:3000/setup, enter your `OWNER_SETUP_TOKEN`, and save a passkey. That
creates the only account. On any later device, the same page adds a passkey to it.

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Development server |
| `npm run build` | Production build (on Vercel, applies migrations first) |
| `npm run lint` / `npm run typecheck` | ESLint / TypeScript |
| `npm test` | Unit tests |
| `npm run test:db` | Auth and schema tests against Postgres (`DATABASE_URL_TEST`) |
| `npm run test:e2e` | Passkey sign-up and sign-in in a real browser, at laptop and iPhone sizes |
| `npm run db:generate` | Create a migration after changing `lib/db/schema` |
| `npm run db:migrate` | Apply migrations to `DATABASE_URL` |

CI runs all of these on every push, against a throwaway Postgres.

## Making changes

`main` is the stable version; production deploys from it. All work happens on a branch
(`feat/…`, `fix/…`, `chore/…`) and goes in through a reviewed pull request. CI (lint, types,
unit, database and browser tests) runs on every PR.

## Deploy (Vercel + Neon, free tiers)

1. In the Vercel project, **Storage → Create → Neon** and connect it. This sets `DATABASE_URL`.
   Turn on a database branch per preview deployment if offered, so previews never migrate
   production.
2. Add `BETTER_AUTH_SECRET`, `OWNER_SETUP_TOKEN` and `TMDB_ACCESS_TOKEN` (Production and
   Preview). For book bestsellers, also `NYT_API_KEY` and `CRON_SECRET` (optional). AI needs nothing: on Vercel the AI Gateway authenticates itself. Locally, set
   `AI_GATEWAY_API_KEY` to try it, or leave it unset and the rules do everything.
3. Deploy. Migrations run during production builds only; pull-request previews share the
   production database, so they never migrate it.
4. Open `/setup` on the production domain and save your passkey.

Passkeys are bound to the domain they were created on. One made on production won't sign in on
a preview deployment's own URL; previews are for checking builds.

## How a deck is picked

1. **Pools.** TMDb Discover, per language (English, Hindi, Tamil, Malayalam), filtered by the
   mood's genres or keywords, your runtime limit, and a per-language vote floor. Separate pools
   pull what's on your services (set in Settings; Netflix, Prime Video, Apple TV and JioHotstar to
   start) and well-rated films fewer people have seen.
2. **Your rules.** English: any genre. Tamil, Malayalam, Hindi: only crime/thriller/mystery, or
   acclaimed. Anything you've seen, marked "Not for me", saved or picked never returns; skips
   return after 60 days.
3. **Score.** Weighted rating (new releases damped), mood fit, energy fit, taste learned from your
   swipes, a bonus for your services, and a markdown for films everyone has seen. No raw
   popularity.
4. **AI pass (optional).** The top 30 go to a fast model through Vercel's AI Gateway, which flags
   which genuinely fit the mood. It only re-weights; if it's slow or unavailable, the rules decide.
5. **Deck.** 15 films, about two-thirds English, the rest spread through. Swipe right to save,
   left to skip, up for seen it, down for not for me; Undo steps back as far as you like. Four
   saves start the head-to-head.

The rules live in `lib/taste/rules.ts`, each with a unit test, and their thresholds came from
probing real TMDb data.

## How a series deck differs

- **Languages:** English, and Hindi of any genre when it's well rated (weighted 7.2+). About one
  show in four is Hindi. Hindi is a small pool on TMDb (about 120 shows with 15+ votes).
- **Never:** soaps, talk, reality, news, kids' shows or animation. Hindi is short series only
  (50 episodes or fewer, at most 5 seasons, about 12 episodes a season at most), which also keeps
  out daily soaps that TMDb files as drama. Docuseries and older classics are in.
- **Moods** map onto TMDb's TV genres, which differ from film genres. English mind-bending uses
  story keywords (time loop, dystopia, parallel world…) because "Sci-Fi & Fantasy" alone dealt
  teen supernatural shows. There's no romantic mood: TV has no romance genre.
- **Commitment** replaces time: mini-series (one finished season), one season (season 1 of 13
  episodes or fewer), long-runner (three seasons or more). It needs each show's details, so the
  best 40 English and 16 Hindi candidates are checked before the deck is composed. Energy also
  leans on episode length: half-hour episodes suit "lean back".
- **After the pick** a series goes on your Watching list. Every three days the series screen asks
  "Still watching?": finished (with optional stars) moves it to History, dropped counts like
  "not for me".

Series rules live in `lib/taste/series-rules.ts`.

## How a book deck works

- **Catalogue:** Open Library (free, no key): subjects, page counts, covers, and reader ratings out
  of 5. Its ratings are thin (a famous book has a few hundred), so quality also uses how many people logged it as read and NYT weeks.
- **Bestsellers:** the New York Times lists. A daily Vercel cron (`/api/cron/nyt`) syncs the adult
  fiction and non-fiction lists into the database, about two years back, and matches each ISBN to
  its Open Library work. Weeks on the lists count towards quality, and lasting bestsellers join the
  pool even with few Open Library ratings. Without `NYT_API_KEY` this is skipped; Open Library's own
  NYT subject tags still give a smaller signal.
- **Never:** children's and young adult, romance and romantasy, self-help and business, comics and
  graphic novels (including ones only tagged with a comics class code), box sets and omnibuses.
- **Mix:** English only, mostly the last 30 years, at most two classics and one book per author in
  a deck. Length replaces time: short (under 250 pages), medium, long (450+).
- **Clean-up:** works filed under a foreign title get their English edition's title, messy edition
  titles are tidied, and descriptions that aren't in English are dropped.
- **After "Read next"** a book goes on your Reading list. About once a week the books screen asks
  "Still reading?": finished (with optional stars) moves it to History, gave up counts like "not
  for me". "Where to get it" searches Amazon India's books.

Book rules live in `lib/books/rules.ts`.

## How it's put together

```
app/(auth)/        sign-in and one-time setup
app/(app)/         everything signed in: /movies, /series, /books, saved, history, settings
app/api/auth/      Better Auth endpoints
lib/auth.ts        passkey-only, single-owner auth
lib/session.ts     the data access layer: every read of your data verifies the session here
lib/db/            Drizzle schema and client (plain Postgres, no vendor lock-in)
lib/moods.ts       moods, energy and time vocabulary, and their colours
lib/taste/         language gates, weighted rating, mood/energy fit, taste from swipes (films and series)
lib/deck/          deck composition, head-to-head, AI re-weighting, the movie and series deck builders
lib/tmdb/          TMDb client (retries flaky connections), movie, series and provider queries
lib/books/         Open Library client, NYT bestseller sync, book rules
app/api/cron/      the daily NYT sync (Vercel cron, guarded by CRON_SECRET)
lib/ai/            AI Gateway calls, each with a rule-based fallback
components/pick/   the flow: taps, deck, head-to-head, pick
proxy.ts           sends signed-out requests to /sign-in
```

**Looks.** Bold & playful in light mode, cinematic dark in dark mode, following the device. An
override is stored per device in the browser and applied before the first paint.

**Data.** Titles are keyed by media, source and external id, since TMDb movie and TV ids
overlap. Only ids and your own actions are stored; details come fresh from TMDb and Open
Library.

**Portability.** Nothing is Neon-specific. Moving to a self-hosted Postgres means changing
`DATABASE_URL`, then exporting and importing the data.

## Credits

This product uses the TMDb API but is not endorsed or certified by TMDb. Where-to-watch data is
provided by JustWatch via TMDb. Book data comes from Open Library. Bestseller data: The New York
Times Books API.
