# MoodReel

A mood-first movie recommender for **English, Hindi and Tamil** films. Pick a mood, swipe through a
deck of cards, and everything you have already handled stops coming back.

Built as a Next.js PWA on top of TMDb, with Supabase for accounts and per-user history.

## What it does

- Ten hand-tuned moods mapped to TMDb Discover filters (no AI, fully explainable)
- Swipe deck: right to watchlist, left to skip, up to mark watched, tap for details
- Button and keyboard equivalents for every gesture (`←` `→` `↑` `↵`)
- Watchlist and Watched lists with optional 1–10 personal ratings
- Taste learning from your own swipes, folded into the ranking
- Guest mode with device-local history; sign in to sync
- Installable PWA with an honest offline state

## Quick start

```bash
npm install
cp .env.example .env.local   # then fill in TMDB_ACCESS_TOKEN
npm run dev
```

Open http://localhost:3000. Without Supabase credentials the app runs in guest mode, storing your
lists in `localStorage`.

### Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Dev server |
| `npm run build` | Production build |
| `npm run start` | Serve the production build |
| `npm test` | Vitest unit + route tests |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run lint` | ESLint |

## Environment variables

| Variable | Required | Notes |
| --- | --- | --- |
| `TMDB_ACCESS_TOKEN` | Yes | TMDb **API Read Access Token** (v4 bearer). Server-only — never exposed to the browser. |
| `NEXT_PUBLIC_SUPABASE_URL` | No | Omit to run guest-only. |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | No | Browser client; safe to expose, protected by RLS. |
| `SUPABASE_SERVICE_ROLE_KEY` | No | Not used by the MVP. Never expose to the browser. |
| `NEXT_PUBLIC_APP_URL` | Yes in prod | Used for auth redirects and metadata. |
| `TMDB_WATCH_REGION` | No | Region for watch-provider lookups. Defaults to `IN`. |

Get a TMDb token at <https://www.themoviedb.org/settings/api> (Settings → API → API Read Access
Token).

## Supabase setup

1. Create a project at <https://supabase.com>.
2. Run [`supabase/migrations/0001_init.sql`](supabase/migrations/0001_init.sql) in the SQL editor
   (or `supabase db push`). It creates the tables, indexes, the profile-creation trigger and all
   RLS policies.
3. Copy the project URL and anon key into `.env.local`.
4. Under **Authentication → URL Configuration**, add your redirect URLs:
   `http://localhost:3000/auth/callback` and `https://<your-domain>/auth/callback`.

Every table is protected by row level security keyed on `auth.uid()`, so a user can only ever read
or write their own rows.

## Deploying to Vercel

1. Push this repository to GitHub.
2. Import it at <https://vercel.com/new>. The framework preset is detected automatically.
3. Add every environment variable above in **Settings → Environment Variables**, setting
   `NEXT_PUBLIC_APP_URL` to your production URL.
4. Deploy, then add the production `…/auth/callback` URL to Supabase's allowed redirects.

## Architecture

```
app/
  page.tsx                     landing + mood picker
  login/                       email/password auth (server actions)
  about/                       TMDb + JustWatch attribution
  offline/                     service-worker fallback
  app/                         authenticated shell with bottom nav
    deck/                      swipe deck
    movie/[tmdbId]/            details
    watchlist/  watched/  settings/
  api/
    movies/recommendations     mood -> deck pipeline
    movies/search  movies/batch  movies/[tmdbId]
    movie-actions  movie-states
components/                    swipe deck, movie card, grids, nav, forms
lib/
  tmdb.ts                      server-only TMDb client
  recommendations/             mood presets, ranking, seen-filtering
  supabase/                    browser + server clients, session proxy
  local-store.ts               guest history in localStorage
supabase/migrations/           schema, trigger and RLS policies
```

### How a deck is built

1. Validate the mood and the requested languages (`en` / `hi` / `ta` only).
2. Load the signed-in user's movie states and recent actions.
3. Run one TMDb Discover request per language per page — TMDb has no multi-language filter, so
   languages are queried separately and merged.
4. Dedupe, then drop everything already watched, skipped, disliked or watchlisted.
5. Score each movie: popularity 30%, TMDb rating 20%, mood match 30%, learned taste 15%, seeded
   randomness 5%.
6. Interleave by language so an "all languages" deck alternates rather than front-loading one.

Taste comes from the action log: likes and watchlists raise a genre's affinity, dislikes lower it,
skips nudge it slightly down. Sums are squashed with `tanh` so a long history cannot dominate.

## Attribution

This product uses the TMDb API but is not endorsed or certified by TMDb. Streaming availability
shown in the app comes from TMDb and is powered by JustWatch. MoodReel stores only TMDb movie ids
and your own actions; titles, posters and ratings are fetched from TMDb and cached only briefly, in
line with the TMDb API terms of use.

MoodReel is a non-commercial personal project. Commercial use would require a TMDb commercial
licence.
