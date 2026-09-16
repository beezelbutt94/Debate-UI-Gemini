import type { OAuthProvider, TokenExchangeResult } from './types';

const PUBLISH_SCOPE = 'video.publish';

/**
 * TikTok Content Posting API OAuth (Login Kit v2) -- distinct from the
 * older TikTok for Business/Marketing API. This is the flow that grants
 * `video.publish` so a Direct Post call can post to the connected TikTok
 * user's own profile:
 * https://developers.tiktok.com/doc/login-kit-web
 * https://developers.tiktok.com/doc/oauth-user-access-token-management
 *
 * Until this app's client passes TikTok's content audit, everything it
 * publishes is forced to private/self-only visibility regardless of the
 * privacy_level requested -- see lib/publish/tiktok.ts and
 * docs/VIRALENGINE_ROADMAP.md.
 */
export const tiktokProvider: OAuthProvider = {
  requiresPkce: false,

  authorizationUrl({ state, redirectUri }) {
    const url = new URL('https://www.tiktok.com/v2/auth/authorize/');
    url.searchParams.set('client_key', requireEnv('TIKTOK_OAUTH_CLIENT_KEY'));
    url.searchParams.set('scope', PUBLISH_SCOPE);
    url.searchParams.set('response_type', 'code');
    url.searchParams.set('redirect_uri', redirectUri);
    url.searchParams.set('state', state);
    return url.toString();
  },

  async exchangeCode({ code, redirectUri }): Promise<TokenExchangeResult> {
    const res = await fetch('https://open.tiktokapis.com/v2/oauth/token/', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Accept: 'application/json',
      },
      body: new URLSearchParams({
        client_key: requireEnv('TIKTOK_OAUTH_CLIENT_KEY'),
        client_secret: requireEnv('TIKTOK_OAUTH_CLIENT_SECRET'),
        code,
        grant_type: 'authorization_code',
        redirect_uri: redirectUri,
      }),
    });

    const body = await res.json();
    if (!res.ok || body.error) {
      throw new Error(`TikTok token exchange failed: ${res.status} ${JSON.stringify(body)}`);
    }

    const label = await fetchDisplayName(body.access_token);

    return {
      accessToken: body.access_token,
      refreshToken: body.refresh_token ?? null,
      expiresAt: body.expires_in ? new Date(Date.now() + body.expires_in * 1000).toISOString() : null,
      externalAccountId: body.open_id ?? null,
      externalAccountLabel: label,
      scope: body.scope ?? PUBLISH_SCOPE,
    };
  },

  async refreshAccessToken(refreshToken: string) {
    const res = await fetch('https://open.tiktokapis.com/v2/oauth/token/', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Accept: 'application/json',
      },
      body: new URLSearchParams({
        client_key: requireEnv('TIKTOK_OAUTH_CLIENT_KEY'),
        client_secret: requireEnv('TIKTOK_OAUTH_CLIENT_SECRET'),
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
      }),
    });

    const body = await res.json();
    if (!res.ok || body.error) {
      throw new Error(`TikTok token refresh failed: ${res.status} ${JSON.stringify(body)}`);
    }

    return {
      accessToken: body.access_token as string,
      expiresAt: body.expires_in ? new Date(Date.now() + body.expires_in * 1000).toISOString() : null,
      refreshToken: (body.refresh_token as string | undefined) ?? null,
    };
  },
};

async function fetchDisplayName(accessToken: string): Promise<string | null> {
  try {
    const res = await fetch('https://open.tiktokapis.com/v2/user/info/?fields=display_name', {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!res.ok) return null;
    const body = await res.json();
    return body?.data?.user?.display_name ?? null;
  } catch {
    return null;
  }
}

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} is not configured. Register an app at developers.tiktok.com and set it.`);
  }
  return value;
}
