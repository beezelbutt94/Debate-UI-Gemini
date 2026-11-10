import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// ─── YouTube provider ─────────────────────────────────────────────────────────

describe('youtubeProvider.authorizationUrl()', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv, YOUTUBE_OAUTH_CLIENT_ID: 'yt-client-id' };
  });

  afterEach(() => {
    process.env = originalEnv;
    vi.resetModules();
  });

  it('builds a valid google accounts URL', async () => {
    const { youtubeProvider } = await import('@/lib/oauth/youtube');
    const url = youtubeProvider.authorizationUrl({
      state: 'csrf-state',
      redirectUri: 'https://app.test/callback',
    });
    expect(url).toContain('https://accounts.google.com/o/oauth2/v2/auth');
  });

  it('sets client_id from env', async () => {
    const { youtubeProvider } = await import('@/lib/oauth/youtube');
    const url = youtubeProvider.authorizationUrl({ state: 's', redirectUri: 'https://r.test' });
    expect(new URL(url).searchParams.get('client_id')).toBe('yt-client-id');
  });

  it('sets response_type=code', async () => {
    const { youtubeProvider } = await import('@/lib/oauth/youtube');
    const url = youtubeProvider.authorizationUrl({ state: 's', redirectUri: 'https://r.test' });
    expect(new URL(url).searchParams.get('response_type')).toBe('code');
  });

  it('sets access_type=offline for refresh token', async () => {
    const { youtubeProvider } = await import('@/lib/oauth/youtube');
    const url = youtubeProvider.authorizationUrl({ state: 's', redirectUri: 'https://r.test' });
    expect(new URL(url).searchParams.get('access_type')).toBe('offline');
  });

  it('sets prompt=consent', async () => {
    const { youtubeProvider } = await import('@/lib/oauth/youtube');
    const url = youtubeProvider.authorizationUrl({ state: 's', redirectUri: 'https://r.test' });
    expect(new URL(url).searchParams.get('prompt')).toBe('consent');
  });

  it('passes state through', async () => {
    const { youtubeProvider } = await import('@/lib/oauth/youtube');
    const url = youtubeProvider.authorizationUrl({ state: 'my-state', redirectUri: 'https://r.test' });
    expect(new URL(url).searchParams.get('state')).toBe('my-state');
  });

  it('passes redirect_uri through', async () => {
    const { youtubeProvider } = await import('@/lib/oauth/youtube');
    const url = youtubeProvider.authorizationUrl({
      state: 's',
      redirectUri: 'https://my.app/oauth/youtube/callback',
    });
    expect(new URL(url).searchParams.get('redirect_uri')).toBe('https://my.app/oauth/youtube/callback');
  });

  it('requires PKCE = false', async () => {
    const { youtubeProvider } = await import('@/lib/oauth/youtube');
    expect(youtubeProvider.requiresPkce).toBe(false);
  });

  it('throws when YOUTUBE_OAUTH_CLIENT_ID is missing', async () => {
    process.env = { ...originalEnv };
    delete process.env.YOUTUBE_OAUTH_CLIENT_ID;
    const { youtubeProvider } = await import('@/lib/oauth/youtube');
    expect(() => youtubeProvider.authorizationUrl({ state: 's', redirectUri: 'https://r' })).toThrow(
      'YOUTUBE_OAUTH_CLIENT_ID'
    );
  });
});

// ─── TikTok provider ──────────────────────────────────────────────────────────

describe('tiktokProvider.authorizationUrl()', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv, TIKTOK_OAUTH_CLIENT_KEY: 'tt-client-key' };
  });

  afterEach(() => {
    process.env = originalEnv;
    vi.resetModules();
  });

  it('builds a valid TikTok authorize URL', async () => {
    const { tiktokProvider } = await import('@/lib/oauth/tiktok');
    const url = tiktokProvider.authorizationUrl({ state: 's', redirectUri: 'https://r.test' });
    expect(url).toContain('https://www.tiktok.com/v2/auth/authorize/');
  });

  it('sets client_key from env', async () => {
    const { tiktokProvider } = await import('@/lib/oauth/tiktok');
    const url = tiktokProvider.authorizationUrl({ state: 's', redirectUri: 'https://r.test' });
    expect(new URL(url).searchParams.get('client_key')).toBe('tt-client-key');
  });

  it('sets scope to video.publish', async () => {
    const { tiktokProvider } = await import('@/lib/oauth/tiktok');
    const url = tiktokProvider.authorizationUrl({ state: 's', redirectUri: 'https://r.test' });
    expect(new URL(url).searchParams.get('scope')).toBe('video.publish');
  });

  it('sets response_type=code', async () => {
    const { tiktokProvider } = await import('@/lib/oauth/tiktok');
    const url = tiktokProvider.authorizationUrl({ state: 's', redirectUri: 'https://r.test' });
    expect(new URL(url).searchParams.get('response_type')).toBe('code');
  });

  it('passes state through', async () => {
    const { tiktokProvider } = await import('@/lib/oauth/tiktok');
    const url = tiktokProvider.authorizationUrl({ state: 'my-csrf', redirectUri: 'https://r.test' });
    expect(new URL(url).searchParams.get('state')).toBe('my-csrf');
  });

  it('requires PKCE = false', async () => {
    const { tiktokProvider } = await import('@/lib/oauth/tiktok');
    expect(tiktokProvider.requiresPkce).toBe(false);
  });

  it('throws when TIKTOK_OAUTH_CLIENT_KEY is missing', async () => {
    process.env = { ...originalEnv };
    delete process.env.TIKTOK_OAUTH_CLIENT_KEY;
    const { tiktokProvider } = await import('@/lib/oauth/tiktok');
    expect(() => tiktokProvider.authorizationUrl({ state: 's', redirectUri: 'https://r' })).toThrow(
      'TIKTOK_OAUTH_CLIENT_KEY'
    );
  });
});

// ─── Facebook provider ────────────────────────────────────────────────────────

describe('facebookProvider.authorizationUrl()', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv, FACEBOOK_APP_ID: 'fb-app-id' };
  });

  afterEach(() => {
    process.env = originalEnv;
    vi.resetModules();
  });

  it('builds a valid Facebook dialog/oauth URL', async () => {
    const { facebookProvider } = await import('@/lib/oauth/facebook');
    const url = facebookProvider.authorizationUrl({ state: 's', redirectUri: 'https://r.test' });
    expect(url).toContain('facebook.com');
    expect(url).toContain('dialog/oauth');
  });

  it('sets client_id from env', async () => {
    const { facebookProvider } = await import('@/lib/oauth/facebook');
    const url = facebookProvider.authorizationUrl({ state: 's', redirectUri: 'https://r.test' });
    expect(new URL(url).searchParams.get('client_id')).toBe('fb-app-id');
  });

  it('sets correct page scopes', async () => {
    const { facebookProvider } = await import('@/lib/oauth/facebook');
    const url = facebookProvider.authorizationUrl({ state: 's', redirectUri: 'https://r.test' });
    const scope = new URL(url).searchParams.get('scope') ?? '';
    expect(scope).toContain('pages_show_list');
    expect(scope).toContain('pages_manage_posts');
  });

  it('sets response_type=code', async () => {
    const { facebookProvider } = await import('@/lib/oauth/facebook');
    const url = facebookProvider.authorizationUrl({ state: 's', redirectUri: 'https://r.test' });
    expect(new URL(url).searchParams.get('response_type')).toBe('code');
  });

  it('passes state through', async () => {
    const { facebookProvider } = await import('@/lib/oauth/facebook');
    const url = facebookProvider.authorizationUrl({ state: 'fb-csrf', redirectUri: 'https://r.test' });
    expect(new URL(url).searchParams.get('state')).toBe('fb-csrf');
  });

  it('requires PKCE = false', async () => {
    const { facebookProvider } = await import('@/lib/oauth/facebook');
    expect(facebookProvider.requiresPkce).toBe(false);
  });

  it('throws when FACEBOOK_APP_ID is missing', async () => {
    process.env = { ...originalEnv };
    delete process.env.FACEBOOK_APP_ID;
    const { facebookProvider } = await import('@/lib/oauth/facebook');
    expect(() => facebookProvider.authorizationUrl({ state: 's', redirectUri: 'https://r' })).toThrow(
      'FACEBOOK_APP_ID'
    );
  });
});

// ─── Canva provider ───────────────────────────────────────────────────────────

describe('canvaProvider.authorizationUrl()', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv, CANVA_CLIENT_ID: 'canva-client-id', CANVA_CLIENT_SECRET: 'canva-secret' };
  });

  afterEach(() => {
    process.env = originalEnv;
    vi.resetModules();
  });

  it('builds a valid Canva authorize URL', async () => {
    const { canvaProvider } = await import('@/lib/oauth/canva');
    const url = canvaProvider.authorizationUrl({
      state: 's',
      redirectUri: 'https://r.test',
      codeChallenge: 'challenge',
    });
    expect(url).toContain('https://www.canva.com/api/oauth/authorize');
  });

  it('sets client_id from env', async () => {
    const { canvaProvider } = await import('@/lib/oauth/canva');
    const url = canvaProvider.authorizationUrl({
      state: 's',
      redirectUri: 'https://r.test',
      codeChallenge: 'ch',
    });
    expect(new URL(url).searchParams.get('client_id')).toBe('canva-client-id');
  });

  it('sets code_challenge_method=S256', async () => {
    const { canvaProvider } = await import('@/lib/oauth/canva');
    const url = canvaProvider.authorizationUrl({
      state: 's',
      redirectUri: 'https://r.test',
      codeChallenge: 'ch',
    });
    expect(new URL(url).searchParams.get('code_challenge_method')).toBe('S256');
  });

  it('passes code_challenge through', async () => {
    const { canvaProvider } = await import('@/lib/oauth/canva');
    const url = canvaProvider.authorizationUrl({
      state: 's',
      redirectUri: 'https://r.test',
      codeChallenge: 'my-challenge-hash',
    });
    expect(new URL(url).searchParams.get('code_challenge')).toBe('my-challenge-hash');
  });

  it('sets correct scopes', async () => {
    const { canvaProvider } = await import('@/lib/oauth/canva');
    const url = canvaProvider.authorizationUrl({
      state: 's',
      redirectUri: 'https://r.test',
      codeChallenge: 'ch',
    });
    const scope = new URL(url).searchParams.get('scope') ?? '';
    expect(scope).toContain('design:content:write');
    expect(scope).toContain('profile:read');
  });

  it('passes state through', async () => {
    const { canvaProvider } = await import('@/lib/oauth/canva');
    const url = canvaProvider.authorizationUrl({
      state: 'canva-state',
      redirectUri: 'https://r.test',
      codeChallenge: 'ch',
    });
    expect(new URL(url).searchParams.get('state')).toBe('canva-state');
  });

  it('requires PKCE = true', async () => {
    const { canvaProvider } = await import('@/lib/oauth/canva');
    expect(canvaProvider.requiresPkce).toBe(true);
  });

  it('uses empty string for code_challenge when not provided', async () => {
    const { canvaProvider } = await import('@/lib/oauth/canva');
    const url = canvaProvider.authorizationUrl({ state: 's', redirectUri: 'https://r.test' });
    expect(new URL(url).searchParams.get('code_challenge')).toBe('');
  });

  it('throws when CANVA_CLIENT_ID is missing', async () => {
    process.env = { ...originalEnv, CANVA_CLIENT_SECRET: 'secret' };
    delete process.env.CANVA_CLIENT_ID;
    const { canvaProvider } = await import('@/lib/oauth/canva');
    expect(() =>
      canvaProvider.authorizationUrl({ state: 's', redirectUri: 'https://r', codeChallenge: 'ch' })
    ).toThrow('CANVA_CLIENT_ID');
  });
});

// ─── getOAuthProvider() ───────────────────────────────────────────────────────

describe('getOAuthProvider()', () => {
  it('returns a provider object for each supported platform', async () => {
    const { getOAuthProvider } = await import('@/lib/oauth');
    for (const platform of ['youtube', 'tiktok', 'facebook', 'canva'] as const) {
      const p = getOAuthProvider(platform);
      expect(typeof p.authorizationUrl).toBe('function');
      expect(typeof p.exchangeCode).toBe('function');
      expect(typeof p.refreshAccessToken).toBe('function');
      expect(typeof p.requiresPkce).toBe('boolean');
    }
  });

  it('only canva requiresPkce=true', async () => {
    const { getOAuthProvider } = await import('@/lib/oauth');
    expect(getOAuthProvider('canva').requiresPkce).toBe(true);
    expect(getOAuthProvider('youtube').requiresPkce).toBe(false);
    expect(getOAuthProvider('tiktok').requiresPkce).toBe(false);
    expect(getOAuthProvider('facebook').requiresPkce).toBe(false);
  });
});
