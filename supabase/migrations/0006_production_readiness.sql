-- Safe to re-run: every statement is idempotent.
--
-- Production-readiness pass: a real free tier, monthly quota periods, safe
-- scheduled publishing, an application event log for the admin area, and a
-- cache for the Tool Suite Hub's AI recommendations.

-- ---------------------------------------------------------------------
-- 1. Free tier, distinct from the paid Creator plan.
--
-- Until now 'creator' was both the free default and the lowest paid plan,
-- so paying for Creator changed nothing. Free is now its own tier; paid
-- tiers keep their existing quotas (see lib/plans.ts).
-- ---------------------------------------------------------------------
alter table public.subscriptions drop constraint if exists subscriptions_plan_tier_check;
alter table public.subscriptions
  add constraint subscriptions_plan_tier_check
  check (plan_tier in ('free', 'creator', 'pro', 'studio'));

alter table public.subscriptions alter column plan_tier set default 'free';
alter table public.subscriptions alter column status set default 'active';
alter table public.subscriptions alter column quota_analyses_limit set default 3;

-- When the current quota period started. The free plan rolls over monthly
-- from this timestamp (in consume_analysis_quota); paid plans are reset by
-- the Stripe webhook on each paid renewal invoice so the period matches the
-- billing cycle (lib/billing.ts).
alter table public.subscriptions
  add column if not exists quota_period_start timestamptz not null default now();
alter table public.subscriptions
  add column if not exists cancel_at_period_end boolean not null default false;

-- Rows with no Stripe subscription were free users all along.
update public.subscriptions
  set plan_tier = 'free', quota_analyses_limit = 3
  where stripe_subscription_id is null;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'subscriptions_quota_non_negative') then
    alter table public.subscriptions add constraint subscriptions_quota_non_negative check (quota_analyses_used >= 0 and quota_analyses_limit >= 0);
  end if;
end;
$$;

-- ---------------------------------------------------------------------
-- 2. Quota consumption with monthly rollover for free plans.
--
-- Same signature and atomicity as before (a single UPDATE ... WHERE used <
-- limit), plus a rollover step so a free user's quota actually renews.
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
  set quota_analyses_used = 0,
      quota_period_start = now()
  where user_id = p_user_id
    and plan_tier = 'free'
    and quota_period_start <= now() - interval '1 month';

  update public.subscriptions
  set quota_analyses_used = quota_analyses_used + 1
  where user_id = p_user_id
    and quota_analyses_used < quota_analyses_limit
  returning true into v_ok;

  return coalesce(v_ok, false);
end;
$$;

revoke all on function public.consume_analysis_quota(text) from public, anon, authenticated;
grant execute on function public.consume_analysis_quota(text) to service_role;

revoke all on function public.refund_analysis_quota(text) from public, anon, authenticated;
grant execute on function public.refund_analysis_quota(text) to service_role;

-- ---------------------------------------------------------------------
-- 3. Scheduled publishing: a 'publishing' claim state so two overlapping
-- cron runs can never publish the same post twice, plus a record of where
-- it was published.
-- ---------------------------------------------------------------------
alter table public.scheduled_posts drop constraint if exists scheduled_posts_status_check;
alter table public.scheduled_posts
  add constraint scheduled_posts_status_check
  check (status in ('draft', 'scheduled', 'publishing', 'published', 'failed'));

alter table public.scheduled_posts add column if not exists external_post_id text;
alter table public.scheduled_posts add column if not exists published_at timestamptz;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'scheduled_posts_caption_length') then
    alter table public.scheduled_posts add constraint scheduled_posts_caption_length check (caption is null or char_length(caption) <= 2200);
  end if;
end;
$$;
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'scheduled_posts_media_count') then
    alter table public.scheduled_posts add constraint scheduled_posts_media_count check (cardinality(media_urls) <= 4);
  end if;
end;
$$;

create index if not exists scheduled_posts_due_idx
  on public.scheduled_posts (status, publish_at);

-- ---------------------------------------------------------------------
-- 4. Application event log: failures and notable actions, for the admin
-- area. No foreign key on user_id so a log write can never fail because
-- of a missing or deleted user. Holds no secrets or content, only event
-- names and small diagnostic fields (see lib/events.ts).
-- ---------------------------------------------------------------------
create table if not exists public.app_events (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  level text not null check (level in ('info', 'warn', 'error')),
  event text not null check (char_length(event) <= 100),
  user_id text,
  detail jsonb not null default '{}'::jsonb
);

create index if not exists app_events_created_at_idx on public.app_events (created_at desc);
create index if not exists app_events_level_created_at_idx on public.app_events (level, created_at desc);

alter table public.app_events enable row level security;
-- No policies: only server code using the service role reads or writes it.

-- ---------------------------------------------------------------------
-- 5. Tool Suite Hub recommendation cache. The hub used to call Claude on
-- every page load; now it reuses the last answer until the user's reports
-- or scripts change (digest_hash).
-- ---------------------------------------------------------------------
create table if not exists public.tool_recommendation_cache (
  user_id text primary key references public.users(id) on delete cascade,
  digest_hash text not null,
  recommendations jsonb not null,
  created_at timestamptz not null default now()
);

alter table public.tool_recommendation_cache enable row level security;

drop policy if exists "tool_recommendation_cache_select_own" on public.tool_recommendation_cache;
create policy "tool_recommendation_cache_select_own" on public.tool_recommendation_cache
  for select using (user_id = ((select auth.jwt())->>'sub'));

-- ---------------------------------------------------------------------
-- 6. Bounds on user-supplied text stored in reports.
-- ---------------------------------------------------------------------
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'audit_reports_source_url_length') then
    alter table public.audit_reports add constraint audit_reports_source_url_length check (source_url is null or char_length(source_url) <= 2048);
  end if;
end;
$$;
