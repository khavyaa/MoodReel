@AGENTS.md

# MoodReel

Mood-first movie recommender (English / Hindi / Tamil) on Next.js + TMDb + Supabase.
See `README.md` for setup, environment variables and the deck pipeline.

## Conventions

- TMDb is **server-only**. `lib/tmdb.ts` imports `server-only`; never call TMDb from the browser.
- Supabase may be unconfigured. `supabaseConfigured()` gates every path, and the client helpers
  return `null` rather than throwing — guest mode falls back to `lib/local-store.ts`.
- Recommendation logic lives in `lib/recommendations/` and is kept pure so it can be unit tested
  without network or database access.
- `movie_states` is derived from `movie_actions` via the pure `applyAction` reducer in
  `lib/types.ts`, which runs identically on the client (guest) and the server (signed in).
- The React Compiler lint rules are on: do not call `setState` synchronously inside an effect.
  External stores (localStorage) go through `useSyncExternalStore`; async loads key their result
  so "loading" is derived rather than written.
