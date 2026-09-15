import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { getOAuthProvider, isOAuthPlatform } from '@/lib/oauth';
import { stateCookieName } from '@/lib/oauth/state';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ platform: string }> }
) {
  const { platform } = await params;
  if (!isOAuthPlatform(platform)) {
    return NextResponse.json({ error: 'unknown_platform' }, { status: 404 });
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.redirect(new URL('/?oauth=unauthenticated', req.url));
  }

  const cookieName = stateCookieName(platform);
  const expectedState = req.cookies.get(cookieName)?.value;
  const returnedState = req.nextUrl.searchParams.get('state');

  // TikTok's redirect carries the code as `auth_code`; Google's as `code`.
  const code = req.nextUrl.searchParams.get(platform === 'tiktok' ? 'auth_code' : 'code');

  if (!expectedState || !returnedState || expectedState !== returnedState) {
    return NextResponse.redirect(new URL('/?oauth=state_mismatch', req.url));
  }
  if (!code) {
    return NextResponse.redirect(new URL('/?oauth=missing_code', req.url));
  }

  const origin = req.nextUrl.origin;
  const redirectUri = `${origin}/api/oauth/${platform}/callback`;

  let result;
  try {
    result = await getOAuthProvider(platform).exchangeCode({ code, redirectUri });
  } catch (err) {
    console.error(`${platform} OAuth exchange failed:`, (err as Error).message);
    const res = NextResponse.redirect(new URL('/?oauth=exchange_failed', req.url));
    res.cookies.delete(cookieName);
    return res;
  }

  // Service-role write: the user's identity was already confirmed above via
  // the RLS-scoped session, and the refresh token must go through the
  // Vault-backed store_platform_refresh_token() function, which is
  // deliberately restricted to service_role (see 0002_platform_connections.sql).
  const admin = createSupabaseAdminClient();
  const { error } = await admin.rpc('store_platform_refresh_token', {
    p_user_id: user.id,
    p_platform: platform,
    p_external_account_id: result.externalAccountId,
    p_refresh_token: result.refreshToken,
    p_scope: result.scope,
  });

  const res = NextResponse.redirect(
    new URL(error ? '/?oauth=store_failed' : `/?oauth=connected&platform=${platform}`, req.url)
  );
  res.cookies.delete(cookieName);
  return res;
}
