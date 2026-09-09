-- MoodReel MVP schema.
-- Run with the Supabase CLI (`supabase db push`) or paste into the SQL editor.

create extension if not exists "pgcrypto";

/* ------------------------------------------------------------------ types */

do $$
begin
  if not exists (select 1 from pg_type where typname = 'movie_action_type') then
    create type movie_action_type as enum (
      'liked',
      'disliked',
      'skipped',
      'watchlisted',
      'watched',
      'removed_from_watchlist'
    );
  end if;
end
$$;

/* --------------------------------------------------------------- profiles */

create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  preferred_languages text[] default array['en', 'hi', 'ta'],
  onboarding_completed boolean default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

/* ---------------------------------------------------------- movie_actions */

create table if not exists movie_actions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  tmdb_movie_id integer not null,
  action movie_action_type not null,
  mood text,
  source_language text,
  -- Kept so taste can be recomputed without re-fetching every movie from TMDb.
  genre_ids integer[] default '{}',
  created_at timestamptz default now()
);

create index if not exists movie_actions_user_movie_idx
  on movie_actions(user_id, tmdb_movie_id);

create index if not exists movie_actions_user_action_idx
  on movie_actions(user_id, action);

create index if not exists movie_actions_user_created_idx
  on movie_actions(user_id, created_at desc);

/* ----------------------------------------------------------- movie_states */

create table if not exists movie_states (
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

create index if not exists movie_states_user_watchlisted_idx
  on movie_states(user_id, watchlisted) where watchlisted;

create index if not exists movie_states_user_watched_idx
  on movie_states(user_id, watched) where watched;

/* ---------------------------------------------------------- mood_sessions */

create table if not exists mood_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  mood text not null,
  languages text[] not null,
  filters jsonb default '{}'::jsonb,
  created_at timestamptz default now()
);

/* --------------------------------------------------- profile auto-creation */

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'display_name', split_part(new.email, '@', 1))
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

/* ---------------------------------------------------- row level security */

alter table profiles enable row level security;
alter table movie_actions enable row level security;
alter table movie_states enable row level security;
alter table mood_sessions enable row level security;

drop policy if exists "Users can read own profile" on profiles;
create policy "Users can read own profile"
  on profiles for select
  using (auth.uid() = id);

drop policy if exists "Users can insert own profile" on profiles;
create policy "Users can insert own profile"
  on profiles for insert
  with check (auth.uid() = id);

drop policy if exists "Users can update own profile" on profiles;
create policy "Users can update own profile"
  on profiles for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

drop policy if exists "Users can manage own movie actions" on movie_actions;
create policy "Users can manage own movie actions"
  on movie_actions for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Users can manage own movie states" on movie_states;
create policy "Users can manage own movie states"
  on movie_states for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Users can manage own mood sessions" on mood_sessions;
create policy "Users can manage own mood sessions"
  on mood_sessions for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
