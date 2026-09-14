-- ViralSync core schema: credit-based billing + campaign tracking.
-- Run via `supabase db push` or the Supabase MCP `apply_migration` tool.

-- ---------------------------------------------------------------------
-- users: one row per auth.users, holds Stripe linkage + credit balance
-- ---------------------------------------------------------------------
create table if not exists public.users (
  id uuid primary key references auth.users (id) on delete cascade,
  stripe_customer_id text unique,
  stripe_subscription_id text,
  plan text not null default 'none' check (plan in ('none', 'starter', 'pro', 'agency')),
  active_credits bigint not null default 0 check (active_credits >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.users enable row level security;

-- Users may read their own row. All writes to active_credits go through
-- the consume_credits() function or the service-role Stripe webhook —
-- never a direct client UPDATE — so there is no authenticated UPDATE policy.
create policy "users_select_own" on public.users
  for select using (auth.uid() = id);

-- Auto-create a users row when someone signs up.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.users (id) values (new.id)
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------
-- credit_ledger: append-only audit trail of every credit grant/spend
-- ---------------------------------------------------------------------
create table if not exists public.credit_ledger (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.users (id) on delete cascade,
  delta bigint not null,
  reason text not null,
  stripe_event_id text unique,
  campaign_log_id bigint,
  created_at timestamptz not null default now()
);

alter table public.credit_ledger enable row level security;

create policy "credit_ledger_select_own" on public.credit_ledger
  for select using (auth.uid() = user_id);

-- No authenticated insert/update/delete policy: only consume_credits()
-- (security definer) and the service-role webhook write to this table.

-- ---------------------------------------------------------------------
-- campaign_logs: one row per pasted URL submitted for amplification
-- ---------------------------------------------------------------------
create table if not exists public.campaign_logs (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.users (id) on delete cascade,
  pasted_url text not null,
  platform text not null check (platform in ('tiktok', 'youtube')),
  credits_charged bigint not null check (credits_charged > 0),
  status text not null default 'pending' check (status in ('pending', 'active', 'failed', 'completed')),
  external_campaign_id text,
  created_at timestamptz not null default now()
);

alter table public.campaign_logs enable row level security;

create policy "campaign_logs_select_own" on public.campaign_logs
  for select using (auth.uid() = user_id);

-- No authenticated insert policy: rows are created only via consume_credits().

-- ---------------------------------------------------------------------
-- consume_credits: atomic check-and-decrement, callable by the owning user
-- ---------------------------------------------------------------------
create or replace function public.consume_credits(
  p_amount bigint,
  p_pasted_url text,
  p_platform text
)
returns public.campaign_logs
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_campaign public.campaign_logs;
begin
  if v_user_id is null then
    raise exception 'not authenticated';
  end if;

  update public.users
    set active_credits = active_credits - p_amount,
        updated_at = now()
    where id = v_user_id
      and active_credits >= p_amount;

  if not found then
    raise exception 'insufficient_credits' using errcode = 'P0001';
  end if;

  insert into public.campaign_logs (user_id, pasted_url, platform, credits_charged, status)
    values (v_user_id, p_pasted_url, p_platform, p_amount, 'pending')
    returning * into v_campaign;

  insert into public.credit_ledger (user_id, delta, reason, campaign_log_id)
    values (v_user_id, -p_amount, 'campaign_submitted', v_campaign.id);

  return v_campaign;
end;
$$;

grant execute on function public.consume_credits(bigint, text, text) to authenticated;
