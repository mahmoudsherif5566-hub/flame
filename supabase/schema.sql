-- Flame — central database schema (Supabase / Postgres)
-- Run this in Supabase Dashboard -> SQL Editor -> New query -> Run.
-- Tables: registrations, creatives, pro_interests.
-- The Node server talks to Supabase with the SERVICE ROLE key only,
-- so the anon key is never used for reads. RLS is ON and blocks all
-- direct anonymous access; the service role bypasses RLS by design.

create table if not exists public.registrations (
  id bigint generated always as identity primary key,
  email text not null unique,
  provider text not null default 'email',
  created_at timestamptz not null default now()
);

create table if not exists public.creatives (
  id bigint generated always as identity primary key,
  email text,
  kind text not null default 'ad',              -- 'ad' | 'studio'
  title text,
  prompt text,
  sample text,                                  -- thumbnail data URL (small JPEG) or sample name
  created_at timestamptz not null default now()
);

create table if not exists public.pro_interests (
  id bigint generated always as identity primary key,
  email text not null,
  plan text not null default 'pro',
  created_at timestamptz not null default now()
);

-- Indexes for the count panel
create index if not exists idx_registrations_created_at on public.registrations (created_at desc);
create index if not exists idx_creatives_created_at on public.creatives (created_at desc);
create index if not exists idx_pro_interests_created_at on public.pro_interests (created_at desc);

-- Row Level Security: block direct public access entirely.
-- All access goes through the Flame Node server (service role key).
alter table public.registrations enable row level security;
alter table public.creatives enable row level security;
alter table public.pro_interests enable row level security;

-- No policies are created on purpose: with RLS on and no policies,
-- anon/authenticated roles can do nothing directly. The service role
-- bypasses RLS, so only the server can read/write.
