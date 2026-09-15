import type { OAuthProvider, TokenExchangeResult } from './types';

/**
 * TikTok for Business (Marketing API) advertiser authorization — distinct
 * from TikTok's consumer "Login Kit". This is the flow that grants access
 * to a creator's own ad account (advertiser_id) so Spark Ads campaigns can
 * be placed against their budget, per TikTok's docs:
 * https://business-api.tiktok.com/portal/docs (Authentication)
 *
 * Verify these endpoints against the current docs before going live —
 * TikTok has migrated OAuth versions before (v1.2 -> v1.3) and could again.
 */
export const tiktokProvider: OAuthProvider = {
  authorizationUrl({ state, redirectUri }) {
    const url = new URL('https://business-api.tiktok.com/portal/auth');
    url.searchParams.set('app_id', requireEnv('TIKTOK_CLIENT_ID'));
    url.searchParams.set('state', state);
    url.searchParams.set('redirect_uri', redirectUri);
    return url.toString();
  },

  async exchangeCode({ code }): Promise<TokenExchangeResult> {
    const res = await fetch('https://business-api.tiktok.com/open_api/v1.3/oauth2/access_token/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        app_id: requireEnv('TIKTOK_CLIENT_ID'),
        secret: requireEnv('TIKTOK_CLIENT_SECRET'),
        auth_code: code,
      }),
    });

    if (!res.ok) {
      throw new Error(`TikTok token exchange failed: ${res.status} ${await res.text()}`);
    }

    const body = await res.json();
    // TikTok's Marketing API v1.3 access_token is long-lived and doubles as
    // the durable credential — there's no separate short/long token pair
    // the way Google's OAuth works. We store it as-is via the generic
    // "refreshToken" field so the rest of the system doesn't need to know
    // the difference.
    const data = body?.data;
    if (!data?.access_token) {
      throw new Error(`TikTok token exchange returned no access_token: ${JSON.stringify(body)}`);
    }

    return {
      refreshToken: data.access_token,
      externalAccountId: Array.isArray(data.advertiser_ids) ? data.advertiser_ids[0] ?? null : null,
      scope: Array.isArray(data.scope) ? data.scope.join(',') : '',
    };
  },
};

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} is not configured. Register a TikTok for Business app and set it.`);
  }
  return value;
}
