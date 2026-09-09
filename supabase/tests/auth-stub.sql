-- Minimal stand-in for the parts of Supabase's auth schema the migration touches.
create schema if not exists auth;

create table auth.users (
  id uuid primary key default gen_random_uuid(),
  email text,
  raw_user_meta_data jsonb default '{}'::jsonb
);

-- Mirrors Supabase's real auth.uid(): reads the sub claim off the request GUC.
create or replace function auth.uid() returns uuid language sql stable as $fn$
  select coalesce(
    nullif(current_setting('request.jwt.claim.sub', true), ''),
    (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub')
  )::uuid
$fn$;

-- Supabase's role for signed-in users. Not the table owner, so RLS applies to it.
do $$ begin
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then
    create role authenticated nologin;
  end if;
end $$;

-- Supabase grants authenticated access to the auth helpers; without this,
-- every policy calling auth.uid() errors instead of filtering.
grant usage on schema auth to authenticated;
grant execute on function auth.uid() to authenticated;
grant select on auth.users to authenticated;
