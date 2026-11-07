import { describe, it, expect } from 'vitest';
import { getOAuthProvider } from '@/lib/oauth/index';

describe('getOAuthProvider()', () => {
  it('returns an object for youtube', () => {
    expect(typeof getOAuthProvider('youtube')).toBe('object');
  });

  it('returns an object for tiktok', () => {
    expect(typeof getOAuthProvider('tiktok')).toBe('object');
  });

  it('returns an object for facebook', () => {
    expect(typeof getOAuthProvider('facebook')).toBe('object');
  });

  it('returns an object for canva', () => {
    expect(typeof getOAuthProvider('canva')).toBe('object');
  });

  it('every provider has an authorizationUrl function', () => {
    for (const platform of ['youtube', 'tiktok', 'facebook', 'canva'] as const) {
      expect(typeof getOAuthProvider(platform).authorizationUrl).toBe('function');
    }
  });

  it('every provider has an exchangeCode function', () => {
    for (const platform of ['youtube', 'tiktok', 'facebook', 'canva'] as const) {
      expect(typeof getOAuthProvider(platform).exchangeCode).toBe('function');
    }
  });

  it('every provider has a refreshAccessToken function', () => {
    for (const platform of ['youtube', 'tiktok', 'facebook', 'canva'] as const) {
      expect(typeof getOAuthProvider(platform).refreshAccessToken).toBe('function');
    }
  });

  it('every provider has a requiresPkce boolean', () => {
    for (const platform of ['youtube', 'tiktok', 'facebook', 'canva'] as const) {
      expect(typeof getOAuthProvider(platform).requiresPkce).toBe('boolean');
    }
  });

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

  it('returns the same object reference on repeated calls (from module cache)', () => {
    expect(getOAuthProvider('youtube')).toBe(getOAuthProvider('youtube'));
  });
});

// ─── authorizationUrl — structure tests (requires env vars) ──────────────────

describe('provider.authorizationUrl()', () => {
  const params = {
    state: 'test-state-abc',
    redirectUri: 'https://app.example.com/oauth/callback',
    codeChallenge: 'challenge-xyz',
  };

  it('youtube builds a valid URL containing accounts.google.com', () => {
    process.env.YOUTUBE_OAUTH_CLIENT_ID = 'fake-yt-client';
    const url = getOAuthProvider('youtube').authorizationUrl(params);
    expect(url).toContain('accounts.google.com');
    delete process.env.YOUTUBE_OAUTH_CLIENT_ID;
  });

  it('youtube URL contains the state param', () => {
    process.env.YOUTUBE_OAUTH_CLIENT_ID = 'fake-yt-client';
    const url = getOAuthProvider('youtube').authorizationUrl(params);
    expect(url).toContain('state=test-state-abc');
    delete process.env.YOUTUBE_OAUTH_CLIENT_ID;
  });

  it('youtube URL requests offline access', () => {
    process.env.YOUTUBE_OAUTH_CLIENT_ID = 'fake-yt-client';
    const url = getOAuthProvider('youtube').authorizationUrl(params);
    expect(url).toContain('access_type=offline');
    delete process.env.YOUTUBE_OAUTH_CLIENT_ID;
  });

  it('youtube URL forces consent prompt', () => {
    process.env.YOUTUBE_OAUTH_CLIENT_ID = 'fake-yt-client';
    const url = getOAuthProvider('youtube').authorizationUrl(params);
    expect(url).toContain('prompt=consent');
    delete process.env.YOUTUBE_OAUTH_CLIENT_ID;
  });

  it('tiktok builds a valid URL containing tiktok.com/v2/auth', () => {
    process.env.TIKTOK_OAUTH_CLIENT_KEY = 'fake-tt-key';
    const url = getOAuthProvider('tiktok').authorizationUrl(params);
    expect(url).toContain('tiktok.com/v2/auth');
    delete process.env.TIKTOK_OAUTH_CLIENT_KEY;
  });

  it('tiktok URL contains the state param', () => {
    process.env.TIKTOK_OAUTH_CLIENT_KEY = 'fake-tt-key';
    const url = getOAuthProvider('tiktok').authorizationUrl(params);
    expect(url).toContain('state=test-state-abc');
    delete process.env.TIKTOK_OAUTH_CLIENT_KEY;
  });

  it('facebook builds a URL containing facebook.com', () => {
    process.env.FACEBOOK_APP_ID = 'fake-fb-id';
    const url = getOAuthProvider('facebook').authorizationUrl(params);
    expect(url).toContain('facebook.com');
    delete process.env.FACEBOOK_APP_ID;
  });

  it('facebook URL contains state param', () => {
    process.env.FACEBOOK_APP_ID = 'fake-fb-id';
    const url = getOAuthProvider('facebook').authorizationUrl(params);
    expect(url).toContain('state=test-state-abc');
    delete process.env.FACEBOOK_APP_ID;
  });

  it('canva builds a URL containing canva.com', () => {
    process.env.CANVA_CLIENT_ID = 'fake-canva-id';
    const url = getOAuthProvider('canva').authorizationUrl(params);
    expect(url).toContain('canva.com');
    delete process.env.CANVA_CLIENT_ID;
  });

  it('canva URL contains code_challenge_method=S256 (PKCE)', () => {
    process.env.CANVA_CLIENT_ID = 'fake-canva-id';
    const url = getOAuthProvider('canva').authorizationUrl(params);
    expect(url).toContain('code_challenge_method=S256');
    delete process.env.CANVA_CLIENT_ID;
  });

  it('canva URL includes the codeChallenge value', () => {
    process.env.CANVA_CLIENT_ID = 'fake-canva-id';
    const url = getOAuthProvider('canva').authorizationUrl(params);
    expect(url).toContain('challenge-xyz');
    delete process.env.CANVA_CLIENT_ID;
  });

  it('youtube throws when env var missing', () => {
    delete process.env.YOUTUBE_OAUTH_CLIENT_ID;
    expect(() => getOAuthProvider('youtube').authorizationUrl(params)).toThrow('YOUTUBE_OAUTH_CLIENT_ID');
  });

  it('tiktok throws when env var missing', () => {
    delete process.env.TIKTOK_OAUTH_CLIENT_KEY;
    expect(() => getOAuthProvider('tiktok').authorizationUrl(params)).toThrow('TIKTOK_OAUTH_CLIENT_KEY');
  });

  it('facebook throws when env var missing', () => {
    delete process.env.FACEBOOK_APP_ID;
    expect(() => getOAuthProvider('facebook').authorizationUrl(params)).toThrow('FACEBOOK_APP_ID');
  });

  it('canva throws when env var missing', () => {
    delete process.env.CANVA_CLIENT_ID;
    expect(() => getOAuthProvider('canva').authorizationUrl(params)).toThrow('CANVA_CLIENT_ID');
  });

  it('youtube URL encodes the redirect_uri', () => {
    process.env.YOUTUBE_OAUTH_CLIENT_ID = 'fake-yt-client';
    const url = getOAuthProvider('youtube').authorizationUrl(params);
    expect(url).toContain('redirect_uri=');
    delete process.env.YOUTUBE_OAUTH_CLIENT_ID;
  });

  it('youtube URL is parseable as a URL object', () => {
    process.env.YOUTUBE_OAUTH_CLIENT_ID = 'fake-yt-client';
    const url = getOAuthProvider('youtube').authorizationUrl(params);
    expect(() => new URL(url)).not.toThrow();
    delete process.env.YOUTUBE_OAUTH_CLIENT_ID;
  });

  it('tiktok URL is parseable as a URL object', () => {
    process.env.TIKTOK_OAUTH_CLIENT_KEY = 'fake-tt-key';
    const url = getOAuthProvider('tiktok').authorizationUrl(params);
    expect(() => new URL(url)).not.toThrow();
    delete process.env.TIKTOK_OAUTH_CLIENT_KEY;
  });

  it('facebook URL is parseable as a URL object', () => {
    process.env.FACEBOOK_APP_ID = 'fake-fb-id';
    const url = getOAuthProvider('facebook').authorizationUrl(params);
    expect(() => new URL(url)).not.toThrow();
    delete process.env.FACEBOOK_APP_ID;
  });

  it('canva URL is parseable as a URL object', () => {
    process.env.CANVA_CLIENT_ID = 'fake-canva-id';
    const url = getOAuthProvider('canva').authorizationUrl(params);
    expect(() => new URL(url)).not.toThrow();
    delete process.env.CANVA_CLIENT_ID;
  });
});
