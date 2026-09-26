-- Re-apply (and widen) the EXECUTE revokes that 0002 intended.
--
-- Verified against the live database: despite the REVOKE statements at the
-- bottom of 0002, `get_platform_refresh_token` and
-- `store_platform_refresh_token` were both executable by `anon` and
-- `authenticated`. Confirmed by calling the REST RPC endpoint with the
-- public anon key -- it returned HTTP 200, not 403.
--
-- Why that matters: `get_platform_refresh_token` is SECURITY DEFINER, takes
-- an arbitrary p_user_id, and returns the *decrypted* Vault secret. The anon
-- key is public by design (it ships in the browser bundle), so any visitor
-- could have enumerated user ids and read every creator's TikTok / Google Ads
-- refresh token -- full takeover of their ad accounts. The write side is just
-- as bad: `store_platform_refresh_token` would let anyone repoint a
-- creator's connection at an attacker-controlled account.
--
-- The likely cause is Supabase's default privileges granting EXECUTE on
-- public functions to anon/authenticated. A plain REVOKE in the same
-- migration is not durable against that, so this migration also removes the
-- default-privilege grant for future functions rather than only fixing the
-- four that exist today.

-- 1. Stop new functions in `public` from being granted to anon/authenticated
--    by default. Without this, the next migration reintroduces the hole.
alter default privileges in schema public revoke execute on functions from anon, authenticated;

-- 2-4. These functions predate this repo's migrations: they were created in
--    the live database by an earlier version of the app and no migration here
--    creates them. Guard each block on the function existing so a fresh
--    project (`supabase db push`) applies cleanly instead of failing on a
--    missing function, while an existing database still gets locked down.
do $$
begin
  -- Server-only: these read and write Vault-encrypted OAuth credentials and
  -- must be reachable solely by the service role.
  if to_regprocedure('public.get_platform_refresh_token(uuid, text)') is not null then
    revoke all on function public.get_platform_refresh_token(uuid, text) from public, anon, authenticated;
    grant execute on function public.get_platform_refresh_token(uuid, text) to service_role;
  end if;

  if to_regprocedure('public.store_platform_refresh_token(uuid, text, text, text, text)') is not null then
    revoke all on function public.store_platform_refresh_token(uuid, text, text, text, text) from public, anon, authenticated;
    grant execute on function public.store_platform_refresh_token(uuid, text, text, text, text) to service_role;
  end if;

  -- A trigger function. Nothing should ever call it over the REST API.
  if to_regprocedure('public.handle_new_user()') is not null then
    revoke all on function public.handle_new_user() from public, anon, authenticated;
  end if;

  -- consume_credits is meant to be called by a signed-in user (it derives
  -- the caller from auth.uid()), so `authenticated` keeps EXECUTE; anon has
  -- no auth.uid(), so there is no reason to leave it exposed.
  if to_regprocedure('public.consume_credits(bigint, text, text)') is not null then
    revoke all on function public.consume_credits(bigint, text, text) from public, anon;
    grant execute on function public.consume_credits(bigint, text, text) to authenticated;
  end if;
end;
$$;
