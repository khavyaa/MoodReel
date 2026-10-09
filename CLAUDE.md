@AGENTS.md

# MoodReel

Personal mood-first recommender for movies, series and books. One owner, iPhone + Mac.
Setup and architecture: README.md.

## Conventions

- **Cache Components is on.** Anything that reads the request (session, cookies, headers, the
  database per user) must render inside `<Suspense>`; never await it at the top of a layout.
  Static frames prerender, personal parts stream in.
- **Sessions:** `proxy.ts` only checks a cookie exists. Real checks go through `lib/session.ts`
  (`getOwner` / `requireOwner`) before any read or write of user data.
- **Single owner:** accounts are created only by `/setup` (token → signed grant → passkey).
  The user-create hook in `lib/auth.ts` refuses a second account. Don't add other sign-up
  routes.
- **Passkeys on iOS** must start directly from a tap; never trigger WebAuthn after an `await`.
- **Titles** are always identified by `(media, source, external_id)`. Store ids and actions only;
  fetch metadata fresh (TMDb terms).
- **Ratings** update `title_states` without appending to `title_actions`, so re-rating never
  adds taste signal.
- **Looks:** style through tokens in `app/globals.css` (`bg-bg`, `text-muted`, `border-line`,
  `bg-accent`…). Inside `.mood` surfaces the tokens re-point to the mood colour. No literal
  colours in components except mood data in `lib/moods.ts`.
- **Tests:** unit (`npm test`), Postgres (`npm run test:db`), browser passkey flows
  (`npm run test:e2e`). When adding a guard, confirm a test fails with the guard removed.
- **AI never blocks:** every AI call (`lib/ai/`) has a short timeout and a rule-based fallback,
  and only re-weights; the rules still decide what can appear. Record which one ran.
- **Server-only config** is read at runtime (`APP_URL`, not `NEXT_PUBLIC_*`, which Next bakes
  into the build).
- **E2E tests** use a fixed fake TMDb (`tests/e2e/mock-tmdb.mjs`, via `TMDB_BASE_URL`); never let
  CI depend on the real TMDb.
- **Recommendation changes:** check real decks (deal a few moods against live TMDb) before
  shipping; unit tests alone won't show a deck that feels wrong.
