-- ============================================================
--  CartoMapper — Supabase schema
--  Run this in the Supabase SQL editor of your NEW CartoMapper
--  project (NOT the Lenga Maps one).
-- ============================================================

-- gen_random_uuid() is available in Supabase by default (pgcrypto).

-- ─── Map jobs ────────────────────────────────────────────────
create table if not exists map_jobs (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz default now(),
  session_id text not null,
  industry text not null,
  custom_industry text,
  vibe_prompt text,
  answers jsonb not null default '{}',
  uploaded_data jsonb,
  map_spec jsonb,
  svg_output text,
  pdf_url text,
  status text default 'draft', -- draft | generating | preview | paid | complete | failed
  stripe_payment_intent_id text,
  stripe_checkout_session_id text,
  revision_count integer default 0,
  revision_of uuid references map_jobs(id),
  output_options jsonb default '{"title": true, "legend": true, "scalebar": true, "north_arrow": true, "caption": false, "source": true}'
);

create index if not exists map_jobs_session_idx on map_jobs (session_id);
create index if not exists map_jobs_status_idx on map_jobs (status);
create index if not exists map_jobs_checkout_idx on map_jobs (stripe_checkout_session_id);

-- ─── Credit packs (future / optional) ────────────────────────
create table if not exists credit_purchases (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz default now(),
  session_id text not null,
  email text,
  stripe_payment_intent_id text,
  credits_purchased integer,
  credits_remaining integer,
  pack_type text -- single | triple | five
);

create index if not exists credit_purchases_session_idx on credit_purchases (session_id);

-- ─── Storage bucket for generated PDFs ───────────────────────
-- Private bucket; we hand out short-lived signed URLs from the server.
insert into storage.buckets (id, name, public)
values ('maps', 'maps', false)
on conflict (id) do nothing;

-- ─── Row Level Security ──────────────────────────────────────
-- All privileged access goes through the server using the
-- service-role key (which bypasses RLS). We enable RLS and add
-- NO public policies, so the anon key cannot read/write directly.
alter table map_jobs enable row level security;
alter table credit_purchases enable row level security;
