export type OAuthPlatform = 'youtube' | 'tiktok' | 'facebook' | 'canva';

export interface TokenExchangeResult {
  accessToken: string;
  refreshToken: string | null;
  expiresAt: string | null; // ISO timestamp, null if the access token doesn't expire
  externalAccountId: string | null;
  externalAccountLabel: string | null;
  scope: string;
}

export interface AuthorizationUrlParams {
  state: string;
  redirectUri: string;
  /** Only used by providers that require PKCE (Canva). Ignored otherwise. */
  codeChallenge?: string;
}

export interface ExchangeCodeParams {
  code: string;
  redirectUri: string;
  /** Only used by providers that require PKCE (Canva). Ignored otherwise. */
  codeVerifier?: string;
}

export interface OAuthProvider {
  /** True if this provider's authorization request needs a PKCE code_challenge. */
  requiresPkce: boolean;
  /** Builds the URL to redirect the user to for consent. */
  authorizationUrl(params: AuthorizationUrlParams): string;
  /** Exchanges a one-time authorization code for token(s). */
  exchangeCode(params: ExchangeCodeParams): Promise<TokenExchangeResult>;
  /** Exchanges a refresh token for a new access token. Throws if this provider never issues one. */
  refreshAccessToken(refreshToken: string): Promise<{ accessToken: string; expiresAt: string | null; refreshToken: string | null }>;
}

export function isOAuthPlatform(value: string): value is OAuthPlatform {
  return value === 'youtube' || value === 'tiktok' || value === 'facebook' || value === 'canva';
}
