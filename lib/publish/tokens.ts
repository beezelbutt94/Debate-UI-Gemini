import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { getOAuthProvider } from '@/lib/oauth';
import type { ConnectablePlatform } from '@/lib/types';

interface ValidToken {
  accessToken: string;
  externalAccountId: string | null;
}

// The admin client is created without Database generics (see
// lib/supabase/admin.ts), so .rpc() falls back to an untyped result --
// this mirrors the actual row shape get_platform_connection_secrets()
// returns (0002_platform_connections.sql).
interface ConnectionSecretsRow {
  access_token: string | null;
  refresh_token: string | null;
  expires_at: string | null;
  external_account_id: string | null;
}

/**
 * Returns a usable access token for this user+platform, transparently
 * refreshing it first if it's expired (or about to be, within 60s) and a
 * refresh path exists. Returns null if there's no connection at all --
 * callers treat that as "not connected" and fail the publish attempt with
 * a clear reason rather than throwing.
 */
export async function getValidAccessToken(userId: string, platform: ConnectablePlatform): Promise<ValidToken | null> {
  const admin = createSupabaseAdminClient();
  const { data, error } = (await admin
    .rpc('get_platform_connection_secrets', { p_user_id: userId, p_platform: platform })
    .maybeSingle()) as { data: ConnectionSecretsRow | null; error: { message: string } | null };

  if (error) {
    console.error(`get_platform_connection_secrets failed for ${platform}:`, error);
    return null;
  }
  if (!data || !data.access_token) {
    return null;
  }

  const expiresAt = data.expires_at ? new Date(data.expires_at).getTime() : null;
  const isExpiring = expiresAt !== null && expiresAt - Date.now() < 60_000;

  if (!isExpiring || !data.refresh_token) {
    return { accessToken: data.access_token, externalAccountId: data.external_account_id };
  }

  const provider = getOAuthProvider(platform);
  const refreshed = await provider.refreshAccessToken(data.refresh_token);

  // Persist the refreshed access token (and rotated refresh token, if the
  // provider issued one) so the next publish attempt doesn't refresh again.
  await admin.rpc('store_platform_connection', {
    p_user_id: userId,
    p_platform: platform,
    p_external_account_id: data.external_account_id,
    p_external_account_label: null,
    p_access_token: refreshed.accessToken,
    p_refresh_token: refreshed.refreshToken ?? data.refresh_token,
    p_expires_at: refreshed.expiresAt,
    p_scope: null,
  });

  return { accessToken: refreshed.accessToken, externalAccountId: data.external_account_id };
}
