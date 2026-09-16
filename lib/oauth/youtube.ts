import type { OAuthProvider, TokenExchangeResult } from './types';

const UPLOAD_SCOPE = 'https://www.googleapis.com/auth/youtube.upload';

/**
 * Standard Google OAuth2 web server flow, scoped to YouTube uploads:
 * https://developers.google.com/identity/protocols/oauth2/web-server
 * https://developers.google.com/youtube/v3/guides/authentication
 *
 * access_type=offline + prompt=consent is required to get a refresh token
 * back on every authorization, not just the first one -- without it a
 * re-auth (e.g. after a user revokes access) silently stops returning one.
 */
export const youtubeProvider: OAuthProvider = {
  requiresPkce: false,

  authorizationUrl({ state, redirectUri }) {
    const url = new URL('https://accounts.google.com/o/oauth2/v2/auth');
    url.searchParams.set('client_id', requireEnv('YOUTUBE_OAUTH_CLIENT_ID'));
    url.searchParams.set('redirect_uri', redirectUri);
    url.searchParams.set('response_type', 'code');
    url.searchParams.set('scope', UPLOAD_SCOPE);
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
        client_id: requireEnv('YOUTUBE_OAUTH_CLIENT_ID'),
        client_secret: requireEnv('YOUTUBE_OAUTH_CLIENT_SECRET'),
        code,
        grant_type: 'authorization_code',
        redirect_uri: redirectUri,
      }),
    });

    if (!res.ok) {
      throw new Error(`YouTube token exchange failed: ${res.status} ${await res.text()}`);
    }

    const body = await res.json();
    if (!body.refresh_token) {
      throw new Error(
        'Google did not return a refresh_token. This happens on re-consent without prompt=consent, ' +
          'or if this app already has a grant for this account -- revoke access at ' +
          'myaccount.google.com/permissions and retry.'
      );
    }

    const channel = await fetchOwnChannel(body.access_token);

    return {
      accessToken: body.access_token,
      refreshToken: body.refresh_token,
      expiresAt: new Date(Date.now() + body.expires_in * 1000).toISOString(),
      externalAccountId: channel?.id ?? null,
      externalAccountLabel: channel?.title ?? null,
      scope: body.scope ?? UPLOAD_SCOPE,
    };
  },

  async refreshAccessToken(refreshToken: string) {
    const res = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: requireEnv('YOUTUBE_OAUTH_CLIENT_ID'),
        client_secret: requireEnv('YOUTUBE_OAUTH_CLIENT_SECRET'),
        refresh_token: refreshToken,
        grant_type: 'refresh_token',
      }),
    });

    if (!res.ok) {
      throw new Error(`YouTube token refresh failed: ${res.status} ${await res.text()}`);
    }

    const body = await res.json();
    return {
      accessToken: body.access_token as string,
      expiresAt: new Date(Date.now() + body.expires_in * 1000).toISOString(),
      // Google only rotates the refresh token itself in rare cases; when it
      // doesn't, the original one stays valid and nothing needs updating.
      refreshToken: (body.refresh_token as string | undefined) ?? null,
    };
  },
};

async function fetchOwnChannel(accessToken: string): Promise<{ id: string; title: string } | null> {
  try {
    const res = await fetch('https://www.googleapis.com/youtube/v3/channels?part=snippet&mine=true', {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!res.ok) return null;
    const body = await res.json();
    const item = body?.items?.[0];
    if (!item) return null;
    return { id: item.id, title: item.snippet?.title ?? item.id };
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
