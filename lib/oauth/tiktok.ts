import type { OAuthProvider, TokenExchangeResult } from './types';

/**
 * TikTok Login Kit, scoped for the Content Posting API — the consumer
 * creator flow, not the Business/Marketing advertiser flow this app used
 * while it placed ads:
 * https://developers.tiktok.com/doc/content-posting-api-get-started
 *
 * `video.publish` is what allows a direct post; `video.upload` alone can
 * only put a draft in the creator's inbox for them to finish by hand. An
 * app gets `video.publish` honoured only after passing TikTok's Content
 * Posting audit — before that every upload is forced to private.
 *
 * Verify these endpoints against the current docs before going live —
 * TikTok has migrated OAuth versions before and could again.
 */
export const tiktokProvider: OAuthProvider = {
  authorizationUrl({ state, redirectUri }) {
    const url = new URL('https://www.tiktok.com/v2/auth/authorize/');
    url.searchParams.set('client_key', requireEnv('TIKTOK_CLIENT_ID'));
    url.searchParams.set('response_type', 'code');
    url.searchParams.set('scope', 'user.info.basic,video.publish');
    url.searchParams.set('state', state);
    url.searchParams.set('redirect_uri', redirectUri);
    return url.toString();
  },

  async exchangeCode({ code, redirectUri }): Promise<TokenExchangeResult> {
    // Login Kit's token endpoint is form-encoded on open.tiktokapis.com --
    // not the JSON business-api.tiktok.com endpoint the advertiser flow
    // used. Posting the old shape here returns a confusing 400.
    const res = await fetch('https://open.tiktokapis.com/v2/oauth/token/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_key: requireEnv('TIKTOK_CLIENT_ID'),
        client_secret: requireEnv('TIKTOK_CLIENT_SECRET'),
        code,
        grant_type: 'authorization_code',
        redirect_uri: redirectUri,
      }),
    });

    if (!res.ok) {
      throw new Error(`TikTok token exchange failed: ${res.status} ${await res.text()}`);
    }

    const body = await res.json();
    if (!body?.refresh_token) {
      throw new Error(`TikTok token exchange returned no refresh_token: ${JSON.stringify(body)}`);
    }

    // Unlike the Marketing API's long-lived token, Login Kit does return a
    // proper short access token plus a refresh token. The refresh token is
    // the durable credential, so that is what gets vaulted.
    return {
      refreshToken: body.refresh_token,
      externalAccountId: body.open_id ?? null,
      scope: body.scope ?? '',
    };
  },
};

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} is not configured. Register a TikTok developer app with the video.publish scope and set it.`);
  }
  return value;
}
