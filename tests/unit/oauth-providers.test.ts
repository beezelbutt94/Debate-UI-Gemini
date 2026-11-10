import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ─── YouTube provider ─────────────────────────────────────────────────────────

describe('youtubeProvider.authorizationUrl', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env.YOUTUBE_OAUTH_CLIENT_ID = 'yt-client-id';
    process.env.YOUTUBE_OAUTH_CLIENT_SECRET = 'yt-secret';
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    vi.resetModules();
  });

  it('builds a valid google oauth URL', async () => {
    const { youtubeProvider } = await import('@/lib/oauth/youtube');
    const url = youtubeProvider.authorizationUrl({
      state: 'test-state',
      redirectUri: 'https://example.com/callback',
    });
    expect(url).toContain('accounts.google.com');
    expect(url).toContain('response_type=code');
  });

  it('includes the client_id', async () => {
    const { youtubeProvider } = await import('@/lib/oauth/youtube');
    const url = youtubeProvider.authorizationUrl({
      state: 'test-state',
      redirectUri: 'https://example.com/callback',
    });
    expect(url).toContain('client_id=yt-client-id');
  });

  it('includes access_type=offline', async () => {
    const { youtubeProvider } = await import('@/lib/oauth/youtube');
    const url = youtubeProvider.authorizationUrl({
      state: 'test-state',
      redirectUri: 'https://example.com/callback',
    });
    expect(url).toContain('access_type=offline');
  });

  it('includes prompt=consent', async () => {
    const { youtubeProvider } = await import('@/lib/oauth/youtube');
    const url = youtubeProvider.authorizationUrl({
      state: 'test-state',
      redirectUri: 'https://example.com/callback',
    });
    expect(url).toContain('prompt=consent');
  });

  it('includes the state parameter', async () => {
    const { youtubeProvider } = await import('@/lib/oauth/youtube');
    const url = youtubeProvider.authorizationUrl({
      state: 'my-csrf-state',
      redirectUri: 'https://example.com/callback',
    });
    expect(url).toContain('state=my-csrf-state');
  });

  it('requires PKCE = false', async () => {
    const { youtubeProvider } = await import('@/lib/oauth/youtube');
    expect(youtubeProvider.requiresPkce).toBe(false);
  });

  it('throws when YOUTUBE_OAUTH_CLIENT_ID is missing', async () => {
    delete process.env.YOUTUBE_OAUTH_CLIENT_ID;
    vi.resetModules();
    const { youtubeProvider } = await import('@/lib/oauth/youtube');
    expect(() =>
      youtubeProvider.authorizationUrl({ state: 's', redirectUri: 'https://r.com' })
    ).toThrow('YOUTUBE_OAUTH_CLIENT_ID');
  });
});

// ─── TikTok provider ──────────────────────────────────────────────────────────

describe('tiktokProvider.authorizationUrl', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env.TIKTOK_OAUTH_CLIENT_KEY = 'tt-key';
    process.env.TIKTOK_OAUTH_CLIENT_SECRET = 'tt-secret';
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    vi.resetModules();
  });

  it('builds a valid tiktok authorize URL', async () => {
    const { tiktokProvider } = await import('@/lib/oauth/tiktok');
    const url = tiktokProvider.authorizationUrl({
      state: 'csrf',
      redirectUri: 'https://example.com/callback',
    });
    expect(url).toContain('tiktok.com');
    expect(url).toContain('response_type=code');
  });

  it('includes the client_key', async () => {
    const { tiktokProvider } = await import('@/lib/oauth/tiktok');
    const url = tiktokProvider.authorizationUrl({
      state: 'csrf',
      redirectUri: 'https://example.com/callback',
    });
    expect(url).toContain('client_key=tt-key');
  });

  it('includes scope=video.publish', async () => {
    const { tiktokProvider } = await import('@/lib/oauth/tiktok');
    const url = tiktokProvider.authorizationUrl({
      state: 'csrf',
      redirectUri: 'https://example.com/callback',
    });
    expect(url).toContain('scope=video.publish');
  });

  it('includes the state parameter', async () => {
    const { tiktokProvider } = await import('@/lib/oauth/tiktok');
    const url = tiktokProvider.authorizationUrl({
      state: 'unique-nonce',
      redirectUri: 'https://example.com/callback',
    });
    expect(url).toContain('state=unique-nonce');
  });

  it('requires PKCE = false', async () => {
    const { tiktokProvider } = await import('@/lib/oauth/tiktok');
    expect(tiktokProvider.requiresPkce).toBe(false);
  });

  it('throws when TIKTOK_OAUTH_CLIENT_KEY is missing', async () => {
    delete process.env.TIKTOK_OAUTH_CLIENT_KEY;
    vi.resetModules();
    const { tiktokProvider } = await import('@/lib/oauth/tiktok');
    expect(() =>
      tiktokProvider.authorizationUrl({ state: 's', redirectUri: 'https://r.com' })
    ).toThrow('TIKTOK_OAUTH_CLIENT_KEY');
  });
});

// ─── Facebook provider ────────────────────────────────────────────────────────

describe('facebookProvider.authorizationUrl', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env.FACEBOOK_APP_ID = 'fb-app-id';
    process.env.FACEBOOK_APP_SECRET = 'fb-secret';
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    vi.resetModules();
  });

  it('builds a valid facebook dialog/oauth URL', async () => {
    const { facebookProvider } = await import('@/lib/oauth/facebook');
    const url = facebookProvider.authorizationUrl({
      state: 'csrf',
      redirectUri: 'https://example.com/callback',
    });
    expect(url).toContain('facebook.com');
    expect(url).toContain('response_type=code');
  });

  it('includes the client_id (facebook app id)', async () => {
    const { facebookProvider } = await import('@/lib/oauth/facebook');
    const url = facebookProvider.authorizationUrl({
      state: 'csrf',
      redirectUri: 'https://example.com/callback',
    });
    expect(url).toContain('client_id=fb-app-id');
  });

  it('includes page scopes', async () => {
    const { facebookProvider } = await import('@/lib/oauth/facebook');
    const url = facebookProvider.authorizationUrl({
      state: 'csrf',
      redirectUri: 'https://example.com/callback',
    });
    expect(url).toContain('pages_show_list');
  });

  it('requires PKCE = false', async () => {
    const { facebookProvider } = await import('@/lib/oauth/facebook');
    expect(facebookProvider.requiresPkce).toBe(false);
  });

  it('throws when FACEBOOK_APP_ID is missing', async () => {
    delete process.env.FACEBOOK_APP_ID;
    vi.resetModules();
    const { facebookProvider } = await import('@/lib/oauth/facebook');
    expect(() =>
      facebookProvider.authorizationUrl({ state: 's', redirectUri: 'https://r.com' })
    ).toThrow('FACEBOOK_APP_ID');
  });
});

// ─── Canva provider ───────────────────────────────────────────────────────────

describe('canvaProvider.authorizationUrl', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env.CANVA_CLIENT_ID = 'canva-id';
    process.env.CANVA_CLIENT_SECRET = 'canva-secret';
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    vi.resetModules();
  });

  it('builds a valid canva authorize URL', async () => {
    const { canvaProvider } = await import('@/lib/oauth/canva');
    const url = canvaProvider.authorizationUrl({
      state: 'csrf',
      redirectUri: 'https://example.com/callback',
      codeChallenge: 'challenge123',
    });
    expect(url).toContain('canva.com');
    expect(url).toContain('response_type=code');
  });

  it('includes code_challenge_method=S256', async () => {
    const { canvaProvider } = await import('@/lib/oauth/canva');
    const url = canvaProvider.authorizationUrl({
      state: 'csrf',
      redirectUri: 'https://example.com/callback',
      codeChallenge: 'challenge123',
    });
    expect(url).toContain('code_challenge_method=S256');
  });

  it('includes the code_challenge parameter', async () => {
    const { canvaProvider } = await import('@/lib/oauth/canva');
    const url = canvaProvider.authorizationUrl({
      state: 'csrf',
      redirectUri: 'https://example.com/callback',
      codeChallenge: 'my-challenge',
    });
    expect(url).toContain('code_challenge=my-challenge');
  });

  it('requires PKCE = true', async () => {
    const { canvaProvider } = await import('@/lib/oauth/canva');
    expect(canvaProvider.requiresPkce).toBe(true);
  });

  it('includes design scope', async () => {
    const { canvaProvider } = await import('@/lib/oauth/canva');
    const url = canvaProvider.authorizationUrl({
      state: 'csrf',
      redirectUri: 'https://example.com/callback',
    });
    expect(url).toContain('design%3Acontent%3Awrite');
  });

  it('throws when CANVA_CLIENT_ID is missing', async () => {
    delete process.env.CANVA_CLIENT_ID;
    vi.resetModules();
    const { canvaProvider } = await import('@/lib/oauth/canva');
    expect(() =>
      canvaProvider.authorizationUrl({ state: 's', redirectUri: 'https://r.com' })
    ).toThrow('CANVA_CLIENT_ID');
  });
});

// ─── getOAuthProvider index ───────────────────────────────────────────────────

describe('getOAuthProvider', () => {
  it('returns a provider for each platform', async () => {
    const { getOAuthProvider } = await import('@/lib/oauth');
    for (const platform of ['youtube', 'tiktok', 'facebook', 'canva'] as const) {
      const provider = getOAuthProvider(platform);
      expect(provider).toBeDefined();
      expect(typeof provider.authorizationUrl).toBe('function');
      expect(typeof provider.exchangeCode).toBe('function');
      expect(typeof provider.refreshAccessToken).toBe('function');
    }
  });
});
