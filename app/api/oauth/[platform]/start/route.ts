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

  const authorizationUrl = provider.authorizationUrl({ state, redirectUri, codeChallenge });

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
