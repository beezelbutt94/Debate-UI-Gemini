import { auth } from '@clerk/nextjs/server';
import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { getOAuthProvider, isOAuthPlatform } from '@/lib/oauth';
import { stateCookieName, codeVerifierCookieName } from '@/lib/oauth/state';
import { logEvent } from '@/lib/events';
import { ensureAccount } from '@/lib/account';

const CONNECTIONS_PATH = '/dashboard/settings/connections';

export async function GET(req: NextRequest, { params }: { params: Promise<{ platform: string }> }) {
  const { platform } = await params;
  if (!isOAuthPlatform(platform)) {
    return NextResponse.json({ error: 'unknown_platform' }, { status: 404 });
  }

  const { userId } = await auth();
  if (!userId) {
    return NextResponse.redirect(new URL(`${CONNECTIONS_PATH}?oauth=unauthenticated`, req.url));
  }

  const stateCookie = stateCookieName(platform);
  const verifierCookie = codeVerifierCookieName(platform);
  const expectedState = req.cookies.get(stateCookie)?.value;
  const returnedState = req.nextUrl.searchParams.get('state');
  const code = req.nextUrl.searchParams.get('code');
  const codeVerifier = req.cookies.get(verifierCookie)?.value;

  if (!expectedState || !returnedState || expectedState !== returnedState) {
    return clearCookiesAndRedirect(req, platform, 'state_mismatch');
  }
  if (!code) {
    return clearCookiesAndRedirect(req, platform, 'missing_code');
  }

  const provider = getOAuthProvider(platform);
  const origin = req.nextUrl.origin;
  const redirectUri = `${origin}/api/oauth/${platform}/callback`;

  let result;
  try {
    result = await provider.exchangeCode({ code, redirectUri, codeVerifier });
  } catch (err) {
    await logEvent('error', 'oauth.exchange_failed', { userId, detail: { platform }, error: err });
    return clearCookiesAndRedirect(req, platform, 'exchange_failed');
  }

  // Service-role write: identity was already confirmed above via the
  // authenticated Clerk session, and the token(s) must go through the
  // Vault-backed store_platform_connection() function, which is
  // deliberately restricted to service_role (0002_platform_connections.sql).
  const admin = createSupabaseAdminClient();
  // platform_connections.user_id references users(id).
  await ensureAccount(userId);
  const { error } = await admin.rpc('store_platform_connection', {
    p_user_id: userId,
    p_platform: platform,
    p_external_account_id: result.externalAccountId,
    p_external_account_label: result.externalAccountLabel,
    p_access_token: result.accessToken,
    p_refresh_token: result.refreshToken,
    p_expires_at: result.expiresAt,
    p_scope: result.scope,
  });

  if (error) {
    await logEvent('error', 'oauth.store_failed', { userId, detail: { platform, code: error.code } });
    return clearCookiesAndRedirect(req, platform, 'store_failed');
  }

  await logEvent('info', 'oauth.connected', { userId, detail: { platform } });
  return clearCookiesAndRedirect(req, platform, 'connected');
}

function clearCookiesAndRedirect(req: NextRequest, platform: string, status: string) {
  const res = NextResponse.redirect(new URL(`${CONNECTIONS_PATH}?oauth=${status}&platform=${platform}`, req.url));
  res.cookies.delete(stateCookieName(platform));
  res.cookies.delete(codeVerifierCookieName(platform));
  return res;
}
