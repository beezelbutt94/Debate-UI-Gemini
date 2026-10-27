import { describe, it, expect } from 'vitest';
import { getOAuthProvider } from '@/lib/oauth';

describe('getOAuthProvider', () => {
  it('returns youtube provider', () => {
    const p = getOAuthProvider('youtube');
    expect(p).toBeDefined();
    expect(typeof p.authorizationUrl).toBe('function');
    expect(typeof p.exchangeCode).toBe('function');
    expect(typeof p.refreshAccessToken).toBe('function');
  });

  it('youtube provider does not require PKCE', () => {
    expect(getOAuthProvider('youtube').requiresPkce).toBe(false);
  });

  it('returns tiktok provider', () => {
    const p = getOAuthProvider('tiktok');
    expect(p).toBeDefined();
    expect(typeof p.authorizationUrl).toBe('function');
  });

  it('tiktok provider does not require PKCE', () => {
    expect(getOAuthProvider('tiktok').requiresPkce).toBe(false);
  });

  it('returns facebook provider', () => {
    const p = getOAuthProvider('facebook');
    expect(p).toBeDefined();
    expect(typeof p.authorizationUrl).toBe('function');
  });

  it('facebook provider does not require PKCE', () => {
    expect(getOAuthProvider('facebook').requiresPkce).toBe(false);
  });

  it('returns canva provider', () => {
    const p = getOAuthProvider('canva');
    expect(p).toBeDefined();
    expect(typeof p.authorizationUrl).toBe('function');
  });

  it('canva provider requires PKCE', () => {
    expect(getOAuthProvider('canva').requiresPkce).toBe(true);
  });

  it('all providers implement the full OAuthProvider interface', () => {
    for (const platform of ['youtube', 'tiktok', 'facebook', 'canva'] as const) {
      const p = getOAuthProvider(platform);
      expect(typeof p.requiresPkce).toBe('boolean');
      expect(typeof p.authorizationUrl).toBe('function');
      expect(typeof p.exchangeCode).toBe('function');
      expect(typeof p.refreshAccessToken).toBe('function');
    }
  });

  it('youtube authorizationUrl throws without env vars', () => {
    expect(() =>
      getOAuthProvider('youtube').authorizationUrl({
        state: 'abc',
        redirectUri: 'https://example.com/callback',
      })
    ).toThrow();
  });

  it('tiktok authorizationUrl throws without env vars', () => {
    expect(() =>
      getOAuthProvider('tiktok').authorizationUrl({
        state: 'abc',
        redirectUri: 'https://example.com/callback',
      })
    ).toThrow();
  });

  it('facebook authorizationUrl throws without env vars', () => {
    expect(() =>
      getOAuthProvider('facebook').authorizationUrl({
        state: 'abc',
        redirectUri: 'https://example.com/callback',
      })
    ).toThrow();
  });

  it('canva authorizationUrl throws without env vars', () => {
    expect(() =>
      getOAuthProvider('canva').authorizationUrl({
        state: 'abc',
        redirectUri: 'https://example.com/callback',
        codeChallenge: 'challenge',
      })
    ).toThrow();
  });
});

describe('OAuth provider authorizationUrl (with env vars set)', () => {
  it('youtube authorizationUrl includes required params', () => {
    process.env.YOUTUBE_OAUTH_CLIENT_ID = 'test-client-id';
    process.env.YOUTUBE_OAUTH_CLIENT_SECRET = 'test-secret';
    const url = new URL(
      getOAuthProvider('youtube').authorizationUrl({
        state: 'mystate',
        redirectUri: 'https://app.example.com/callback',
      })
    );
    expect(url.searchParams.get('client_id')).toBe('test-client-id');
    expect(url.searchParams.get('state')).toBe('mystate');
    expect(url.searchParams.get('redirect_uri')).toBe('https://app.example.com/callback');
    expect(url.searchParams.get('response_type')).toBe('code');
    expect(url.searchParams.get('access_type')).toBe('offline');
    expect(url.searchParams.get('prompt')).toBe('consent');
    delete process.env.YOUTUBE_OAUTH_CLIENT_ID;
    delete process.env.YOUTUBE_OAUTH_CLIENT_SECRET;
  });

  it('tiktok authorizationUrl includes required params', () => {
    process.env.TIKTOK_OAUTH_CLIENT_KEY = 'tt-client-key';
    process.env.TIKTOK_OAUTH_CLIENT_SECRET = 'tt-secret';
    const url = new URL(
      getOAuthProvider('tiktok').authorizationUrl({
        state: 'ttstate',
        redirectUri: 'https://app.example.com/callback',
      })
    );
    expect(url.searchParams.get('client_key')).toBe('tt-client-key');
    expect(url.searchParams.get('state')).toBe('ttstate');
    expect(url.searchParams.get('response_type')).toBe('code');
    delete process.env.TIKTOK_OAUTH_CLIENT_KEY;
    delete process.env.TIKTOK_OAUTH_CLIENT_SECRET;
  });

  it('facebook authorizationUrl includes required params', () => {
    process.env.FACEBOOK_APP_ID = 'fb-app-id';
    process.env.FACEBOOK_APP_SECRET = 'fb-secret';
    const url = new URL(
      getOAuthProvider('facebook').authorizationUrl({
        state: 'fbstate',
        redirectUri: 'https://app.example.com/callback',
      })
    );
    expect(url.searchParams.get('client_id')).toBe('fb-app-id');
    expect(url.searchParams.get('state')).toBe('fbstate');
    expect(url.searchParams.get('response_type')).toBe('code');
    delete process.env.FACEBOOK_APP_ID;
    delete process.env.FACEBOOK_APP_SECRET;
  });

  it('canva authorizationUrl includes PKCE params', () => {
    process.env.CANVA_CLIENT_ID = 'canva-client';
    process.env.CANVA_CLIENT_SECRET = 'canva-secret';
    const url = new URL(
      getOAuthProvider('canva').authorizationUrl({
        state: 'cvstate',
        redirectUri: 'https://app.example.com/callback',
        codeChallenge: 'mychallenge',
      })
    );
    expect(url.searchParams.get('client_id')).toBe('canva-client');
    expect(url.searchParams.get('code_challenge')).toBe('mychallenge');
    expect(url.searchParams.get('code_challenge_method')).toBe('S256');
    delete process.env.CANVA_CLIENT_ID;
    delete process.env.CANVA_CLIENT_SECRET;
  });
});
