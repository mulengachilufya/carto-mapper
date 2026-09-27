-- ============================================================
--  CartoMapper — Supabase schema
--  Run this in the SQL editor of your CartoMapper Supabase
--  project (NOT the Lenga Maps one). Safe to run again.
-- ============================================================

-- ─── Profiles (one per account) ──────────────────────────────
-- Filled from what people enter at sign-up (auth user_metadata)
-- by the trigger below, so no API call is needed after sign-up.
create table if not exists profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  email text,
  first_name text,
  last_name text,
  country text,
  role text, -- lib/profile-options.ts ROLES: ngo | government | research | teacher | student | business | media | gis | other
  welcome_email_sent_at timestamptz -- set once the welcome email has gone out (lib/email.ts)
);
alter table profiles add column if not exists welcome_email_sent_at timestamptz;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, first_name, last_name, country, role)
  values (
    new.id,
    new.email,
    left(nullif(trim(new.raw_user_meta_data ->> 'first_name'), ''), 120),
    left(nullif(trim(new.raw_user_meta_data ->> 'last_name'), ''), 120),
    left(nullif(trim(new.raw_user_meta_data ->> 'country'), ''), 120),
    left(nullif(trim(new.raw_user_meta_data ->> 'role'), ''), 40)
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ─── Maps ────────────────────────────────────────────────────
create table if not exists map_jobs (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  user_id uuid references auth.users (id) on delete cascade,
  industry text not null,
  custom_industry text,
  vibe_prompt text,
  answers jsonb not null default '{}',
  uploaded_data jsonb,
  map_spec jsonb,
  status text default 'preview',
  revision_count integer not null default 0, -- changes made to this map (lib/quota-rules.ts CHANGES_PER_MAP)
  delivered_at timestamptz,                  -- last download
  deleted_at timestamptz,                    -- removed from "My maps"; still counts toward the daily limit
  output_options jsonb
);

-- Upgrading from the paid version (map_jobs keyed by browser session): run once.
alter table map_jobs add column if not exists user_id uuid references auth.users (id) on delete cascade;
alter table map_jobs add column if not exists deleted_at timestamptz;
alter table map_jobs add column if not exists delivered_at timestamptz;
alter table map_jobs add column if not exists revision_count integer not null default 0;
do $$
begin
  if exists (select 1 from information_schema.columns where table_name = 'map_jobs' and column_name = 'session_id') then
    alter table map_jobs alter column session_id drop not null;
  end if;
end $$;
-- The old Stripe columns and the credit_purchases table are no longer used; drop them when you're ready:
-- alter table map_jobs drop column if exists stripe_payment_intent_id, drop column if exists stripe_checkout_session_id,
--   drop column if exists paid_revisions_used, drop column if exists paid_at, drop column if exists email;
-- drop table if exists credit_purchases;

-- The daily-limit count and "My maps" both read by user, newest first.
create index if not exists map_jobs_user_created_idx on map_jobs (user_id, created_at desc);

-- ─── Row Level Security ──────────────────────────────────────
-- The server reads and writes with the service-role key (which bypasses RLS)
-- after checking who is signed in. No public policies: the anon key can't touch
-- these tables directly, so the daily limit can't be bypassed from the browser.
alter table profiles enable row level security;
alter table map_jobs enable row level security;
