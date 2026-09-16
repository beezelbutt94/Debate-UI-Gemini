import type { OAuthProvider, TokenExchangeResult } from './types';

// design:content:write -- create designs on the user's behalf (the one
// action the Tool Suite Hub would actually drive: turning a
// recommendation into a real Canva design instead of a deep link).
// profile:read -- label the connection with the user's Canva name.
const SCOPES = 'design:content:write design:meta:read profile:read';

/**
 * Canva Connect API OAuth2 (Authorization Code + PKCE, required even for
 * this confidential/server-side client):
 * https://www.canva.dev/docs/connect/authentication/
 * https://www.canva.dev/docs/connect/api-reference/authentication/generate-access-token/
 *
 * Of the five services investigated for this layer, Canva is the only one
 * with a genuine self-serve, multi-tenant OAuth product a third party can
 * register without a partnership conversation -- see
 * docs/VIRALENGINE_ROADMAP.md. A *private* integration (Canva Developer
 * Portal) works immediately for testing; going live for arbitrary users
 * requires submitting it to Canva's integration review queue.
 */
export const canvaProvider: OAuthProvider = {
  requiresPkce: true,

  authorizationUrl({ state, redirectUri, codeChallenge }) {
    const url = new URL('https://www.canva.com/api/oauth/authorize');
    url.searchParams.set('client_id', requireEnv('CANVA_CLIENT_ID'));
    url.searchParams.set('redirect_uri', redirectUri);
    url.searchParams.set('response_type', 'code');
    url.searchParams.set('scope', SCOPES);
    url.searchParams.set('state', state);
    url.searchParams.set('code_challenge', codeChallenge ?? '');
    url.searchParams.set('code_challenge_method', 'S256');
    return url.toString();
  },

  async exchangeCode({ code, redirectUri, codeVerifier }): Promise<TokenExchangeResult> {
    const res = await fetch('https://api.canva.com/rest/v1/oauth/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Authorization: `Basic ${basicAuth()}`,
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        code_verifier: codeVerifier ?? '',
        redirect_uri: redirectUri,
      }),
    });

    if (!res.ok) {
      throw new Error(`Canva token exchange failed: ${res.status} ${await res.text()}`);
    }

    const body = await res.json();
    const label = await fetchDisplayName(body.access_token);

    return {
      accessToken: body.access_token,
      refreshToken: body.refresh_token ?? null,
      expiresAt: new Date(Date.now() + body.expires_in * 1000).toISOString(),
      externalAccountId: null, // Connect API's profile endpoint doesn't expose a stable user id, only display name
      externalAccountLabel: label,
      scope: body.scope ?? SCOPES,
    };
  },

  async refreshAccessToken(refreshToken: string) {
    const res = await fetch('https://api.canva.com/rest/v1/oauth/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Authorization: `Basic ${basicAuth()}`,
      },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
      }),
    });

    if (!res.ok) {
      throw new Error(`Canva token refresh failed: ${res.status} ${await res.text()}`);
    }

    const body = await res.json();
    return {
      accessToken: body.access_token as string,
      expiresAt: new Date(Date.now() + body.expires_in * 1000).toISOString(),
      refreshToken: (body.refresh_token as string | undefined) ?? null,
    };
  },
};

async function fetchDisplayName(accessToken: string): Promise<string | null> {
  try {
    const res = await fetch('https://api.canva.com/rest/v1/users/me/profile', {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!res.ok) return null;
    const body = await res.json();
    return body?.display_name ?? null;
  } catch {
    return null;
  }
}

function basicAuth(): string {
  return Buffer.from(`${requireEnv('CANVA_CLIENT_ID')}:${requireEnv('CANVA_CLIENT_SECRET')}`).toString('base64');
}

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} is not configured. Create an integration at canva.dev and set it.`);
  }
  return value;
}
