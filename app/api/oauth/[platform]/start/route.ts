import { auth } from '@clerk/nextjs/server';
import { NextRequest, NextResponse } from 'next/server';
import { getOAuthProvider, isOAuthPlatform } from '@/lib/oauth';
import {
  generateState,
  stateCookieName,
  generateCodeVerifier,
  codeChallengeFromVerifier,
  codeVerifierCookieName,
} from '@/lib/oauth/state';
import { logEvent } from '@/lib/events';

export async function GET(req: NextRequest, { params }: { params: Promise<{ platform: string }> }) {
  const { platform } = await params;
  if (!isOAuthPlatform(platform)) {
    return NextResponse.json({ error: 'unknown_platform' }, { status: 404 });
  }

  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: 'Not authenticated.' }, { status: 401 });
  }

  const provider = getOAuthProvider(platform);
  const origin = req.nextUrl.origin;
  const redirectUri = `${origin}/api/oauth/${platform}/callback`;
  const state = generateState();

  let codeVerifier: string | undefined;
  let codeChallenge: string | undefined;
  if (provider.requiresPkce) {
    codeVerifier = generateCodeVerifier();
    codeChallenge = codeChallengeFromVerifier(codeVerifier);
  }

  let authorizationUrl: string;
  try {
    authorizationUrl = provider.authorizationUrl({ state, redirectUri, codeChallenge });
  } catch (err) {
    // Almost always a missing client id/secret for this platform.
    await logEvent('error', 'oauth.start_failed', { userId, detail: { platform }, error: err });
    return NextResponse.redirect(new URL(`/dashboard/settings/connections?oauth=not_configured&platform=${platform}`, req.url));
  }

  const res = NextResponse.redirect(authorizationUrl);
  const cookieOpts = {
    httpOnly: true,
    secure: true,
    sameSite: 'lax' as const,
    maxAge: 600,
    path: '/',
  };
  res.cookies.set(stateCookieName(platform), state, cookieOpts);
  if (codeVerifier) {
    res.cookies.set(codeVerifierCookieName(platform), codeVerifier, cookieOpts);
  }
  return res;
}
