-- Per-creator OAuth connections to the platforms Viral Trending can actually
-- publish to on a user's behalf: YouTube (videos.insert), TikTok (Content
-- Posting API, Direct Post), Facebook Pages (Reels Publishing API), and
-- Canva (Connect API, for a future Tool Suite Hub design-creation action).
-- Every other service investigated for this layer (Descript, OpusClip,
-- HeyGen/HyperFrames, Metricool) turned out to be account-linked/single-
-- workspace API-key products with no genuine multi-tenant OAuth a deployed
-- third party can use on behalf of arbitrary end users -- see
-- docs/VIRAL_TRENDING_ROADMAP.md for the verified findings per service.
--
-- Access/refresh tokens never touch a plain column. They go into Supabase
-- Vault (pgsodium-encrypted); this table only holds the resulting secret
-- ids. Only the SECURITY DEFINER functions below can read or write those
-- secrets, and all three are restricted to service_role -- the only caller
-- is the server-only OAuth callback route (already behind an authenticated
-- Clerk session + CSRF state check) and the cron publish trigger.

create table public.platform_connections (
  id uuid primary key default gen_random_uuid(),
  user_id text not null references public.users(id) on delete cascade,
  platform text not null check (platform in ('youtube', 'tiktok', 'facebook', 'canva')),
  external_account_id text,        -- YouTube channel id / TikTok open_id / FB Page id / Canva user id
  external_account_label text,     -- display name shown in the connections UI
  access_token_secret_id uuid not null,
  refresh_token_secret_id uuid,    -- null for providers whose access token IS the durable credential
  expires_at timestamptz,          -- null if the provider's access token doesn't expire
  scope text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, platform)
);

create trigger platform_connections_set_updated_at
  before update on public.platform_connections
  for each row execute function public.set_updated_at();

alter table public.platform_connections enable row level security;

create policy "platform_connections_select_own" on public.platform_connections
  for select using (user_id = ((select auth.jwt())->>'sub'));
-- No client-facing insert/update/delete policy: only the service-role
-- functions below (called from the OAuth callback and the disconnect
-- route) ever write to this table, since every write must also touch
-- the paired Vault secret.

-- ---------------------------------------------------------------------
-- store_platform_connection: upserts a connection row AND writes its
-- token(s) into Vault in one transaction. Re-running (re-auth) replaces
-- the old secret rather than leaking an orphaned one.
-- ---------------------------------------------------------------------
create or replace function public.store_platform_connection(
  p_user_id text,
  p_platform text,
  p_external_account_id text,
  p_external_account_label text,
  p_access_token text,
  p_refresh_token text,
  p_expires_at timestamptz,
  p_scope text
)
returns void
language plpgsql
security definer
set search_path = public, vault
as $$
declare
  v_access_secret_id uuid;
  v_refresh_secret_id uuid;
  v_old_access_secret_id uuid;
  v_old_refresh_secret_id uuid;
begin
  select access_token_secret_id, refresh_token_secret_id
    into v_old_access_secret_id, v_old_refresh_secret_id
    from public.platform_connections
    where user_id = p_user_id and platform = p_platform;

  -- vault.secrets.name is unique, and this function derives a deterministic
  -- name from platform+kind+user (so a lookup never needs a name lookup
  -- table). That means the OLD secret(s) must be deleted *before* creating
  -- the new one on a reconnect/refresh, or vault.create_secret throws a
  -- unique-constraint violation on the second connect for the same
  -- user+platform -- caught live against the real database, not assumed.
  if v_old_access_secret_id is not null then
    delete from vault.secrets where id = v_old_access_secret_id;
  end if;
  if v_old_refresh_secret_id is not null then
    delete from vault.secrets where id = v_old_refresh_secret_id;
  end if;

  v_access_secret_id := vault.create_secret(p_access_token, p_platform || ':access:' || p_user_id);
  if p_refresh_token is not null then
    v_refresh_secret_id := vault.create_secret(p_refresh_token, p_platform || ':refresh:' || p_user_id);
  end if;

  insert into public.platform_connections
    (user_id, platform, external_account_id, external_account_label,
     access_token_secret_id, refresh_token_secret_id, expires_at, scope)
  values
    (p_user_id, p_platform, p_external_account_id, p_external_account_label,
     v_access_secret_id, v_refresh_secret_id, p_expires_at, p_scope)
  on conflict (user_id, platform) do update
    set external_account_id = excluded.external_account_id,
        -- A token-refresh call (lib/publish/tokens.ts) passes null for
        -- label/scope since it isn't re-fetching profile info -- coalesce
        -- so that call doesn't blank out what the original connect set.
        external_account_label = coalesce(excluded.external_account_label, public.platform_connections.external_account_label),
        access_token_secret_id = excluded.access_token_secret_id,
        refresh_token_secret_id = excluded.refresh_token_secret_id,
        expires_at = excluded.expires_at,
        scope = coalesce(excluded.scope, public.platform_connections.scope),
        updated_at = now();
end;
$$;

revoke all on function public.store_platform_connection(text, text, text, text, text, text, timestamptz, text) from public, anon, authenticated;
grant execute on function public.store_platform_connection(text, text, text, text, text, text, timestamptz, text) to service_role;

-- ---------------------------------------------------------------------
-- get_platform_connection_secrets: decrypts and returns the tokens for
-- one user+platform connection, used by the cron publish trigger right
-- before it calls the platform's API, and by the token-refresh helper.
-- ---------------------------------------------------------------------
create or replace function public.get_platform_connection_secrets(
  p_user_id text,
  p_platform text
)
returns table (
  access_token text,
  refresh_token text,
  expires_at timestamptz,
  external_account_id text
)
language plpgsql
security definer
set search_path = public, vault
as $$
declare
  v_access_secret_id uuid;
  v_refresh_secret_id uuid;
  v_expires_at timestamptz;
  v_external_account_id text;
begin
  select access_token_secret_id, refresh_token_secret_id, platform_connections.expires_at, platform_connections.external_account_id
    into v_access_secret_id, v_refresh_secret_id, v_expires_at, v_external_account_id
    from public.platform_connections
    where user_id = p_user_id and platform = p_platform;

  if v_access_secret_id is null then
    return;
  end if;

  return query
    select
      (select decrypted_secret from vault.decrypted_secrets where id = v_access_secret_id),
      (select decrypted_secret from vault.decrypted_secrets where id = v_refresh_secret_id),
      v_expires_at,
      v_external_account_id;
end;
$$;

revoke all on function public.get_platform_connection_secrets(text, text) from public, anon, authenticated;
grant execute on function public.get_platform_connection_secrets(text, text) to service_role;

-- ---------------------------------------------------------------------
-- delete_platform_connection: disconnect. Cleans up the Vault secret(s)
-- along with the row so a disconnect doesn't leave orphaned ciphertext.
-- ---------------------------------------------------------------------
create or replace function public.delete_platform_connection(
  p_user_id text,
  p_platform text
)
returns void
language plpgsql
security definer
set search_path = public, vault
as $$
declare
  v_access_secret_id uuid;
  v_refresh_secret_id uuid;
begin
  select access_token_secret_id, refresh_token_secret_id
    into v_access_secret_id, v_refresh_secret_id
    from public.platform_connections
    where user_id = p_user_id and platform = p_platform;

  delete from public.platform_connections where user_id = p_user_id and platform = p_platform;

  if v_access_secret_id is not null then
    delete from vault.secrets where id = v_access_secret_id;
  end if;
  if v_refresh_secret_id is not null then
    delete from vault.secrets where id = v_refresh_secret_id;
  end if;
end;
$$;

revoke all on function public.delete_platform_connection(text, text) from public, anon, authenticated;
grant execute on function public.delete_platform_connection(text, text) to service_role;

-- ---------------------------------------------------------------------
-- publish_error -- so a failed cron publish attempt records *why*
-- instead of just flipping status to 'failed' silently.
-- ---------------------------------------------------------------------
alter table public.scheduled_posts add column publish_error text;
