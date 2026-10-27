import { describe, it, expect } from 'vitest';
import { getOAuthProvider } from '@/lib/oauth';

describe('getOAuthProvider()', () => {
  it('returns a provider for youtube', () => {
    const provider = getOAuthProvider('youtube');
    expect(provider).toBeDefined();
    expect(typeof provider.authorizationUrl).toBe('function');
    expect(typeof provider.exchangeCode).toBe('function');
    expect(typeof provider.refreshAccessToken).toBe('function');
  });

  it('returns a provider for tiktok', () => {
    const provider = getOAuthProvider('tiktok');
    expect(provider).toBeDefined();
    expect(typeof provider.authorizationUrl).toBe('function');
  });

  it('returns a provider for facebook', () => {
    const provider = getOAuthProvider('facebook');
    expect(provider).toBeDefined();
    expect(typeof provider.authorizationUrl).toBe('function');
  });

  it('returns a provider for canva', () => {
    const provider = getOAuthProvider('canva');
    expect(provider).toBeDefined();
    expect(typeof provider.authorizationUrl).toBe('function');
  });

  // requiresPkce flags
  it('youtube provider does not require PKCE', () => {
    expect(getOAuthProvider('youtube').requiresPkce).toBe(false);
  });

  it('tiktok provider does not require PKCE', () => {
    expect(getOAuthProvider('tiktok').requiresPkce).toBe(false);
  });

  it('facebook provider does not require PKCE', () => {
    expect(getOAuthProvider('facebook').requiresPkce).toBe(false);
  });

  it('canva provider requires PKCE', () => {
    expect(getOAuthProvider('canva').requiresPkce).toBe(true);
  });

  // authorizationUrl builds correct base URL when env vars are present
  it('youtube authorizationUrl targets Google OAuth endpoint', () => {
    process.env.YOUTUBE_OAUTH_CLIENT_ID = 'test-client-id';
    const url = getOAuthProvider('youtube').authorizationUrl({
      state: 'test-state',
      redirectUri: 'https://example.com/callback',
    });
    expect(url).toContain('accounts.google.com');
    expect(url).toContain('youtube.upload');
    expect(url).toContain('state=test-state');
    expect(url).toContain('access_type=offline');
    expect(url).toContain('prompt=consent');
    delete process.env.YOUTUBE_OAUTH_CLIENT_ID;
  });

  it('tiktok authorizationUrl targets TikTok v2 endpoint', () => {
    process.env.TIKTOK_OAUTH_CLIENT_KEY = 'test-key';
    const url = getOAuthProvider('tiktok').authorizationUrl({
      state: 'test-state',
      redirectUri: 'https://example.com/callback',
    });
    expect(url).toContain('tiktok.com/v2/auth/authorize');
    expect(url).toContain('video.publish');
    expect(url).toContain('state=test-state');
    delete process.env.TIKTOK_OAUTH_CLIENT_KEY;
  });

  it('facebook authorizationUrl targets Facebook Graph dialog endpoint', () => {
    process.env.FACEBOOK_APP_ID = 'test-app-id';
    const url = getOAuthProvider('facebook').authorizationUrl({
      state: 'test-state',
      redirectUri: 'https://example.com/callback',
    });
    expect(url).toContain('facebook.com');
    expect(url).toContain('dialog/oauth');
    expect(url).toContain('pages_show_list');
    expect(url).toContain('state=test-state');
    delete process.env.FACEBOOK_APP_ID;
  });

  it('canva authorizationUrl includes code_challenge when provided', () => {
    process.env.CANVA_CLIENT_ID = 'test-client-id';
    const url = getOAuthProvider('canva').authorizationUrl({
      state: 'test-state',
      redirectUri: 'https://example.com/callback',
      codeChallenge: 'test-challenge',
    });
    expect(url).toContain('canva.com/api/oauth/authorize');
    expect(url).toContain('code_challenge=test-challenge');
    expect(url).toContain('code_challenge_method=S256');
    delete process.env.CANVA_CLIENT_ID;
  });

  it('youtube authorizationUrl throws when YOUTUBE_OAUTH_CLIENT_ID is missing', () => {
    delete process.env.YOUTUBE_OAUTH_CLIENT_ID;
    expect(() =>
      getOAuthProvider('youtube').authorizationUrl({
        state: 'state',
        redirectUri: 'https://example.com/callback',
      })
    ).toThrow('YOUTUBE_OAUTH_CLIENT_ID');
  });

  it('tiktok authorizationUrl throws when TIKTOK_OAUTH_CLIENT_KEY is missing', () => {
    delete process.env.TIKTOK_OAUTH_CLIENT_KEY;
    expect(() =>
      getOAuthProvider('tiktok').authorizationUrl({
        state: 'state',
        redirectUri: 'https://example.com/callback',
      })
    ).toThrow('TIKTOK_OAUTH_CLIENT_KEY');
  });

  it('facebook authorizationUrl throws when FACEBOOK_APP_ID is missing', () => {
    delete process.env.FACEBOOK_APP_ID;
    expect(() =>
      getOAuthProvider('facebook').authorizationUrl({
        state: 'state',
        redirectUri: 'https://example.com/callback',
      })
    ).toThrow('FACEBOOK_APP_ID');
  });

  it('canva authorizationUrl throws when CANVA_CLIENT_ID is missing', () => {
    delete process.env.CANVA_CLIENT_ID;
    expect(() =>
      getOAuthProvider('canva').authorizationUrl({
        state: 'state',
        redirectUri: 'https://example.com/callback',
      })
    ).toThrow('CANVA_CLIENT_ID');
  });
});
