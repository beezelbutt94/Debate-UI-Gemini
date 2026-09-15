import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { getOAuthProvider, isOAuthPlatform } from '@/lib/oauth';
import { generateState, stateCookieName } from '@/lib/oauth/state';

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
    return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });
  }

  const origin = req.nextUrl.origin;
  const redirectUri = `${origin}/api/oauth/${platform}/callback`;
  const state = generateState();

  let authorizationUrl: string;
  try {
    authorizationUrl = getOAuthProvider(platform).authorizationUrl({ state, redirectUri });
  } catch (err) {
    // Missing TIKTOK_CLIENT_ID / GOOGLE_ADS_CLIENT_ID, etc. This is a
    // deployment-configuration issue, not a user error — surface it as a
    // redirect back to the dashboard rather than an unhandled 500.
    console.error(`${platform} OAuth not configured:`, (err as Error).message);
    return NextResponse.redirect(new URL(`/?oauth=not_configured&platform=${platform}`, req.url));
  }

  const res = NextResponse.redirect(authorizationUrl);
  res.cookies.set(stateCookieName(platform), state, {
    httpOnly: true,
    // Browsers drop Secure cookies on plain http, which silently breaks the
    // callback's CSRF check on http://localhost. Production is https, so
    // this still sets Secure everywhere it matters.
    secure: req.nextUrl.protocol === 'https:',
    sameSite: 'lax',
    maxAge: 600,
    path: '/',
  });
  return res;
}
