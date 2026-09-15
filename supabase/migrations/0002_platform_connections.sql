-- Per-creator OAuth connections to TikTok / Google Ads, per the compliance
-- requirement that ViralSync only ever spends a creator's own, OAuth-
-- authorized ad account budget — never a shared ViralSync-owned account.
--
-- Refresh tokens are never stored in plaintext. They go into Supabase
-- Vault (pgsodium-encrypted) and this table only holds the resulting
-- secret id. Only the two SECURITY DEFINER functions below can read or
-- write that secret, and both are restricted to the service_role — the
-- OAuth callback route (server-only, already behind an authenticated
-- session + CSRF state check) is the only caller.

create table if not exists public.platform_connections (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.users (id) on delete cascade,
  platform text not null check (platform in ('tiktok', 'google')),
  external_account_id text,
  refresh_token_secret_id uuid not null,
  scope text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, platform)
);

alter table public.platform_connections enable row level security;

create policy "platform_connections_select_own" on public.platform_connections
  for select using (auth.uid() = user_id);

-- No authenticated insert/update/delete policy: only the functions below,
-- called from the server-only OAuth callback with the service role key,
-- write to this table.

create or replace function public.store_platform_refresh_token(
  p_user_id uuid,
  p_platform text,
  p_external_account_id text,
  p_refresh_token text,
  p_scope text
)
returns void
language plpgsql
security definer
set search_path = public, vault
as $$
declare
  v_secret_id uuid;
begin
  v_secret_id := vault.create_secret(p_refresh_token, p_platform || ':' || p_user_id::text);

  insert into public.platform_connections
    (user_id, platform, external_account_id, refresh_token_secret_id, scope)
  values
    (p_user_id, p_platform, p_external_account_id, v_secret_id, p_scope)
  on conflict (user_id, platform) do update
    set external_account_id = excluded.external_account_id,
        refresh_token_secret_id = excluded.refresh_token_secret_id,
        scope = excluded.scope,
        updated_at = now();
end;
$$;

revoke all on function public.store_platform_refresh_token(uuid, text, text, text, text) from public, anon, authenticated;
grant execute on function public.store_platform_refresh_token(uuid, text, text, text, text) to service_role;

create or replace function public.get_platform_refresh_token(
  p_user_id uuid,
  p_platform text
)
returns text
language plpgsql
security definer
set search_path = public, vault
as $$
declare
  v_secret_id uuid;
  v_token text;
begin
  select refresh_token_secret_id into v_secret_id
    from public.platform_connections
    where user_id = p_user_id and platform = p_platform;

  if v_secret_id is null then
    return null;
  end if;

  select decrypted_secret into v_token from vault.decrypted_secrets where id = v_secret_id;
  return v_token;
end;
$$;

revoke all on function public.get_platform_refresh_token(uuid, text) from public, anon, authenticated;
grant execute on function public.get_platform_refresh_token(uuid, text) to service_role;
