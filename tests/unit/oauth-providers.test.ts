import { describe, it, expect, beforeEach, afterEach } from 'vitest';

// ─── helpers ─────────────────────────────────────────────────────────────────

function setEnv(vars: Record<string, string>) {
  for (const [k, v] of Object.entries(vars)) process.env[k] = v;
}

function unsetEnv(vars: string[]) {
  for (const k of vars) delete process.env[k];
}

// ─── YouTube authorizationUrl ─────────────────────────────────────────────

describe('youtubeProvider.authorizationUrl()', () => {
  const VARS = ['YOUTUBE_OAUTH_CLIENT_ID'];

  beforeEach(() => setEnv({ YOUTUBE_OAUTH_CLIENT_ID: 'yt-client-id' }));
  afterEach(() => unsetEnv(VARS));

  it('returns a valid URL', async () => {
    const { youtubeProvider } = await import('@/lib/oauth/youtube');
    const url = youtubeProvider.authorizationUrl({
      state: 'abc123',
      redirectUri: 'https://app.example.com/callback/youtube',
    });
    expect(() => new URL(url)).not.toThrow();
  });

  it('targets the Google OAuth2 endpoint', async () => {
    const { youtubeProvider } = await import('@/lib/oauth/youtube');
    const url = youtubeProvider.authorizationUrl({ state: 'st', redirectUri: 'https://x.com' });
    expect(url).toContain('accounts.google.com');
  });

  it('sets response_type=code', async () => {
    const { youtubeProvider } = await import('@/lib/oauth/youtube');
    const url = youtubeProvider.authorizationUrl({ state: 'st', redirectUri: 'https://x.com' });
    expect(new URL(url).searchParams.get('response_type')).toBe('code');
  });

  it('sets access_type=offline', async () => {
    const { youtubeProvider } = await import('@/lib/oauth/youtube');
    const url = youtubeProvider.authorizationUrl({ state: 'st', redirectUri: 'https://x.com' });
    expect(new URL(url).searchParams.get('access_type')).toBe('offline');
  });

  it('sets prompt=consent', async () => {
    const { youtubeProvider } = await import('@/lib/oauth/youtube');
    const url = youtubeProvider.authorizationUrl({ state: 'st', redirectUri: 'https://x.com' });
    expect(new URL(url).searchParams.get('prompt')).toBe('consent');
  });

  it('includes the state parameter', async () => {
    const { youtubeProvider } = await import('@/lib/oauth/youtube');
    const url = youtubeProvider.authorizationUrl({ state: 'my-csrf-state', redirectUri: 'https://x.com' });
    expect(new URL(url).searchParams.get('state')).toBe('my-csrf-state');
  });

  it('includes the redirect_uri', async () => {
    const { youtubeProvider } = await import('@/lib/oauth/youtube');
    const redirectUri = 'https://app.example.com/callback/youtube';
    const url = youtubeProvider.authorizationUrl({ state: 'st', redirectUri });
    expect(new URL(url).searchParams.get('redirect_uri')).toBe(redirectUri);
  });

  it('includes the client_id from env', async () => {
    const { youtubeProvider } = await import('@/lib/oauth/youtube');
    const url = youtubeProvider.authorizationUrl({ state: 'st', redirectUri: 'https://x.com' });
    expect(new URL(url).searchParams.get('client_id')).toBe('yt-client-id');
  });

  it('throws when YOUTUBE_OAUTH_CLIENT_ID is not set', async () => {
    delete process.env.YOUTUBE_OAUTH_CLIENT_ID;
    const { youtubeProvider } = await import('@/lib/oauth/youtube');
    expect(() => youtubeProvider.authorizationUrl({ state: 'st', redirectUri: 'https://x.com' })).toThrow(/YOUTUBE_OAUTH_CLIENT_ID/);
  });

  it('includes the youtube.upload scope', async () => {
    setEnv({ YOUTUBE_OAUTH_CLIENT_ID: 'yt-client-id' });
    const { youtubeProvider } = await import('@/lib/oauth/youtube');
    const url = youtubeProvider.authorizationUrl({ state: 'st', redirectUri: 'https://x.com' });
    expect(new URL(url).searchParams.get('scope')).toContain('youtube.upload');
  });
});

// ─── TikTok authorizationUrl ──────────────────────────────────────────────

describe('tiktokProvider.authorizationUrl()', () => {
  const VARS = ['TIKTOK_OAUTH_CLIENT_KEY'];

  beforeEach(() => setEnv({ TIKTOK_OAUTH_CLIENT_KEY: 'tt-client-key' }));
  afterEach(() => unsetEnv(VARS));

  it('returns a valid URL', async () => {
    const { tiktokProvider } = await import('@/lib/oauth/tiktok');
    const url = tiktokProvider.authorizationUrl({ state: 'st', redirectUri: 'https://x.com' });
    expect(() => new URL(url)).not.toThrow();
  });

  it('targets the TikTok authorize endpoint', async () => {
    const { tiktokProvider } = await import('@/lib/oauth/tiktok');
    const url = tiktokProvider.authorizationUrl({ state: 'st', redirectUri: 'https://x.com' });
    expect(url).toContain('tiktok.com');
  });

  it('sets response_type=code', async () => {
    const { tiktokProvider } = await import('@/lib/oauth/tiktok');
    const url = tiktokProvider.authorizationUrl({ state: 'st', redirectUri: 'https://x.com' });
    expect(new URL(url).searchParams.get('response_type')).toBe('code');
  });

  it('includes video.publish scope', async () => {
    const { tiktokProvider } = await import('@/lib/oauth/tiktok');
    const url = tiktokProvider.authorizationUrl({ state: 'st', redirectUri: 'https://x.com' });
    expect(new URL(url).searchParams.get('scope')).toContain('video.publish');
  });

  it('includes the state parameter', async () => {
    const { tiktokProvider } = await import('@/lib/oauth/tiktok');
    const url = tiktokProvider.authorizationUrl({ state: 'csrf-token', redirectUri: 'https://x.com' });
    expect(new URL(url).searchParams.get('state')).toBe('csrf-token');
  });

  it('includes the client_key from env', async () => {
    const { tiktokProvider } = await import('@/lib/oauth/tiktok');
    const url = tiktokProvider.authorizationUrl({ state: 'st', redirectUri: 'https://x.com' });
    expect(new URL(url).searchParams.get('client_key')).toBe('tt-client-key');
  });

  it('throws when TIKTOK_OAUTH_CLIENT_KEY is not set', async () => {
    delete process.env.TIKTOK_OAUTH_CLIENT_KEY;
    const { tiktokProvider } = await import('@/lib/oauth/tiktok');
    expect(() => tiktokProvider.authorizationUrl({ state: 'st', redirectUri: 'https://x.com' })).toThrow(/TIKTOK_OAUTH_CLIENT_KEY/);
  });

  it('includes the redirect_uri', async () => {
    setEnv({ TIKTOK_OAUTH_CLIENT_KEY: 'tt-client-key' });
    const { tiktokProvider } = await import('@/lib/oauth/tiktok');
    const redirectUri = 'https://app.example.com/callback/tiktok';
    const url = tiktokProvider.authorizationUrl({ state: 'st', redirectUri });
    expect(new URL(url).searchParams.get('redirect_uri')).toBe(redirectUri);
  });
});

// ─── Facebook authorizationUrl ────────────────────────────────────────────

describe('facebookProvider.authorizationUrl()', () => {
  const VARS = ['FACEBOOK_APP_ID'];

  beforeEach(() => setEnv({ FACEBOOK_APP_ID: 'fb-app-id' }));
  afterEach(() => unsetEnv(VARS));

  it('returns a valid URL', async () => {
    const { facebookProvider } = await import('@/lib/oauth/facebook');
    const url = facebookProvider.authorizationUrl({ state: 'st', redirectUri: 'https://x.com' });
    expect(() => new URL(url)).not.toThrow();
  });

  it('targets the Facebook dialog/oauth endpoint', async () => {
    const { facebookProvider } = await import('@/lib/oauth/facebook');
    const url = facebookProvider.authorizationUrl({ state: 'st', redirectUri: 'https://x.com' });
    expect(url).toContain('facebook.com');
    expect(url).toContain('dialog/oauth');
  });

  it('sets response_type=code', async () => {
    const { facebookProvider } = await import('@/lib/oauth/facebook');
    const url = facebookProvider.authorizationUrl({ state: 'st', redirectUri: 'https://x.com' });
    expect(new URL(url).searchParams.get('response_type')).toBe('code');
  });

  it('includes page-level scopes', async () => {
    const { facebookProvider } = await import('@/lib/oauth/facebook');
    const url = facebookProvider.authorizationUrl({ state: 'st', redirectUri: 'https://x.com' });
    const scope = new URL(url).searchParams.get('scope') ?? '';
    expect(scope).toContain('pages_show_list');
    expect(scope).toContain('pages_manage_posts');
  });

  it('includes the state parameter', async () => {
    const { facebookProvider } = await import('@/lib/oauth/facebook');
    const url = facebookProvider.authorizationUrl({ state: 'fb-state', redirectUri: 'https://x.com' });
    expect(new URL(url).searchParams.get('state')).toBe('fb-state');
  });

  it('includes client_id from env', async () => {
    const { facebookProvider } = await import('@/lib/oauth/facebook');
    const url = facebookProvider.authorizationUrl({ state: 'st', redirectUri: 'https://x.com' });
    expect(new URL(url).searchParams.get('client_id')).toBe('fb-app-id');
  });

  it('throws when FACEBOOK_APP_ID is not set', async () => {
    delete process.env.FACEBOOK_APP_ID;
    const { facebookProvider } = await import('@/lib/oauth/facebook');
    expect(() => facebookProvider.authorizationUrl({ state: 'st', redirectUri: 'https://x.com' })).toThrow(/FACEBOOK_APP_ID/);
  });
});

// ─── Canva authorizationUrl ───────────────────────────────────────────────

describe('canvaProvider.authorizationUrl()', () => {
  const VARS = ['CANVA_CLIENT_ID'];

  beforeEach(() => setEnv({ CANVA_CLIENT_ID: 'canva-client-id' }));
  afterEach(() => unsetEnv(VARS));

  it('returns a valid URL', async () => {
    const { canvaProvider } = await import('@/lib/oauth/canva');
    const url = canvaProvider.authorizationUrl({ state: 'st', redirectUri: 'https://x.com', codeChallenge: 'ch' });
    expect(() => new URL(url)).not.toThrow();
  });

  it('targets the Canva OAuth authorize endpoint', async () => {
    const { canvaProvider } = await import('@/lib/oauth/canva');
    const url = canvaProvider.authorizationUrl({ state: 'st', redirectUri: 'https://x.com', codeChallenge: 'ch' });
    expect(url).toContain('canva.com');
  });

  it('sets code_challenge_method=S256', async () => {
    const { canvaProvider } = await import('@/lib/oauth/canva');
    const url = canvaProvider.authorizationUrl({ state: 'st', redirectUri: 'https://x.com', codeChallenge: 'challenge-value' });
    expect(new URL(url).searchParams.get('code_challenge_method')).toBe('S256');
  });

  it('includes the code_challenge', async () => {
    const { canvaProvider } = await import('@/lib/oauth/canva');
    const url = canvaProvider.authorizationUrl({ state: 'st', redirectUri: 'https://x.com', codeChallenge: 'my-challenge' });
    expect(new URL(url).searchParams.get('code_challenge')).toBe('my-challenge');
  });

  it('sets response_type=code', async () => {
    const { canvaProvider } = await import('@/lib/oauth/canva');
    const url = canvaProvider.authorizationUrl({ state: 'st', redirectUri: 'https://x.com', codeChallenge: 'ch' });
    expect(new URL(url).searchParams.get('response_type')).toBe('code');
  });

  it('includes the state parameter', async () => {
    const { canvaProvider } = await import('@/lib/oauth/canva');
    const url = canvaProvider.authorizationUrl({ state: 'canva-state', redirectUri: 'https://x.com', codeChallenge: 'ch' });
    expect(new URL(url).searchParams.get('state')).toBe('canva-state');
  });

  it('includes the client_id from env', async () => {
    const { canvaProvider } = await import('@/lib/oauth/canva');
    const url = canvaProvider.authorizationUrl({ state: 'st', redirectUri: 'https://x.com', codeChallenge: 'ch' });
    expect(new URL(url).searchParams.get('client_id')).toBe('canva-client-id');
  });

  it('includes design scopes', async () => {
    const { canvaProvider } = await import('@/lib/oauth/canva');
    const url = canvaProvider.authorizationUrl({ state: 'st', redirectUri: 'https://x.com', codeChallenge: 'ch' });
    const scope = new URL(url).searchParams.get('scope') ?? '';
    expect(scope).toContain('design:content:write');
    expect(scope).toContain('profile:read');
  });

  it('throws when CANVA_CLIENT_ID is not set', async () => {
    delete process.env.CANVA_CLIENT_ID;
    const { canvaProvider } = await import('@/lib/oauth/canva');
    expect(() => canvaProvider.authorizationUrl({ state: 'st', redirectUri: 'https://x.com', codeChallenge: 'ch' })).toThrow(/CANVA_CLIENT_ID/);
  });
});
