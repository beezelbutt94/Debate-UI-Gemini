import { describe, it, expect } from 'vitest';
import { getOAuthProvider } from '@/lib/oauth';

describe('getOAuthProvider()', () => {
  it('returns a provider object for youtube', () => {
    const p = getOAuthProvider('youtube');
    expect(p).toBeDefined();
    expect(typeof p.authorizationUrl).toBe('function');
    expect(typeof p.exchangeCode).toBe('function');
    expect(typeof p.refreshAccessToken).toBe('function');
  });

  it('returns a provider object for tiktok', () => {
    const p = getOAuthProvider('tiktok');
    expect(p).toBeDefined();
    expect(typeof p.authorizationUrl).toBe('function');
  });

  it('returns a provider object for facebook', () => {
    const p = getOAuthProvider('facebook');
    expect(p).toBeDefined();
    expect(typeof p.authorizationUrl).toBe('function');
  });

  it('returns a provider object for canva', () => {
    const p = getOAuthProvider('canva');
    expect(p).toBeDefined();
    expect(typeof p.authorizationUrl).toBe('function');
  });

  // PKCE requirements -------------------------------------------------------
  it('youtube does NOT require PKCE', () => {
    expect(getOAuthProvider('youtube').requiresPkce).toBe(false);
  });

  it('tiktok does NOT require PKCE', () => {
    expect(getOAuthProvider('tiktok').requiresPkce).toBe(false);
  });

  it('facebook does NOT require PKCE', () => {
    expect(getOAuthProvider('facebook').requiresPkce).toBe(false);
  });

  it('canva DOES require PKCE', () => {
    expect(getOAuthProvider('canva').requiresPkce).toBe(true);
  });

  // Authorization URL shape -------------------------------------------------
  it('youtube authorizationUrl includes accounts.google.com', () => {
    process.env.YOUTUBE_OAUTH_CLIENT_ID = 'test-client-id';
    const url = getOAuthProvider('youtube').authorizationUrl({
      state: 'my-state',
      redirectUri: 'https://example.com/callback',
    });
    expect(url).toContain('accounts.google.com');
    expect(url).toContain('state=my-state');
    expect(url).toContain('response_type=code');
    expect(url).toContain('access_type=offline');
  });

  it('tiktok authorizationUrl includes tiktok.com and the client_key', () => {
    process.env.TIKTOK_OAUTH_CLIENT_KEY = 'test-tiktok-key';
    const url = getOAuthProvider('tiktok').authorizationUrl({
      state: 'tok-state',
      redirectUri: 'https://example.com/callback',
    });
    expect(url).toContain('tiktok.com');
    expect(url).toContain('state=tok-state');
    expect(url).toContain('response_type=code');
  });

  it('facebook authorizationUrl includes facebook.com dialog/oauth', () => {
    process.env.FACEBOOK_APP_ID = 'test-fb-app-id';
    const url = getOAuthProvider('facebook').authorizationUrl({
      state: 'fb-state',
      redirectUri: 'https://example.com/callback',
    });
    expect(url).toContain('facebook.com');
    expect(url).toContain('dialog/oauth');
    expect(url).toContain('state=fb-state');
  });

  it('canva authorizationUrl includes canva.com and code_challenge_method=S256', () => {
    process.env.CANVA_CLIENT_ID = 'test-canva-id';
    const url = getOAuthProvider('canva').authorizationUrl({
      state: 'cv-state',
      redirectUri: 'https://example.com/callback',
      codeChallenge: 'E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM',
    });
    expect(url).toContain('canva.com');
    expect(url).toContain('code_challenge_method=S256');
    expect(url).toContain('state=cv-state');
  });

  it('youtube authorizationUrl throws if YOUTUBE_OAUTH_CLIENT_ID is not set', () => {
    const saved = process.env.YOUTUBE_OAUTH_CLIENT_ID;
    delete process.env.YOUTUBE_OAUTH_CLIENT_ID;
    expect(() =>
      getOAuthProvider('youtube').authorizationUrl({ state: 's', redirectUri: 'https://example.com/cb' })
    ).toThrow('YOUTUBE_OAUTH_CLIENT_ID');
    process.env.YOUTUBE_OAUTH_CLIENT_ID = saved;
  });
});
