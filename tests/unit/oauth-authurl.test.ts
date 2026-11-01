import { describe, it, expect, beforeEach, afterEach } from 'vitest';

// These tests exercise authorizationUrl() on each provider.
// They require env vars — we stub them before each suite.

const ENV_STUBS = {
  YOUTUBE_OAUTH_CLIENT_ID: 'yt-client-id',
  YOUTUBE_OAUTH_CLIENT_SECRET: 'yt-client-secret',
  TIKTOK_OAUTH_CLIENT_KEY: 'tt-client-key',
  TIKTOK_OAUTH_CLIENT_SECRET: 'tt-client-secret',
  FACEBOOK_APP_ID: 'fb-app-id',
  FACEBOOK_APP_SECRET: 'fb-app-secret',
  CANVA_CLIENT_ID: 'canva-client-id',
  CANVA_CLIENT_SECRET: 'canva-client-secret',
};

beforeEach(() => {
  for (const [k, v] of Object.entries(ENV_STUBS)) {
    process.env[k] = v;
  }
});

afterEach(() => {
  for (const k of Object.keys(ENV_STUBS)) {
    delete process.env[k];
  }
});

// ─── YouTube ─────────────────────────────────────────────────────────────────

describe('youtubeProvider.authorizationUrl', () => {
  it('returns a valid Google OAuth URL', async () => {
    const { youtubeProvider } = await import('@/lib/oauth/youtube');
    const url = youtubeProvider.authorizationUrl({ state: 'mystate', redirectUri: 'https://app.example.com/callback' });
    expect(url).toMatch(/^https:\/\/accounts\.google\.com\/o\/oauth2\/v2\/auth/);
  });

  it('includes client_id', async () => {
    const { youtubeProvider } = await import('@/lib/oauth/youtube');
    const url = youtubeProvider.authorizationUrl({ state: 'st', redirectUri: 'https://app.example.com/cb' });
    expect(new URL(url).searchParams.get('client_id')).toBe('yt-client-id');
  });

  it('includes state', async () => {
    const { youtubeProvider } = await import('@/lib/oauth/youtube');
    const url = youtubeProvider.authorizationUrl({ state: 'csrf-token', redirectUri: 'https://app.example.com/cb' });
    expect(new URL(url).searchParams.get('state')).toBe('csrf-token');
  });

  it('includes redirect_uri', async () => {
    const { youtubeProvider } = await import('@/lib/oauth/youtube');
    const url = youtubeProvider.authorizationUrl({ state: 'st', redirectUri: 'https://app.example.com/cb' });
    expect(new URL(url).searchParams.get('redirect_uri')).toBe('https://app.example.com/cb');
  });

  it('requests offline access_type for refresh token support', async () => {
    const { youtubeProvider } = await import('@/lib/oauth/youtube');
    const url = youtubeProvider.authorizationUrl({ state: 'st', redirectUri: 'https://app.example.com/cb' });
    expect(new URL(url).searchParams.get('access_type')).toBe('offline');
  });

  it('includes prompt=consent', async () => {
    const { youtubeProvider } = await import('@/lib/oauth/youtube');
    const url = youtubeProvider.authorizationUrl({ state: 'st', redirectUri: 'https://app.example.com/cb' });
    expect(new URL(url).searchParams.get('prompt')).toBe('consent');
  });

  it('includes response_type=code', async () => {
    const { youtubeProvider } = await import('@/lib/oauth/youtube');
    const url = youtubeProvider.authorizationUrl({ state: 'st', redirectUri: 'https://app.example.com/cb' });
    expect(new URL(url).searchParams.get('response_type')).toBe('code');
  });

  it('includes youtube.upload scope', async () => {
    const { youtubeProvider } = await import('@/lib/oauth/youtube');
    const url = youtubeProvider.authorizationUrl({ state: 'st', redirectUri: 'https://app.example.com/cb' });
    expect(new URL(url).searchParams.get('scope')).toContain('youtube.upload');
  });

  it('throws if YOUTUBE_OAUTH_CLIENT_ID is missing', async () => {
    delete process.env.YOUTUBE_OAUTH_CLIENT_ID;
    const { youtubeProvider } = await import('@/lib/oauth/youtube');
    expect(() => youtubeProvider.authorizationUrl({ state: 'st', redirectUri: 'https://example.com' })).toThrow(
      'YOUTUBE_OAUTH_CLIENT_ID'
    );
  });
});

// ─── TikTok ───────────────────────────────────────────────────────────────────

describe('tiktokProvider.authorizationUrl', () => {
  it('returns a TikTok authorize URL', async () => {
    const { tiktokProvider } = await import('@/lib/oauth/tiktok');
    const url = tiktokProvider.authorizationUrl({ state: 'st', redirectUri: 'https://app.example.com/cb' });
    expect(url).toMatch(/^https:\/\/www\.tiktok\.com\/v2\/auth\/authorize/);
  });

  it('includes client_key', async () => {
    const { tiktokProvider } = await import('@/lib/oauth/tiktok');
    const url = tiktokProvider.authorizationUrl({ state: 'st', redirectUri: 'https://app.example.com/cb' });
    expect(new URL(url).searchParams.get('client_key')).toBe('tt-client-key');
  });

  it('includes state', async () => {
    const { tiktokProvider } = await import('@/lib/oauth/tiktok');
    const url = tiktokProvider.authorizationUrl({ state: 'csrf-abc', redirectUri: 'https://app.example.com/cb' });
    expect(new URL(url).searchParams.get('state')).toBe('csrf-abc');
  });

  it('includes redirect_uri', async () => {
    const { tiktokProvider } = await import('@/lib/oauth/tiktok');
    const url = tiktokProvider.authorizationUrl({ state: 'st', redirectUri: 'https://app.example.com/cb' });
    expect(new URL(url).searchParams.get('redirect_uri')).toBe('https://app.example.com/cb');
  });

  it('includes video.publish scope', async () => {
    const { tiktokProvider } = await import('@/lib/oauth/tiktok');
    const url = tiktokProvider.authorizationUrl({ state: 'st', redirectUri: 'https://app.example.com/cb' });
    expect(new URL(url).searchParams.get('scope')).toContain('video.publish');
  });

  it('includes response_type=code', async () => {
    const { tiktokProvider } = await import('@/lib/oauth/tiktok');
    const url = tiktokProvider.authorizationUrl({ state: 'st', redirectUri: 'https://app.example.com/cb' });
    expect(new URL(url).searchParams.get('response_type')).toBe('code');
  });

  it('throws if TIKTOK_OAUTH_CLIENT_KEY is missing', async () => {
    delete process.env.TIKTOK_OAUTH_CLIENT_KEY;
    const { tiktokProvider } = await import('@/lib/oauth/tiktok');
    expect(() => tiktokProvider.authorizationUrl({ state: 'st', redirectUri: 'https://example.com' })).toThrow(
      'TIKTOK_OAUTH_CLIENT_KEY'
    );
  });
});

// ─── Facebook ─────────────────────────────────────────────────────────────────

describe('facebookProvider.authorizationUrl', () => {
  it('returns a Facebook OAuth dialog URL', async () => {
    const { facebookProvider } = await import('@/lib/oauth/facebook');
    const url = facebookProvider.authorizationUrl({ state: 'st', redirectUri: 'https://app.example.com/cb' });
    expect(url).toMatch(/^https:\/\/www\.facebook\.com\//);
    expect(url).toContain('/dialog/oauth');
  });

  it('includes client_id', async () => {
    const { facebookProvider } = await import('@/lib/oauth/facebook');
    const url = facebookProvider.authorizationUrl({ state: 'st', redirectUri: 'https://app.example.com/cb' });
    expect(new URL(url).searchParams.get('client_id')).toBe('fb-app-id');
  });

  it('includes state', async () => {
    const { facebookProvider } = await import('@/lib/oauth/facebook');
    const url = facebookProvider.authorizationUrl({ state: 'csrf-fb', redirectUri: 'https://app.example.com/cb' });
    expect(new URL(url).searchParams.get('state')).toBe('csrf-fb');
  });

  it('includes redirect_uri', async () => {
    const { facebookProvider } = await import('@/lib/oauth/facebook');
    const url = facebookProvider.authorizationUrl({ state: 'st', redirectUri: 'https://app.example.com/cb' });
    expect(new URL(url).searchParams.get('redirect_uri')).toBe('https://app.example.com/cb');
  });

  it('includes page scopes', async () => {
    const { facebookProvider } = await import('@/lib/oauth/facebook');
    const url = facebookProvider.authorizationUrl({ state: 'st', redirectUri: 'https://app.example.com/cb' });
    const scope = new URL(url).searchParams.get('scope') ?? '';
    expect(scope).toContain('pages_show_list');
    expect(scope).toContain('pages_manage_posts');
  });

  it('includes response_type=code', async () => {
    const { facebookProvider } = await import('@/lib/oauth/facebook');
    const url = facebookProvider.authorizationUrl({ state: 'st', redirectUri: 'https://app.example.com/cb' });
    expect(new URL(url).searchParams.get('response_type')).toBe('code');
  });

  it('throws if FACEBOOK_APP_ID is missing', async () => {
    delete process.env.FACEBOOK_APP_ID;
    const { facebookProvider } = await import('@/lib/oauth/facebook');
    expect(() => facebookProvider.authorizationUrl({ state: 'st', redirectUri: 'https://example.com' })).toThrow(
      'FACEBOOK_APP_ID'
    );
  });
});

// ─── Canva ────────────────────────────────────────────────────────────────────

describe('canvaProvider.authorizationUrl', () => {
  it('returns a Canva authorize URL', async () => {
    const { canvaProvider } = await import('@/lib/oauth/canva');
    const url = canvaProvider.authorizationUrl({
      state: 'st',
      redirectUri: 'https://app.example.com/cb',
      codeChallenge: 'challenge123',
    });
    expect(url).toMatch(/^https:\/\/www\.canva\.com\/api\/oauth\/authorize/);
  });

  it('includes client_id', async () => {
    const { canvaProvider } = await import('@/lib/oauth/canva');
    const url = canvaProvider.authorizationUrl({
      state: 'st',
      redirectUri: 'https://app.example.com/cb',
      codeChallenge: 'ch',
    });
    expect(new URL(url).searchParams.get('client_id')).toBe('canva-client-id');
  });

  it('includes state', async () => {
    const { canvaProvider } = await import('@/lib/oauth/canva');
    const url = canvaProvider.authorizationUrl({
      state: 'csrf-canva',
      redirectUri: 'https://app.example.com/cb',
      codeChallenge: 'ch',
    });
    expect(new URL(url).searchParams.get('state')).toBe('csrf-canva');
  });

  it('includes code_challenge', async () => {
    const { canvaProvider } = await import('@/lib/oauth/canva');
    const url = canvaProvider.authorizationUrl({
      state: 'st',
      redirectUri: 'https://app.example.com/cb',
      codeChallenge: 'my-challenge',
    });
    expect(new URL(url).searchParams.get('code_challenge')).toBe('my-challenge');
  });

  it('includes code_challenge_method=S256', async () => {
    const { canvaProvider } = await import('@/lib/oauth/canva');
    const url = canvaProvider.authorizationUrl({
      state: 'st',
      redirectUri: 'https://app.example.com/cb',
      codeChallenge: 'ch',
    });
    expect(new URL(url).searchParams.get('code_challenge_method')).toBe('S256');
  });

  it('includes design:content:write scope', async () => {
    const { canvaProvider } = await import('@/lib/oauth/canva');
    const url = canvaProvider.authorizationUrl({
      state: 'st',
      redirectUri: 'https://app.example.com/cb',
      codeChallenge: 'ch',
    });
    expect(new URL(url).searchParams.get('scope')).toContain('design:content:write');
  });

  it('includes response_type=code', async () => {
    const { canvaProvider } = await import('@/lib/oauth/canva');
    const url = canvaProvider.authorizationUrl({
      state: 'st',
      redirectUri: 'https://app.example.com/cb',
      codeChallenge: 'ch',
    });
    expect(new URL(url).searchParams.get('response_type')).toBe('code');
  });

  it('throws if CANVA_CLIENT_ID is missing', async () => {
    delete process.env.CANVA_CLIENT_ID;
    const { canvaProvider } = await import('@/lib/oauth/canva');
    expect(() =>
      canvaProvider.authorizationUrl({ state: 'st', redirectUri: 'https://example.com', codeChallenge: 'ch' })
    ).toThrow('CANVA_CLIENT_ID');
  });

  it('uses empty string when codeChallenge is omitted', async () => {
    const { canvaProvider } = await import('@/lib/oauth/canva');
    const url = canvaProvider.authorizationUrl({ state: 'st', redirectUri: 'https://app.example.com/cb' });
    expect(new URL(url).searchParams.get('code_challenge')).toBe('');
  });
});
