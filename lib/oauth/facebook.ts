import type { OAuthProvider, TokenExchangeResult } from './types';

const GRAPH_VERSION = 'v21.0';
const PAGE_SCOPES = 'pages_show_list,pages_read_engagement,pages_manage_posts';

/**
 * Meta Login for Business, scoped to publishing Reels on a Facebook Page:
 * https://developers.facebook.com/docs/facebook-login/guides/access-tokens
 * https://developers.facebook.com/documentation/video-api/guides/reels-publishing
 *
 * Meta doesn't use a standard OAuth refresh_token grant. Instead: exchange
 * the short-lived user token this flow returns for a long-lived one
 * (~60 days), then use it to fetch that user's Page access tokens (which
 * inherit the long-lived token's lifetime and don't expire on their own).
 * We store the long-lived USER token as the "refresh token" -- when the
 * Page token needs renewing, refreshAccessToken() re-derives it from that
 * user token rather than performing a real refresh-token grant, since
 * Meta's model has no such grant. Once the long-lived user token itself
 * expires (~60 days of inactivity), refreshAccessToken() fails and the
 * user has to reconnect -- an honest limitation of Meta's token model, not
 * a gap in this implementation.
 *
 * This v1 connects whichever Page appears first in /me/accounts. A
 * creator who manages several Pages and wants to pick a specific one is a
 * real follow-up, same scoping-choice category as the calendar drag
 * gesture in feature 7 -- documented, not silently assumed away.
 */
export const facebookProvider: OAuthProvider = {
  requiresPkce: false,

  authorizationUrl({ state, redirectUri }) {
    const url = new URL(`https://www.facebook.com/${GRAPH_VERSION}/dialog/oauth`);
    url.searchParams.set('client_id', requireEnv('FACEBOOK_APP_ID'));
    url.searchParams.set('redirect_uri', redirectUri);
    url.searchParams.set('state', state);
    url.searchParams.set('scope', PAGE_SCOPES);
    url.searchParams.set('response_type', 'code');
    return url.toString();
  },

  async exchangeCode({ code, redirectUri }): Promise<TokenExchangeResult> {
    const shortLived = await getJson(
      `https://graph.facebook.com/${GRAPH_VERSION}/oauth/access_token`,
      {
        client_id: requireEnv('FACEBOOK_APP_ID'),
        client_secret: requireEnv('FACEBOOK_APP_SECRET'),
        redirect_uri: redirectUri,
        code,
      }
    );
    if (!shortLived.access_token) {
      throw new Error(`Facebook code exchange returned no access_token: ${JSON.stringify(shortLived)}`);
    }

    const longLived = await getJson(`https://graph.facebook.com/${GRAPH_VERSION}/oauth/access_token`, {
      grant_type: 'fb_exchange_token',
      client_id: requireEnv('FACEBOOK_APP_ID'),
      client_secret: requireEnv('FACEBOOK_APP_SECRET'),
      fb_exchange_token: shortLived.access_token,
    });
    if (!longLived.access_token) {
      throw new Error(`Facebook long-lived token exchange failed: ${JSON.stringify(longLived)}`);
    }

    const page = await fetchFirstPage(longLived.access_token);
    if (!page) {
      throw new Error(
        'This Facebook account has no Pages it manages. Reels can only be published to a Page ' +
          '(not a personal profile) -- create or get admin access to a Page and reconnect.'
      );
    }

    return {
      accessToken: page.access_token,
      refreshToken: longLived.access_token, // long-lived USER token; see module doc
      expiresAt: null, // Page tokens derived from a long-lived user token don't carry their own expiry
      externalAccountId: page.id,
      externalAccountLabel: page.name,
      scope: PAGE_SCOPES,
    };
  },

  async refreshAccessToken(refreshToken: string) {
    const page = await fetchFirstPage(refreshToken);
    if (!page) {
      throw new Error('Facebook re-derivation failed: the stored long-lived user token is no longer valid. Reconnect Facebook.');
    }
    return { accessToken: page.access_token, expiresAt: null, refreshToken: null };
  },
};

async function fetchFirstPage(userAccessToken: string): Promise<{ id: string; name: string; access_token: string } | null> {
  const body = await getJson(`https://graph.facebook.com/${GRAPH_VERSION}/me/accounts`, {
    access_token: userAccessToken,
  });
  const first = body?.data?.[0];
  if (!first?.access_token) return null;
  return { id: first.id, name: first.name ?? first.id, access_token: first.access_token };
}

async function getJson(url: string, params: Record<string, string>) {
  const withParams = new URL(url);
  for (const [key, value] of Object.entries(params)) withParams.searchParams.set(key, value);
  const res = await fetch(withParams.toString());
  const body = await res.json();
  if (!res.ok || body.error) {
    throw new Error(`Facebook Graph API call failed: ${res.status} ${JSON.stringify(body)}`);
  }
  return body;
}

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} is not configured. Register an app at developers.facebook.com and set it.`);
  }
  return value;
}
