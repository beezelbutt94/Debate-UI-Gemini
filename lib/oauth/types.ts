export type OAuthPlatform = 'tiktok' | 'google';

export interface TokenExchangeResult {
  refreshToken: string;
  externalAccountId: string | null;
  scope: string;
}

export interface OAuthProvider {
  /** Builds the URL to redirect the user to for consent. */
  authorizationUrl(params: { state: string; redirectUri: string }): string;
  /** Exchanges a one-time authorization code for a long-lived refresh token. */
  exchangeCode(params: { code: string; redirectUri: string }): Promise<TokenExchangeResult>;
}

export function isOAuthPlatform(value: string): value is OAuthPlatform {
  return value === 'tiktok' || value === 'google';
}
