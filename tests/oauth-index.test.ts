import { describe, it, expect } from 'vitest';
import { getOAuthProvider } from '@/lib/oauth/index';

describe('getOAuthProvider()', () => {
  it('returns the youtube provider', () => {
    const p = getOAuthProvider('youtube');
    expect(p).toBeDefined();
    expect(typeof p.authorizationUrl).toBe('function');
    expect(typeof p.exchangeCode).toBe('function');
    expect(typeof p.refreshAccessToken).toBe('function');
  });

  it('youtube provider does not require PKCE', () => {
    expect(getOAuthProvider('youtube').requiresPkce).toBe(false);
  });

  it('returns the tiktok provider', () => {
    const p = getOAuthProvider('tiktok');
    expect(p).toBeDefined();
    expect(typeof p.authorizationUrl).toBe('function');
  });

  it('tiktok provider does not require PKCE', () => {
    expect(getOAuthProvider('tiktok').requiresPkce).toBe(false);
  });

  it('returns the facebook provider', () => {
    const p = getOAuthProvider('facebook');
    expect(p).toBeDefined();
    expect(typeof p.authorizationUrl).toBe('function');
  });

  it('facebook provider does not require PKCE', () => {
    expect(getOAuthProvider('facebook').requiresPkce).toBe(false);
  });

  it('returns the canva provider', () => {
    const p = getOAuthProvider('canva');
    expect(p).toBeDefined();
    expect(typeof p.authorizationUrl).toBe('function');
  });

  it('canva provider REQUIRES PKCE', () => {
    expect(getOAuthProvider('canva').requiresPkce).toBe(true);
  });

  it('each call returns the same singleton provider instance', () => {
    expect(getOAuthProvider('youtube')).toBe(getOAuthProvider('youtube'));
  });

  it('different platforms return different providers', () => {
    expect(getOAuthProvider('youtube')).not.toBe(getOAuthProvider('tiktok'));
  });
});

describe('youtube provider authorizationUrl()', () => {
  const originalEnv = process.env;

  it('builds a valid Google OAuth URL', () => {
    process.env = { ...originalEnv, YOUTUBE_OAUTH_CLIENT_ID: 'test-client-id' };
    const provider = getOAuthProvider('youtube');
    const url = provider.authorizationUrl({
      state: 'test-state',
      redirectUri: 'https://example.com/callback',
    });
    expect(url).toContain('accounts.google.com');
    expect(url).toContain('client_id=test-client-id');
    expect(url).toContain('state=test-state');
    expect(url).toContain('access_type=offline');
    expect(url).toContain('prompt=consent');
    process.env = originalEnv;
  });

  it('throws when YOUTUBE_OAUTH_CLIENT_ID is not set', () => {
    process.env = { ...originalEnv, YOUTUBE_OAUTH_CLIENT_ID: undefined };
    delete process.env.YOUTUBE_OAUTH_CLIENT_ID;
    const provider = getOAuthProvider('youtube');
    expect(() =>
      provider.authorizationUrl({ state: 's', redirectUri: 'https://example.com/cb' })
    ).toThrow('YOUTUBE_OAUTH_CLIENT_ID');
    process.env = originalEnv;
  });
});

describe('tiktok provider authorizationUrl()', () => {
  const originalEnv = process.env;

  it('builds a valid TikTok OAuth URL', () => {
    process.env = { ...originalEnv, TIKTOK_OAUTH_CLIENT_KEY: 'tiktok-key' };
    const provider = getOAuthProvider('tiktok');
    const url = provider.authorizationUrl({
      state: 'my-state',
      redirectUri: 'https://example.com/callback',
    });
    expect(url).toContain('tiktok.com');
    expect(url).toContain('client_key=tiktok-key');
    expect(url).toContain('state=my-state');
    expect(url).toContain('scope=video.publish');
    process.env = originalEnv;
  });

  it('throws when TIKTOK_OAUTH_CLIENT_KEY is not set', () => {
    process.env = { ...originalEnv };
    delete process.env.TIKTOK_OAUTH_CLIENT_KEY;
    const provider = getOAuthProvider('tiktok');
    expect(() =>
      provider.authorizationUrl({ state: 's', redirectUri: 'https://example.com/cb' })
    ).toThrow('TIKTOK_OAUTH_CLIENT_KEY');
    process.env = originalEnv;
  });
});

describe('facebook provider authorizationUrl()', () => {
  const originalEnv = process.env;

  it('builds a valid Facebook OAuth URL', () => {
    process.env = { ...originalEnv, FACEBOOK_APP_ID: 'fb-app-id' };
    const provider = getOAuthProvider('facebook');
    const url = provider.authorizationUrl({
      state: 'fb-state',
      redirectUri: 'https://example.com/callback',
    });
    expect(url).toContain('facebook.com');
    expect(url).toContain('client_id=fb-app-id');
    expect(url).toContain('state=fb-state');
    expect(url).toContain('scope=pages_show_list');
    process.env = originalEnv;
  });

  it('throws when FACEBOOK_APP_ID is not set', () => {
    process.env = { ...originalEnv };
    delete process.env.FACEBOOK_APP_ID;
    const provider = getOAuthProvider('facebook');
    expect(() =>
      provider.authorizationUrl({ state: 's', redirectUri: 'https://example.com/cb' })
    ).toThrow('FACEBOOK_APP_ID');
    process.env = originalEnv;
  });
});

describe('canva provider authorizationUrl()', () => {
  const originalEnv = process.env;

  it('builds a valid Canva OAuth URL with PKCE', () => {
    process.env = { ...originalEnv, CANVA_CLIENT_ID: 'canva-id' };
    const provider = getOAuthProvider('canva');
    const url = provider.authorizationUrl({
      state: 'canva-state',
      redirectUri: 'https://example.com/callback',
      codeChallenge: 'my-code-challenge',
    });
    expect(url).toContain('canva.com');
    expect(url).toContain('client_id=canva-id');
    expect(url).toContain('code_challenge=my-code-challenge');
    expect(url).toContain('code_challenge_method=S256');
    process.env = originalEnv;
  });

  it('throws when CANVA_CLIENT_ID is not set', () => {
    process.env = { ...originalEnv };
    delete process.env.CANVA_CLIENT_ID;
    const provider = getOAuthProvider('canva');
    expect(() =>
      provider.authorizationUrl({ state: 's', redirectUri: 'https://example.com/cb' })
    ).toThrow('CANVA_CLIENT_ID');
    process.env = originalEnv;
  });
});
