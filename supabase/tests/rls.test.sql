-- RLS isolation suite. Every check reports PASS or FAIL; scripts/test-rls.sh
-- fails the run if any FAIL appears. Run against a throwaway Postgres seeded
-- with supabase/tests/auth-stub.sql, never a real project.
\pset pager off

grant usage on schema public to authenticated;
grant all on all tables in schema public to authenticated;
grant all on all sequences in schema public to authenticated;

\set alice '11111111-1111-1111-1111-111111111111'
\set bob   '22222222-2222-2222-2222-222222222222'

insert into auth.users (id, email, raw_user_meta_data) values
  (:'alice', 'alice@example.com', '{"display_name":"Alice"}'),
  (:'bob',   'bob@example.com',   '{"display_name":"Bob"}')
on conflict (id) do nothing;

-- Seeded as owner (RLS bypassed) so each user has data the other might leak.
insert into movie_states (user_id, tmdb_movie_id, watchlisted) values
  (:'alice', 550, true),
  (:'bob',   680, true)
on conflict do nothing;

create or replace function expect_eq(actual bigint, expected bigint, label text)
returns void language plpgsql security invoker as $fn$
begin
  if actual is not distinct from expected then
    raise notice 'PASS  %  (got %)', label, actual;
  else
    raise notice 'FAIL  %  expected %, got %', label, expected, actual;
  end if;
end $fn$;

create or replace function expect_rejection(stmt text, label text)
returns void language plpgsql security invoker as $fn$
begin
  execute stmt;
  raise notice 'FAIL  %  <- expected rejection, statement SUCCEEDED', label;
exception when others then
  raise notice 'PASS  %  <- rejected (%)', label, sqlstate;
end $fn$;

grant execute on function expect_eq(bigint, bigint, text) to authenticated;
grant execute on function expect_rejection(text, text) to authenticated;

\echo ''
\echo '=== signup trigger ==='
select expect_eq((select count(*) from profiles), 2, 'trigger created a profile per user');
select expect_eq((select count(*) from profiles where display_name = 'Alice'), 1,
                 'display_name taken from user metadata');

\echo ''
\echo '=== as Alice ==='
set role authenticated;
set request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111111"}';

select expect_eq((select count(*) from profiles), 1, 'sees only her own profile');
select expect_eq((select count(*) from movie_states), 1, 'sees only her own movie_states');
select expect_eq((select count(*) from movie_states where user_id = :'bob'), 0,
                 'cannot read Bob movie_states');
select expect_eq((select count(*) from profiles where id = :'bob'), 0,
                 'cannot read Bob profile');

select expect_rejection(
  format($q$insert into movie_states (user_id, tmdb_movie_id, watched) values (%L, 999, true)$q$, :'bob'),
  'insert movie_state as Bob');
select expect_rejection(
  format($q$insert into movie_actions (user_id, tmdb_movie_id, action) values (%L, 999, 'liked')$q$, :'bob'),
  'insert movie_action as Bob');
select expect_rejection(
  format($q$insert into mood_sessions (user_id, mood, languages) values (%L, 'romantic', array['en'])$q$, :'bob'),
  'insert mood_session as Bob');
select expect_rejection(
  format($q$insert into profiles (id, display_name) values (%L, 'hacked')$q$, :'bob'),
  'insert profile as Bob');

-- RLS makes cross-user UPDATE/DELETE silent no-ops rather than errors.
with u as (update movie_states set watched = true where user_id = :'bob' returning 1)
select expect_eq((select count(*) from u), 0, 'update of Bob movie_states affects 0 rows');
with d as (delete from movie_states where user_id = :'bob' returning 1)
select expect_eq((select count(*) from d), 0, 'delete of Bob movie_states affects 0 rows');
with p as (update profiles set display_name = 'hacked' where id = :'bob' returning 1)
select expect_eq((select count(*) from p), 0, 'update of Bob profile affects 0 rows');

\echo ''
\echo '=== Alice writes her own rows (the app happy path) ==='
insert into movie_states (user_id, tmdb_movie_id, liked, watchlisted, updated_at)
values (:'alice', 603, true, true, now())
on conflict (user_id, tmdb_movie_id) do update
  set liked = excluded.liked, watchlisted = excluded.watchlisted;
insert into movie_states (user_id, tmdb_movie_id, watched, watchlisted, updated_at)
values (:'alice', 603, true, false, now())
on conflict (user_id, tmdb_movie_id) do update
  set watched = excluded.watched, watchlisted = excluded.watchlisted;
select expect_eq((select count(*) from movie_states where tmdb_movie_id = 603), 1,
                 'upsert updates in place rather than duplicating');
select expect_eq((select count(*) from movie_states where tmdb_movie_id = 603 and watched and not watchlisted), 1,
                 'upsert conflict branch applied the new values');

insert into movie_actions (user_id, tmdb_movie_id, action, mood, source_language, genre_ids)
values (:'alice', 603, 'liked', 'mindBending', 'en', array[878]);
insert into profiles (id, display_name, preferred_languages, onboarding_completed)
values (:'alice', 'Alice R', array['en','ta'], true)
on conflict (id) do update set display_name = excluded.display_name,
  preferred_languages = excluded.preferred_languages;
select expect_eq((select count(*) from profiles where display_name = 'Alice R'), 1,
                 'profile upsert works under RLS');

\echo ''
\echo '=== as Bob: none of that is visible ==='
set request.jwt.claims = '{"sub":"22222222-2222-2222-2222-222222222222"}';
select expect_eq((select count(*) from movie_states), 1, 'sees only his own movie_states');
select expect_eq((select count(*) from movie_actions), 0, 'cannot read Alice movie_actions');
select expect_eq((select count(*) from profiles), 1, 'sees only his own profile');
select expect_eq((select count(*) from profiles where display_name = 'Alice R'), 0,
                 'cannot read Alice profile contents');

\echo ''
\echo '=== anonymous ==='
set request.jwt.claims = '';
select expect_eq((select count(*) from movie_states), 0, 'no movie_states without a JWT');
select expect_eq((select count(*) from movie_actions), 0, 'no movie_actions without a JWT');
select expect_eq((select count(*) from profiles), 0, 'no profiles without a JWT');

reset role;
