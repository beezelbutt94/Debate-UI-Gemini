import { describe, it, expect } from 'vitest';
import { getOAuthProvider } from '@/lib/oauth/index';

describe('getOAuthProvider()', () => {
  it('returns the YouTube provider', () => {
    const p = getOAuthProvider('youtube');
    expect(p).toBeDefined();
    expect(typeof p.authorizationUrl).toBe('function');
    expect(typeof p.exchangeCode).toBe('function');
    expect(typeof p.refreshAccessToken).toBe('function');
  });

  it('youtube provider does not require PKCE', () => {
    expect(getOAuthProvider('youtube').requiresPkce).toBe(false);
  });

  it('returns the TikTok provider', () => {
    const p = getOAuthProvider('tiktok');
    expect(p).toBeDefined();
    expect(typeof p.authorizationUrl).toBe('function');
  });

  it('tiktok provider does not require PKCE', () => {
    expect(getOAuthProvider('tiktok').requiresPkce).toBe(false);
  });

  it('returns the Facebook provider', () => {
    const p = getOAuthProvider('facebook');
    expect(p).toBeDefined();
    expect(typeof p.authorizationUrl).toBe('function');
  });

  it('facebook provider does not require PKCE', () => {
    expect(getOAuthProvider('facebook').requiresPkce).toBe(false);
  });

  it('returns the Canva provider', () => {
    const p = getOAuthProvider('canva');
    expect(p).toBeDefined();
    expect(typeof p.authorizationUrl).toBe('function');
  });

  it('canva provider requires PKCE', () => {
    expect(getOAuthProvider('canva').requiresPkce).toBe(true);
  });

  it('returns the same object reference on repeated calls (idempotent registry)', () => {
    expect(getOAuthProvider('youtube')).toBe(getOAuthProvider('youtube'));
  });
});

describe('OAuth provider authorizationUrl()', () => {
  const redirectUri = 'https://example.com/callback';
  const state = 'test-state-value';

  // YouTube
  it('youtube builds a google OAuth URL', () => {
    process.env.YOUTUBE_OAUTH_CLIENT_ID = 'yt-client-id';
    const url = new URL(getOAuthProvider('youtube').authorizationUrl({ state, redirectUri }));
    expect(url.hostname).toBe('accounts.google.com');
    expect(url.searchParams.get('client_id')).toBe('yt-client-id');
    expect(url.searchParams.get('state')).toBe(state);
    expect(url.searchParams.get('redirect_uri')).toBe(redirectUri);
    expect(url.searchParams.get('response_type')).toBe('code');
    expect(url.searchParams.get('access_type')).toBe('offline');
    expect(url.searchParams.get('prompt')).toBe('consent');
  });

  it('youtube authorizationUrl throws when YOUTUBE_OAUTH_CLIENT_ID is missing', () => {
    delete process.env.YOUTUBE_OAUTH_CLIENT_ID;
    expect(() =>
      getOAuthProvider('youtube').authorizationUrl({ state, redirectUri })
    ).toThrow('YOUTUBE_OAUTH_CLIENT_ID');
  });

  // TikTok
  it('tiktok builds a TikTok OAuth URL', () => {
    process.env.TIKTOK_OAUTH_CLIENT_KEY = 'tt-client-key';
    const url = new URL(getOAuthProvider('tiktok').authorizationUrl({ state, redirectUri }));
    expect(url.hostname).toBe('www.tiktok.com');
    expect(url.searchParams.get('client_key')).toBe('tt-client-key');
    expect(url.searchParams.get('state')).toBe(state);
    expect(url.searchParams.get('response_type')).toBe('code');
  });

  it('tiktok authorizationUrl throws when TIKTOK_OAUTH_CLIENT_KEY is missing', () => {
    delete process.env.TIKTOK_OAUTH_CLIENT_KEY;
    expect(() =>
      getOAuthProvider('tiktok').authorizationUrl({ state, redirectUri })
    ).toThrow('TIKTOK_OAUTH_CLIENT_KEY');
  });

  // Facebook
  it('facebook builds a Facebook OAuth URL', () => {
    process.env.FACEBOOK_APP_ID = 'fb-app-id';
    const url = new URL(getOAuthProvider('facebook').authorizationUrl({ state, redirectUri }));
    expect(url.hostname).toBe('www.facebook.com');
    expect(url.searchParams.get('client_id')).toBe('fb-app-id');
    expect(url.searchParams.get('state')).toBe(state);
    expect(url.searchParams.get('response_type')).toBe('code');
  });

  it('facebook authorizationUrl throws when FACEBOOK_APP_ID is missing', () => {
    delete process.env.FACEBOOK_APP_ID;
    expect(() =>
      getOAuthProvider('facebook').authorizationUrl({ state, redirectUri })
    ).toThrow('FACEBOOK_APP_ID');
  });

  // Canva
  it('canva builds a Canva OAuth URL with PKCE params', () => {
    process.env.CANVA_CLIENT_ID = 'canva-client-id';
    const codeChallenge = 'some-code-challenge';
    const url = new URL(
      getOAuthProvider('canva').authorizationUrl({ state, redirectUri, codeChallenge })
    );
    expect(url.hostname).toBe('www.canva.com');
    expect(url.searchParams.get('client_id')).toBe('canva-client-id');
    expect(url.searchParams.get('code_challenge')).toBe(codeChallenge);
    expect(url.searchParams.get('code_challenge_method')).toBe('S256');
    expect(url.searchParams.get('state')).toBe(state);
  });

  it('canva authorizationUrl throws when CANVA_CLIENT_ID is missing', () => {
    delete process.env.CANVA_CLIENT_ID;
    expect(() =>
      getOAuthProvider('canva').authorizationUrl({ state, redirectUri, codeChallenge: 'x' })
    ).toThrow('CANVA_CLIENT_ID');
  });
});
