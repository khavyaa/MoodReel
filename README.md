# MoodReel

A personal tool for deciding what to watch or read. Three taps (mood, energy, time), a short
swipe deck, a head-to-head between your favourites, and one pick: tonight's movie or series, or
the next book.

Built for one person on an iPhone and a Mac. Sign-in is a passkey; there is no sign-up page.

> **Status:** Phase 1 (foundation) of the v2 rebuild. Sign-in, the app shell and both looks are
> done; the taps → deck → pick flow arrives in Phase 2.

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

## Deploy (Vercel + Neon, free tiers)

1. In the Vercel project, **Storage → Create → Neon** and connect it. This sets `DATABASE_URL`.
   Turn on a database branch per preview deployment if offered, so previews never migrate
   production.
2. Add `BETTER_AUTH_SECRET`, `OWNER_SETUP_TOKEN` and `TMDB_ACCESS_TOKEN` (Production and
   Preview).
3. Deploy. Migrations run during the build.
4. Open `/setup` on the production domain and save your passkey.

Passkeys are bound to the domain they were created on. One made on production won't sign in on
a preview deployment's own URL; previews are for checking builds.

## How it's put together

```
app/(auth)/        sign-in and one-time setup
app/(app)/         everything signed in: /movies, /series, /books, saved, history, settings
app/api/auth/      Better Auth endpoints
lib/auth.ts        passkey-only, single-owner auth
lib/session.ts     the data access layer: every read of your data verifies the session here
lib/db/            Drizzle schema and client (plain Postgres, no vendor lock-in)
lib/moods.ts       moods, energy and time vocabulary, and their colours
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
provided by JustWatch via TMDb. Book data comes from Open Library.
