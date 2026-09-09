# MoodReel MVP Build Plan

Last checked for pricing/API assumptions: 2026-09-09

MoodReel is a web/PWA movie recommender that suggests movies based on the user's mood, supports Tinder-style swiping to mark taste and watched status, and limits discovery to English, Hindi, and Tamil movies using TMDb as the primary movie API.

## 1. MVP Goal

Build a usable first version where a user can:

- Sign up and sign in.
- Pick a mood.
- See movie suggestions for English, Hindi, and Tamil only.
- Swipe through movie cards.
- Mark movies as watched, skipped, liked, disliked, or watchlisted.
- Keep a personal watched list and watchlist.
- Get better suggestions by excluding movies they already handled.
- Install the app as a PWA on mobile.
- Deploy the app publicly on Vercel.

## 2. Recommended MVP Stack

### Frontend and App Framework

- Next.js with App Router
- TypeScript
- Tailwind CSS
- shadcn/ui for reusable UI components
- Framer Motion for swipe interactions
- next-pwa or a minimal custom service-worker setup for PWA support

Why this stack:

- Next.js gives the app frontend pages, backend API routes, environment variable support, server-side TMDb calls, and easy Vercel deployment in one project.
- TypeScript keeps API and database data safer.
- Tailwind and shadcn/ui are fast for a polished MVP.
- Framer Motion is the right fit for swipe-card physics and exit animations.

### Backend and Database

- Supabase Auth
- Supabase Postgres
- Supabase Row Level Security
- Supabase JavaScript client

Why Supabase:

- Handles email/password auth and OAuth later.
- Stores user movie actions, watched status, watchlist, ratings, and profile preferences.
- Postgres makes it easy to query user history and avoid duplicate suggestions.
- Row Level Security keeps each user's history private.

### Movie Data API

- TMDb API as the primary movie source.
- Optional later: OMDb for IMDb-style ratings enrichment.
- Optional later: Trakt if user account syncing becomes important.

TMDb should power:

- Movie discovery
- Movie search
- Posters and backdrops
- Genres
- Cast/crew details
- Similar movies
- Watch-provider data by country, if needed

## 3. Free Tier and Cost Reality

This MVP can start on free tiers, but "free" has practical limits.

### TMDb

TMDb's developer API is free for non-commercial use when TMDb is attributed as the source of the data and/or images. If MoodReel becomes commercial, revenue-generating, or production-business usage, plan to contact TMDb about a commercial license.

Required attribution:

- Add an About/Credits area in MoodReel.
- Include TMDb attribution text.
- Use approved TMDb logo assets.
- Do not imply TMDb endorses MoodReel.

Important limitation:

- Do not scrape IMDb.
- Do not cache TMDb data indefinitely. Use short-lived caching and refresh metadata.
- Store only the movie IDs and user-specific actions permanently; fetch display metadata from TMDb or refresh cached copies.

Source: [TMDb API FAQ](https://developer.themoviedb.org/docs/faq), [TMDb API Terms](https://www.themoviedb.org/api-terms-of-use)

### Supabase

Supabase has a Free plan suitable for a small MVP. As of the check date above, the Free plan includes:

- 2 free projects.
- 500 MB database size per project.
- 50,000 monthly active users.
- 5 GB egress.
- 1 GB file storage.
- Free projects can pause after inactivity.

Possible paid triggers:

- More than 2 active free projects.
- Database grows beyond free storage.
- More bandwidth/egress.
- Need automatic backups, no pausing, higher performance, or production support.
- Pro plan usage starts at a monthly subscription and can have usage-based overages.

Source: [Supabase Pricing](https://supabase.com/pricing), [Supabase Billing Docs](https://supabase.com/docs/guides/platform/billing-on-supabase)

### Vercel

Vercel's Hobby plan can host a personal/non-commercial MVP for free. As of the check date above, Hobby is $0/month and includes common deployment features plus usage caps such as included edge requests and bandwidth.

Possible paid triggers:

- Commercial or business usage.
- Team collaboration needs.
- Higher traffic.
- Higher function usage.
- More advanced controls, observability, or support.
- Pro plan starts at a monthly cost and includes usage credit, with additional paid usage possible.

Source: [Vercel Pricing](https://vercel.com/pricing)

### Practical Cost Recommendation

For the MVP:

- Start with TMDb developer API, Supabase Free, and Vercel Hobby.
- Keep MoodReel non-commercial until the usage model is clear.
- Add an in-app About/Credits page before launch.
- Add request caching so TMDb calls stay reasonable.
- Avoid paid APIs until the product proves useful.

## 4. Product Scope

### In Scope for MVP

- Mood picker
- Movie recommendation feed
- Swipe cards
- User auth
- Watched list
- Watchlist
- Basic taste learning from swipes
- English, Hindi, Tamil movie restriction
- Responsive mobile-first UI
- PWA installability
- Vercel deployment

### Out of Scope for MVP

- Native iOS/Android apps
- Social/friend recommendations
- Group watch planning
- Paid subscription features
- Real-time chat
- Full streaming subscription syncing
- IMDb scraping
- AI-generated summaries
- Admin dashboard

## 5. Core User Flows

### First-Time User

1. User opens MoodReel.
2. User sees a focused mood-selection screen.
3. User chooses languages: English, Hindi, Tamil, or all three.
4. User signs in or continues as a temporary guest.
5. App shows movie cards based on mood and language.
6. User swipes right to watchlist/like, left to skip, up to mark watched.
7. User can open movie details from a card.

### Returning User

1. User opens MoodReel.
2. App loads saved preferences and previous movie actions.
3. User picks a mood.
4. Recommendations exclude watched, skipped, and disliked movies unless filters are reset.
5. User can browse Watchlist and Watched.

### Movie Card Flow

Each card should show:

- Poster
- Title
- Year
- Language
- Runtime, if available
- Genre chips
- TMDb rating
- Short overview
- Primary action icons

Swipe meanings:

- Swipe right: like and add to watchlist.
- Swipe left: skip.
- Swipe up: mark watched.
- Tap: open details.

Buttons should mirror swipe actions for accessibility:

- Skip
- Watchlist
- Watched
- Details

## 6. Mood Model

MoodReel should start with rule-based mood mapping. This avoids paid AI usage and keeps the MVP explainable.

### MVP Moods

- Edge-of-seat
- Dark and intense
- Light and funny
- Romantic
- Feel-good
- Mind-bending
- Emotional
- Family night
- Classic rewatch
- Hidden gems

### Mood-to-TMDb Filter Strategy

Use TMDb Discover Movie with:

- `with_original_language`
- `with_genres`
- `with_keywords`
- `vote_count.gte`
- `vote_average.gte`
- `primary_release_date.gte`
- `sort_by`
- `watch_region`, optional
- `with_watch_monetization_types`, optional

TMDb supports a movie discover endpoint with many filters, including `with_original_language`, which is the cleanest way to restrict discovery to English, Hindi, and Tamil.

Source: [TMDb Discover Movie Docs](https://developer.themoviedb.org/reference/discover-movie)

### Language Codes

- English: `en`
- Hindi: `hi`
- Tamil: `ta`

Recommended query pattern:

```text
/discover/movie?with_original_language=en&sort_by=popularity.desc&page=1
/discover/movie?with_original_language=hi&sort_by=popularity.desc&page=1
/discover/movie?with_original_language=ta&sort_by=popularity.desc&page=1
```

For "all languages", query each language separately and merge results. This gives better control than trying to over-compress discovery into one request.

### Example Mood Rules

```ts
const moodPresets = {
  edgeOfSeat: {
    genres: ["53", "80", "9648"],
    minVoteCount: 100,
    sortBy: "popularity.desc",
  },
  darkAndIntense: {
    genres: ["18", "53", "80"],
    minVoteAverage: 6.5,
    minVoteCount: 75,
    sortBy: "vote_average.desc",
  },
  lightAndFunny: {
    genres: ["35"],
    minVoteCount: 50,
    sortBy: "popularity.desc",
  },
  romantic: {
    genres: ["10749", "18"],
    minVoteCount: 50,
    sortBy: "popularity.desc",
  },
  feelGood: {
    genres: ["35", "18", "10751"],
    minVoteAverage: 6.3,
    sortBy: "popularity.desc",
  },
  mindBending: {
    genres: ["878", "9648", "53"],
    minVoteAverage: 6.5,
    sortBy: "vote_count.desc",
  },
};
```

## 7. Recommendation Logic

### V1 Recommendation Algorithm

1. User selects mood and languages.
2. App builds TMDb discover requests for each selected language.
3. App fetches 1-3 pages per language.
4. App removes movies already marked by the user:
   - watched
   - skipped
   - disliked
   - already watchlisted, unless showing watchlist mode
5. App boosts movies that match liked genres and languages.
6. App shuffles lightly so recommendations do not feel static.
7. App returns a ranked deck of 20-40 movies.

### Ranking Formula

Start simple:

```text
score =
  tmdbPopularityWeight +
  tmdbRatingWeight +
  moodMatchWeight +
  languagePreferenceWeight +
  noveltyWeight -
  alreadySeenPenalty
```

Suggested MVP scoring:

- TMDb popularity: 30%
- TMDb vote average: 20%
- Mood genre match: 30%
- User preference match: 15%
- Random freshness: 5%

### Taste Learning

For MVP, infer taste from actions:

- Right swipe increases preference for that movie's genres and language.
- Watched increases preference slightly.
- Dislike decreases preference.
- Skip is neutral-to-slightly negative.

Do not overbuild machine learning. Store enough behavior now so a smarter recommender can be added later.

## 8. Data Model

### Tables

#### `profiles`

Stores user-level preferences.

```sql
create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  preferred_languages text[] default array['en', 'hi', 'ta'],
  onboarding_completed boolean default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
```

#### `movie_actions`

Stores every user action against a TMDb movie.

```sql
create type movie_action_type as enum (
  'liked',
  'disliked',
  'skipped',
  'watchlisted',
  'watched',
  'removed_from_watchlist'
);

create table movie_actions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  tmdb_movie_id integer not null,
  action movie_action_type not null,
  mood text,
  source_language text,
  created_at timestamptz default now()
);

create index movie_actions_user_movie_idx
  on movie_actions(user_id, tmdb_movie_id);

create index movie_actions_user_action_idx
  on movie_actions(user_id, action);
```

#### `movie_states`

Stores the latest per-user state for each movie. This avoids computing current state from the action log every time.

```sql
create table movie_states (
  user_id uuid not null references auth.users(id) on delete cascade,
  tmdb_movie_id integer not null,
  liked boolean default false,
  disliked boolean default false,
  skipped boolean default false,
  watchlisted boolean default false,
  watched boolean default false,
  user_rating smallint check (user_rating between 1 and 10),
  notes text,
  updated_at timestamptz default now(),
  primary key (user_id, tmdb_movie_id)
);
```

#### `mood_sessions`

Tracks recommendation sessions and helps debug recommendation quality.

```sql
create table mood_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  mood text not null,
  languages text[] not null,
  filters jsonb default '{}'::jsonb,
  created_at timestamptz default now()
);
```

### Row Level Security

Enable RLS on all user tables.

```sql
alter table profiles enable row level security;
alter table movie_actions enable row level security;
alter table movie_states enable row level security;
alter table mood_sessions enable row level security;

create policy "Users can read own profile"
  on profiles for select
  using (auth.uid() = id);

create policy "Users can update own profile"
  on profiles for update
  using (auth.uid() = id);

create policy "Users can manage own movie actions"
  on movie_actions for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users can manage own movie states"
  on movie_states for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users can manage own mood sessions"
  on mood_sessions for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
```

## 9. App Routes and Screens

### Public Routes

- `/` - mood picker and intro state
- `/login` - sign in/sign up
- `/about` - TMDb attribution and app credits

### Authenticated Routes

- `/app` - main mood picker
- `/app/deck` - swipe deck
- `/app/movie/[tmdbId]` - movie details
- `/app/watchlist` - saved movies
- `/app/watched` - watched history
- `/app/settings` - language preferences and account settings

### API Routes

- `GET /api/movies/recommendations`
- `GET /api/movies/search`
- `GET /api/movies/[tmdbId]`
- `POST /api/movie-actions`
- `GET /api/movie-states`

Keep TMDb API calls server-side so the TMDb access token is not exposed to the browser.

## 10. Suggested Folder Structure

```text
moodreel/
  app/
    page.tsx
    login/page.tsx
    about/page.tsx
    app/
      page.tsx
      deck/page.tsx
      watchlist/page.tsx
      watched/page.tsx
      settings/page.tsx
      movie/[tmdbId]/page.tsx
    api/
      movies/
        recommendations/route.ts
        search/route.ts
        [tmdbId]/route.ts
      movie-actions/route.ts
      movie-states/route.ts
  components/
    movie-card.tsx
    swipe-deck.tsx
    mood-picker.tsx
    language-filter.tsx
    movie-grid.tsx
    bottom-nav.tsx
  lib/
    tmdb.ts
    supabase/
      client.ts
      server.ts
    recommendations/
      mood-presets.ts
      rank-movies.ts
      filter-seen.ts
    types.ts
  supabase/
    migrations/
  public/
    manifest.json
    icons/
```

## 11. Environment Variables

```text
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
TMDB_ACCESS_TOKEN=
NEXT_PUBLIC_APP_URL=
```

Rules:

- `TMDB_ACCESS_TOKEN` must only be used in server routes.
- `SUPABASE_SERVICE_ROLE_KEY` must never be exposed to the browser.
- Browser-side Supabase access should use the anon key with RLS enabled.

## 12. TMDb Integration Plan

### Server Helper

Create `lib/tmdb.ts`:

- Build URLs safely with `URLSearchParams`.
- Add bearer-token authorization.
- Normalize TMDb response shapes.
- Add basic error handling.
- Add cache hints where appropriate.

### Recommendation Endpoint

`GET /api/movies/recommendations?mood=edgeOfSeat&languages=en,hi,ta&page=1`

Responsibilities:

- Validate mood.
- Validate languages against `en`, `hi`, `ta`.
- Fetch user movie states from Supabase.
- Fetch TMDb discover results per language.
- Merge, dedupe, filter, rank.
- Return movie cards.

### Movie Details Endpoint

`GET /api/movies/[tmdbId]`

Fetch:

- Movie details
- Credits
- Videos
- Similar movies
- Watch providers, optional

For watch providers:

- Use `watch_region=IN` if targeting India.
- Attribute JustWatch if showing provider availability from TMDb's watch-provider data.

## 13. UI Direction

MoodReel should feel like a focused movie tool, not a generic marketing site.

### Visual Direction

- Mobile-first.
- Dark interface, but not all-blue or all-purple.
- Posters should carry most of the visual richness.
- Bottom navigation for core mobile routes.
- Large movie poster card for swiping.
- Compact metadata, readable at a glance.

### Main Navigation

Use bottom tabs:

- Mood
- Swipe
- Watchlist
- Watched
- Settings

### Card Controls

Use icon buttons:

- X for skip
- Heart for like/watchlist
- Check for watched
- Info for details

Keyboard support:

- Left arrow: skip
- Right arrow: watchlist
- Up arrow: watched
- Enter: details

## 14. PWA Requirements

Minimum PWA features:

- `manifest.json`
- App name: MoodReel
- Short name: MoodReel
- Theme color
- App icons
- Mobile viewport support
- Installable app shell
- Offline fallback page

Nice-to-have:

- Cache static shell.
- Keep movie data online-only for freshness and API compliance.
- Show a clean offline state instead of stale recommendations.

## 15. Build Phases

### Phase 1: Project Setup

- Create Next.js app with TypeScript and Tailwind.
- Install shadcn/ui.
- Install Framer Motion.
- Configure Supabase client helpers.
- Add environment variable templates.
- Add app shell and navigation.

### Phase 2: Supabase Setup

- Create Supabase project.
- Add database migrations.
- Enable RLS.
- Add auth flow.
- Add profile creation on sign-up.
- Verify a user can only read/write their own movie data.

### Phase 3: TMDb Integration

- Create server-side TMDb client.
- Add discover endpoint support.
- Add movie details endpoint.
- Add language filtering.
- Add mood presets.
- Add recommendation ranking.

### Phase 4: Swipe Experience

- Build movie card component.
- Build swipe deck.
- Add swipe gestures.
- Add button alternatives.
- Persist actions to Supabase.
- Update movie state after each swipe.

### Phase 5: Lists

- Build Watchlist page.
- Build Watched page.
- Add remove-from-watchlist action.
- Add optional user rating.
- Add empty states.

### Phase 6: PWA and Polish

- Add manifest and icons.
- Add responsive layout.
- Add loading states.
- Add offline state.
- Add TMDb attribution page.
- Add error handling.

### Phase 7: Deployment

- Push repository to GitHub.
- Create Vercel project.
- Add environment variables in Vercel.
- Deploy preview.
- Test auth callback URLs.
- Test production URL.
- Add Supabase allowed redirect URLs.

## 16. Testing Plan

### Manual MVP Tests

- User can sign up.
- User can sign in.
- User can choose each mood.
- User can filter English only.
- User can filter Hindi only.
- User can filter Tamil only.
- User can use all three languages.
- Swipe left saves skip.
- Swipe right saves watchlist/like.
- Swipe up saves watched.
- Watchlist persists after refresh.
- Watched list persists after refresh.
- Already watched movies do not reappear in the deck.
- TMDb attribution page is visible.
- App works on mobile viewport.
- PWA install prompt appears where supported.

### Automated Tests

- Unit test mood preset mapping.
- Unit test ranking function.
- Unit test language validation.
- Unit test filtering of watched/skipped/disliked movies.
- API route tests with mocked TMDb responses.
- Supabase RLS verification in staging.

## 17. MVP Acceptance Criteria

MoodReel MVP is ready when:

- A logged-in user can get recommendations for English, Hindi, and Tamil movies.
- A user can swipe through at least 20 recommendations per mood session.
- Swipes are persisted.
- Watchlist and watched pages show saved movies.
- Previously handled movies are filtered out of future recommendations.
- The app is mobile-friendly.
- The app is installable as a PWA.
- TMDb attribution is present.
- The app is deployed on Vercel.

## 18. Initial Dependency List

```bash
npx create-next-app@latest moodreel --typescript --tailwind --eslint --app
cd moodreel
npm install @supabase/supabase-js @supabase/ssr framer-motion lucide-react zod
npx shadcn@latest init
```

Optional:

```bash
npm install next-pwa
```

## 19. Risks and Mitigations

### TMDb API Rules

Risk: Incorrect attribution or commercial use without license.

Mitigation: Add About/Credits before launch and keep MVP non-commercial until licensing is reviewed.

### Recommendation Quality

Risk: Mood filters feel too generic.

Mitigation: Start with clear mood presets, then tune based on actual swipes.

### Duplicate or Repeated Movies

Risk: Same popular movies keep appearing.

Mitigation: Store movie states and filter handled movies before ranking.

### Regional Availability

Risk: Streaming-provider data may be incomplete or require additional attribution.

Mitigation: Make provider availability optional in MVP and clearly attribute JustWatch if shown.

### Free Tier Exhaustion

Risk: Database, bandwidth, or deployment limits are exceeded.

Mitigation: Add basic caching, avoid storing poster files, and monitor Supabase/Vercel dashboards.

## 20. Post-MVP Backlog

- Import watched movies from CSV or Letterboxd export.
- Add custom mood builder.
- Add "surprise me" mode.
- Add actor/director preferences.
- Add disliked actor/director filtering.
- Add streaming-provider filters.
- Add friend recommendations.
- Add group swipe night.
- Add notifications for watchlist releases.
- Add Trakt sync.
- Add richer analytics for personal taste.
- Add native mobile wrapper if PWA adoption is strong.

## 21. Best First Implementation Order

1. Build the Next.js shell and mood picker.
2. Connect TMDb recommendations without auth.
3. Build the swipe deck locally.
4. Add Supabase auth.
5. Persist swipes.
6. Add Watchlist and Watched pages.
7. Add PWA support.
8. Add attribution and deployment.

This order proves the core experience early: mood in, swipeable movie recommendations out. Auth and persistence come right after the core movie loop is visible.
