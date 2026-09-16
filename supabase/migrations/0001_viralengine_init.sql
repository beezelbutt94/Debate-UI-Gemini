-- ViralEngine schema.
--
-- Auth identity comes from Clerk via Supabase's native third-party auth
-- integration: Clerk issues the session JWT, Supabase validates it against
-- Clerk's JWKS, and auth.jwt()->>'sub' is the Clerk user id. users.id
-- stores that same Clerk user id directly (text, not uuid) so RLS never
-- needs a join back to an auth.users table that doesn't exist here.
--
-- Applied directly to the `unseen-reels` project (ref dcesehxmssqsszzasott)
-- via the Supabase MCP server; this file is the reproducible source for
-- standing up a fresh project with `supabase db push`.

-- ---------------------------------------------------------------------
-- updated_at trigger helper
-- ---------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------
-- users — one row per Clerk user, linked to Stripe customer
-- ---------------------------------------------------------------------
create table public.users (
  id text primary key,                 -- Clerk user id ("user_...")
  email text not null,
  stripe_customer_id text unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger users_set_updated_at
  before update on public.users
  for each row execute function public.set_updated_at();

alter table public.users enable row level security;

create policy "users_select_own" on public.users
  for select using (id = (auth.jwt()->>'sub'));
create policy "users_update_own" on public.users
  for update using (id = (auth.jwt()->>'sub'));
-- Insert/delete happen only via the service-role Clerk webhook handler
-- (app/api/webhooks/clerk), which bypasses RLS — no client-facing
-- insert/delete policy.

-- ---------------------------------------------------------------------
-- creators_profiles — niche, handles, connected metrics, Mem0 agent key
-- ---------------------------------------------------------------------
create table public.creators_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id text not null references public.users(id) on delete cascade,
  niche text,
  handles jsonb not null default '{}'::jsonb,             -- {"tiktok": "@handle", "youtube": "@handle", ...}
  connected_metrics jsonb not null default '{}'::jsonb,    -- cached vidIQ/Metricool/Semrush snapshots
  mem0_agent_key text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger creators_profiles_set_updated_at
  before update on public.creators_profiles
  for each row execute function public.set_updated_at();

create index creators_profiles_user_id_idx on public.creators_profiles(user_id);

alter table public.creators_profiles enable row level security;

create policy "creators_profiles_all_own" on public.creators_profiles
  for all
  using (user_id = (auth.jwt()->>'sub'))
  with check (user_id = (auth.jwt()->>'sub'));

-- ---------------------------------------------------------------------
-- audit_reports — Viral Gap Analyzer / Deep-Dive / Upload Diagnostic /
-- Competitor Espionage output
-- ---------------------------------------------------------------------
create table public.audit_reports (
  id uuid primary key default gen_random_uuid(),
  user_id text not null references public.users(id) on delete cascade,
  creator_profile_id uuid references public.creators_profiles(id) on delete set null,
  source_type text not null check (source_type in ('url', 'account', 'upload', 'competitors')),
  source_url text,
  platform text check (platform in ('tiktok', 'youtube_shorts', 'facebook_reels')),
  viral_score numeric check (viral_score >= 0 and viral_score <= 100),
  analysis jsonb not null,                                 -- full structured audit payload
  timeline_recommendations jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

create index audit_reports_user_id_idx on public.audit_reports(user_id);
create index audit_reports_creator_profile_id_idx on public.audit_reports(creator_profile_id);

alter table public.audit_reports enable row level security;

create policy "audit_reports_select_own" on public.audit_reports
  for select using (user_id = (auth.jwt()->>'sub'));
-- Inserts happen server-side (service role) via /api/analyze/* after quota
-- checks, never directly from the client.

-- ---------------------------------------------------------------------
-- scripts — storyboards, tone parameters, target platform
-- ---------------------------------------------------------------------
create table public.scripts (
  id uuid primary key default gen_random_uuid(),
  user_id text not null references public.users(id) on delete cascade,
  creator_profile_id uuid references public.creators_profiles(id) on delete set null,
  title text not null,
  source_prompt text,
  storyboard jsonb not null,          -- scene-by-scene: visual, hook, audio/sfx, retention loop, CTA
  tone_parameters jsonb not null default '{}'::jsonb,
  target_platform text check (target_platform in ('tiktok', 'youtube_shorts', 'facebook_reels')),
  created_at timestamptz not null default now()
);

create index scripts_user_id_idx on public.scripts(user_id);

alter table public.scripts enable row level security;

create policy "scripts_all_own" on public.scripts
  for all
  using (user_id = (auth.jwt()->>'sub'))
  with check (user_id = (auth.jwt()->>'sub'));

-- ---------------------------------------------------------------------
-- scheduled_posts — content calendar
-- ---------------------------------------------------------------------
create table public.scheduled_posts (
  id uuid primary key default gen_random_uuid(),
  user_id text not null references public.users(id) on delete cascade,
  platform text not null check (platform in ('tiktok', 'youtube_shorts', 'facebook_reels')),
  publish_at timestamptz not null,
  media_urls text[] not null default '{}',
  caption text,
  status text not null default 'draft' check (status in ('draft', 'scheduled', 'published', 'failed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger scheduled_posts_set_updated_at
  before update on public.scheduled_posts
  for each row execute function public.set_updated_at();

create index scheduled_posts_user_id_idx on public.scheduled_posts(user_id);
create index scheduled_posts_publish_at_idx on public.scheduled_posts(publish_at);

alter table public.scheduled_posts enable row level security;

create policy "scheduled_posts_all_own" on public.scheduled_posts
  for all
  using (user_id = (auth.jwt()->>'sub'))
  with check (user_id = (auth.jwt()->>'sub'));

-- ---------------------------------------------------------------------
-- subscriptions — Stripe plan tier + quota usage
-- ---------------------------------------------------------------------
create table public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id text not null unique references public.users(id) on delete cascade,
  stripe_subscription_id text unique,
  stripe_price_id text,
  plan_tier text not null default 'creator' check (plan_tier in ('creator', 'pro', 'studio')),
  status text not null default 'incomplete',
  quota_analyses_used int not null default 0,
  quota_analyses_limit int not null default 10,
  current_period_end timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger subscriptions_set_updated_at
  before update on public.subscriptions
  for each row execute function public.set_updated_at();

alter table public.subscriptions enable row level security;

create policy "subscriptions_select_own" on public.subscriptions
  for select using (user_id = (auth.jwt()->>'sub'));
-- Inserts/updates happen only via the service-role Clerk/Stripe webhook
-- handlers.

-- ---------------------------------------------------------------------
-- Atomic quota consumption, mirroring ViralSync's consume_credits()
-- pattern so two concurrent analyses can't both pass a check that only
-- one quota unit actually covers. SECURITY DEFINER because it must read
-- and update another row's quota counter under RLS — locked down to
-- service_role only below, since letting anon/authenticated call it
-- directly would let any signed-in user drain any other user's quota by
-- passing an arbitrary p_user_id.
-- ---------------------------------------------------------------------
create or replace function public.consume_analysis_quota(p_user_id text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ok boolean;
begin
  update public.subscriptions
  set quota_analyses_used = quota_analyses_used + 1
  where user_id = p_user_id
    and quota_analyses_used < quota_analyses_limit
  returning true into v_ok;

  return coalesce(v_ok, false);
end;
$$;

revoke execute on function public.consume_analysis_quota(text) from public;
grant execute on function public.consume_analysis_quota(text) to service_role;

-- ---------------------------------------------------------------------
-- Compensating transaction for an analysis whose quota unit was consumed
-- but the analysis itself then failed (extraction/LLM error) before an
-- audit_reports row was ever written. Without this, a failed analysis
-- permanently burns the user's quota for nothing. Mirrors ViralSync's
-- fail_campaign_and_refund() pattern: server-only, and safe to call twice
-- for the same failure since it simply floors at 0 rather than tracking
-- per-attempt state.
-- ---------------------------------------------------------------------
create or replace function public.refund_analysis_quota(p_user_id text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.subscriptions
  set quota_analyses_used = greatest(quota_analyses_used - 1, 0)
  where user_id = p_user_id;
end;
$$;

revoke execute on function public.refund_analysis_quota(text) from public;
grant execute on function public.refund_analysis_quota(text) to service_role;

-- ---------------------------------------------------------------------
-- stripe_webhook_events — dedupe table so a Stripe webhook retry (Stripe
-- retries on anything but a 2xx) can't double-apply a subscription
-- change. The webhook handler inserts the event id before processing;
-- a primary-key conflict means it already ran, so it returns 200 without
-- touching subscriptions again.
-- ---------------------------------------------------------------------
create table public.stripe_webhook_events (
  id text primary key,
  created_at timestamptz not null default now()
);

alter table public.stripe_webhook_events enable row level security;
-- No policies: only the service-role webhook handler touches this table.
