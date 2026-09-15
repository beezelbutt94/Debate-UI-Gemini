import type { OAuthProvider, TokenExchangeResult } from './types';

const ADWORDS_SCOPE = 'https://www.googleapis.com/auth/adwords';

/**
 * Google Ads API OAuth2 (standard web server flow), scoped to the Ads API:
 * https://developers.google.com/google-ads/api/docs/oauth/overview
 *
 * `access_type=offline` + `prompt=consent` is required to get a refresh
 * token back on every authorization, not just the first one.
 */
export const googleProvider: OAuthProvider = {
  authorizationUrl({ state, redirectUri }) {
    const url = new URL('https://accounts.google.com/o/oauth2/v2/auth');
    url.searchParams.set('client_id', requireEnv('GOOGLE_ADS_CLIENT_ID'));
    url.searchParams.set('redirect_uri', redirectUri);
    url.searchParams.set('response_type', 'code');
    url.searchParams.set('scope', ADWORDS_SCOPE);
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
        client_id: requireEnv('GOOGLE_ADS_CLIENT_ID'),
        client_secret: requireEnv('GOOGLE_ADS_CLIENT_SECRET'),
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

    // Discovering which Ads customer_id(s) this grant covers requires a
    // separate call to Google Ads API's ListAccessibleCustomers, which
    // itself requires an approved GOOGLE_ADS_DEVELOPER_TOKEN. Left null
    // until that's configured; the connection still works for auth purposes.
    let externalAccountId: string | null = null;
    if (process.env.GOOGLE_ADS_DEVELOPER_TOKEN) {
      externalAccountId = await tryListAccessibleCustomer(body.access_token);
    }

    return {
      refreshToken: body.refresh_token,
      externalAccountId,
      scope: body.scope ?? ADWORDS_SCOPE,
    };
  },
};

async function tryListAccessibleCustomer(accessToken: string): Promise<string | null> {
  try {
    const res = await fetch('https://googleads.googleapis.com/v18/customers:listAccessibleCustomers', {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'developer-token': requireEnv('GOOGLE_ADS_DEVELOPER_TOKEN'),
      },
    });
    if (!res.ok) return null;
    const body = await res.json();
    const first: string | undefined = body?.resourceNames?.[0];
    return first ? first.replace('customers/', '') : null;
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
