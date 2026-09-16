import type { OAuthProvider, TokenExchangeResult } from './types';

// Upload-only. youtube.upload grants insert on the creator's own channel
// and nothing else -- deliberately narrower than the full `youtube` scope,
// which would also allow reading and deleting their existing videos.
const YOUTUBE_UPLOAD_SCOPE = 'https://www.googleapis.com/auth/youtube.upload';

/**
 * Google OAuth2 (standard web server flow), scoped to YouTube uploads:
 * https://developers.google.com/youtube/v3/guides/uploading_a_video
 *
 * Note the app must pass Google's OAuth verification for this scope before
 * it works outside a test-user list.
 *
 * `access_type=offline` + `prompt=consent` is required to get a refresh
 * token back on every authorization, not just the first one.
 */
export const googleProvider: OAuthProvider = {
  authorizationUrl({ state, redirectUri }) {
    const url = new URL('https://accounts.google.com/o/oauth2/v2/auth');
    url.searchParams.set('client_id', requireEnv('GOOGLE_CLIENT_ID'));
    url.searchParams.set('redirect_uri', redirectUri);
    url.searchParams.set('response_type', 'code');
    url.searchParams.set('scope', YOUTUBE_UPLOAD_SCOPE);
    url.searchParams.set('access_type', 'offline');
    url.searchParams.set('prompt', 'consent');
    url.searchParams.set('state', state);
    return url.toString();
  },

  async exchangeCode({ code, redirectUri }): Promise<TokenExchangeResult> {
    const res = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: requireEnv('GOOGLE_CLIENT_ID'),
        client_secret: requireEnv('GOOGLE_CLIENT_SECRET'),
        code,
        grant_type: 'authorization_code',
        redirect_uri: redirectUri,
      }),
    });

    if (!res.ok) {
      throw new Error(`Google token exchange failed: ${res.status} ${await res.text()}`);
    }

    const body = await res.json();
    if (!body.refresh_token) {
      throw new Error(
        'Google did not return a refresh_token. This happens on re-consent without prompt=consent, ' +
          'or if the user already granted this app access — revoke access at myaccount.google.com/permissions and retry.'
      );
    }

    // Which channel this grant covers. Unlike the Ads equivalent this needs
    // no extra developer token -- the upload scope is enough to read the
    // authorizing user's own channel.
    const externalAccountId = await tryGetChannelId(body.access_token);

    return {
      refreshToken: body.refresh_token,
      externalAccountId,
      scope: body.scope ?? YOUTUBE_UPLOAD_SCOPE,
    };
  },
};

async function tryGetChannelId(accessToken: string): Promise<string | null> {
  // Best-effort: the connection is valid and storable without it, so a
  // failure here must not fail the whole OAuth callback. It is a display
  // convenience, not a credential.
  try {
    const res = await fetch(
      'https://www.googleapis.com/youtube/v3/channels?part=id&mine=true',
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    if (!res.ok) return null;
    const body = await res.json();
    return body?.items?.[0]?.id ?? null;
  } catch {
    return null;
  }
}

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} is not configured. Register an OAuth client in Google Cloud Console and set it.`);
  }
  return value;
}
