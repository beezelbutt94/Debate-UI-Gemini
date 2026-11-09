import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { getOAuthProvider } from '@/lib/oauth';

describe('getOAuthProvider', () => {
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

  it('youtube provider does NOT require PKCE', () => {
    expect(getOAuthProvider('youtube').requiresPkce).toBe(false);
  });

  it('tiktok provider does NOT require PKCE', () => {
    expect(getOAuthProvider('tiktok').requiresPkce).toBe(false);
  });

  it('facebook provider does NOT require PKCE', () => {
    expect(getOAuthProvider('facebook').requiresPkce).toBe(false);
  });

  it('canva provider REQUIRES PKCE', () => {
    expect(getOAuthProvider('canva').requiresPkce).toBe(true);
  });
});

describe('youtube provider authorizationUrl', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env.YOUTUBE_OAUTH_CLIENT_ID = 'test-yt-client-id';
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it('builds a valid Google OAuth URL', () => {
    const provider = getOAuthProvider('youtube');
    const url = provider.authorizationUrl({
      state: 'test-state',
      redirectUri: 'https://example.com/callback',
    });
    expect(url).toContain('accounts.google.com');
    expect(url).toContain('response_type=code');
  });

  it('includes state parameter', () => {
    const provider = getOAuthProvider('youtube');
    const url = provider.authorizationUrl({
      state: 'my-csrf-state',
      redirectUri: 'https://example.com/callback',
    });
    expect(url).toContain('state=my-csrf-state');
  });

  it('includes redirect_uri parameter', () => {
    const provider = getOAuthProvider('youtube');
    const url = provider.authorizationUrl({
      state: 'st',
      redirectUri: 'https://example.com/oauth/callback',
    });
    expect(url).toContain('redirect_uri=');
    expect(url).toContain('example.com');
  });

  it('requests offline access for refresh token', () => {
    const provider = getOAuthProvider('youtube');
    const url = provider.authorizationUrl({
      state: 'st',
      redirectUri: 'https://example.com/callback',
    });
    expect(url).toContain('access_type=offline');
  });

  it('forces consent prompt to always get refresh token', () => {
    const provider = getOAuthProvider('youtube');
    const url = provider.authorizationUrl({
      state: 'st',
      redirectUri: 'https://example.com/callback',
    });
    expect(url).toContain('prompt=consent');
  });

  it('includes YouTube upload scope', () => {
    const provider = getOAuthProvider('youtube');
    const url = provider.authorizationUrl({
      state: 'st',
      redirectUri: 'https://example.com/callback',
    });
    expect(url).toContain('youtube.upload');
  });

  it('includes client_id from env var', () => {
    const provider = getOAuthProvider('youtube');
    const url = provider.authorizationUrl({
      state: 'st',
      redirectUri: 'https://example.com/callback',
    });
    expect(url).toContain('test-yt-client-id');
  });

  it('throws when YOUTUBE_OAUTH_CLIENT_ID is missing', () => {
    delete process.env.YOUTUBE_OAUTH_CLIENT_ID;
    const provider = getOAuthProvider('youtube');
    expect(() =>
      provider.authorizationUrl({ state: 'st', redirectUri: 'https://example.com/cb' })
    ).toThrow('YOUTUBE_OAUTH_CLIENT_ID');
  });
});

describe('tiktok provider authorizationUrl', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env.TIKTOK_OAUTH_CLIENT_KEY = 'test-tt-client-key';
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it('builds a TikTok authorization URL', () => {
    const provider = getOAuthProvider('tiktok');
    const url = provider.authorizationUrl({
      state: 'test-state',
      redirectUri: 'https://example.com/callback',
    });
    expect(url).toContain('tiktok.com');
    expect(url).toContain('response_type=code');
  });

  it('includes state parameter', () => {
    const provider = getOAuthProvider('tiktok');
    const url = provider.authorizationUrl({
      state: 'csrf-123',
      redirectUri: 'https://example.com/callback',
    });
    expect(url).toContain('state=csrf-123');
  });

  it('includes video.publish scope', () => {
    const provider = getOAuthProvider('tiktok');
    const url = provider.authorizationUrl({
      state: 'st',
      redirectUri: 'https://example.com/callback',
    });
    expect(url).toContain('video.publish');
  });

  it('includes client_key from env var', () => {
    const provider = getOAuthProvider('tiktok');
    const url = provider.authorizationUrl({
      state: 'st',
      redirectUri: 'https://example.com/callback',
    });
    expect(url).toContain('test-tt-client-key');
  });

  it('throws when TIKTOK_OAUTH_CLIENT_KEY is missing', () => {
    delete process.env.TIKTOK_OAUTH_CLIENT_KEY;
    const provider = getOAuthProvider('tiktok');
    expect(() =>
      provider.authorizationUrl({ state: 'st', redirectUri: 'https://example.com/cb' })
    ).toThrow('TIKTOK_OAUTH_CLIENT_KEY');
  });
});

describe('facebook provider authorizationUrl', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env.FACEBOOK_APP_ID = 'test-fb-app-id';
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it('builds a Facebook OAuth URL', () => {
    const provider = getOAuthProvider('facebook');
    const url = provider.authorizationUrl({
      state: 'test-state',
      redirectUri: 'https://example.com/callback',
    });
    expect(url).toContain('facebook.com');
    expect(url).toContain('response_type=code');
  });

  it('includes state parameter', () => {
    const provider = getOAuthProvider('facebook');
    const url = provider.authorizationUrl({
      state: 'fb-csrf',
      redirectUri: 'https://example.com/callback',
    });
    expect(url).toContain('state=fb-csrf');
  });

  it('requests page-level scopes', () => {
    const provider = getOAuthProvider('facebook');
    const url = provider.authorizationUrl({
      state: 'st',
      redirectUri: 'https://example.com/callback',
    });
    expect(url).toContain('pages_show_list');
    expect(url).toContain('pages_manage_posts');
  });

  it('includes client_id from env var', () => {
    const provider = getOAuthProvider('facebook');
    const url = provider.authorizationUrl({
      state: 'st',
      redirectUri: 'https://example.com/callback',
    });
    expect(url).toContain('test-fb-app-id');
  });

  it('throws when FACEBOOK_APP_ID is missing', () => {
    delete process.env.FACEBOOK_APP_ID;
    const provider = getOAuthProvider('facebook');
    expect(() =>
      provider.authorizationUrl({ state: 'st', redirectUri: 'https://example.com/cb' })
    ).toThrow('FACEBOOK_APP_ID');
  });
});

describe('canva provider authorizationUrl', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env.CANVA_CLIENT_ID = 'test-canva-client-id';
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it('builds a Canva authorization URL', () => {
    const provider = getOAuthProvider('canva');
    const url = provider.authorizationUrl({
      state: 'test-state',
      redirectUri: 'https://example.com/callback',
      codeChallenge: 'challenge-abc',
    });
    expect(url).toContain('canva.com');
    expect(url).toContain('response_type=code');
  });

  it('includes PKCE code_challenge', () => {
    const provider = getOAuthProvider('canva');
    const url = provider.authorizationUrl({
      state: 'st',
      redirectUri: 'https://example.com/callback',
      codeChallenge: 'my-challenge',
    });
    expect(url).toContain('code_challenge=my-challenge');
  });

  it('uses S256 code_challenge_method', () => {
    const provider = getOAuthProvider('canva');
    const url = provider.authorizationUrl({
      state: 'st',
      redirectUri: 'https://example.com/callback',
      codeChallenge: 'challenge',
    });
    expect(url).toContain('code_challenge_method=S256');
  });

  it('includes state parameter', () => {
    const provider = getOAuthProvider('canva');
    const url = provider.authorizationUrl({
      state: 'canva-csrf',
      redirectUri: 'https://example.com/callback',
      codeChallenge: 'ch',
    });
    expect(url).toContain('state=canva-csrf');
  });

  it('includes client_id from env var', () => {
    const provider = getOAuthProvider('canva');
    const url = provider.authorizationUrl({
      state: 'st',
      redirectUri: 'https://example.com/callback',
      codeChallenge: 'ch',
    });
    expect(url).toContain('test-canva-client-id');
  });

  it('throws when CANVA_CLIENT_ID is missing', () => {
    delete process.env.CANVA_CLIENT_ID;
    const provider = getOAuthProvider('canva');
    expect(() =>
      provider.authorizationUrl({ state: 'st', redirectUri: 'https://example.com/cb', codeChallenge: 'ch' })
    ).toThrow('CANVA_CLIENT_ID');
  });

  it('includes design and profile scopes', () => {
    const provider = getOAuthProvider('canva');
    const url = provider.authorizationUrl({
      state: 'st',
      redirectUri: 'https://example.com/callback',
      codeChallenge: 'ch',
    });
    expect(url).toContain('design%3Acontent%3Awrite');
  });
});
