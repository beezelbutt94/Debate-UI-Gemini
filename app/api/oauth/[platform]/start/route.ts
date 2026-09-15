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

  const authorizationUrl = getOAuthProvider(platform).authorizationUrl({ state, redirectUri });

  const res = NextResponse.redirect(authorizationUrl);
  res.cookies.set(stateCookieName(platform), state, {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    maxAge: 600,
    path: '/',
  });
  return res;
}
