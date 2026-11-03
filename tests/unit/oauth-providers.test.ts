import { describe, it, expect, beforeEach, afterEach } from 'vitest';

const savedEnv: Record<string, string | undefined> = {};

function setEnv(vars: Record<string, string>) {
  for (const [k, v] of Object.entries(vars)) {
    savedEnv[k] = process.env[k];
    process.env[k] = v;
  }
}

function restoreEnv() {
  for (const [k, v] of Object.entries(savedEnv)) {
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  }
}

// ─── YouTube Provider ────────────────────────────────────────────────────────

describe('youtubeProvider.authorizationUrl()', () => {
  beforeEach(() =>
    setEnv({
      YOUTUBE_OAUTH_CLIENT_ID: 'yt-client-id',
      YOUTUBE_OAUTH_CLIENT_SECRET: 'yt-client-secret',
    })
  );
  afterEach(restoreEnv);

  it('targets the Google OAuth2 authorization endpoint', async () => {
    const { youtubeProvider } = await import('@/lib/oauth/youtube');
    const url = youtubeProvider.authorizationUrl({
      state: 'abc',
      redirectUri: 'https://app.example.com/api/oauth/youtube/callback',
    });
    expect(url).toContain('https://accounts.google.com/o/oauth2/v2/auth');
  });

  it('includes the configured client_id', async () => {
    const { youtubeProvider } = await import('@/lib/oauth/youtube');
    const url = youtubeProvider.authorizationUrl({ state: 'abc', redirectUri: 'https://example.com/cb' });
    expect(new URL(url).searchParams.get('client_id')).toBe('yt-client-id');
  });

  it('includes the state parameter', async () => {
    const { youtubeProvider } = await import('@/lib/oauth/youtube');
    const url = youtubeProvider.authorizationUrl({ state: 'my-nonce', redirectUri: 'https://example.com/cb' });
    expect(new URL(url).searchParams.get('state')).toBe('my-nonce');
  });

  it('includes offline access_type for refresh token', async () => {
    const { youtubeProvider } = await import('@/lib/oauth/youtube');
    const url = youtubeProvider.authorizationUrl({ state: 'x', redirectUri: 'https://example.com/cb' });
    expect(new URL(url).searchParams.get('access_type')).toBe('offline');
  });

  it('includes prompt=consent', async () => {
    const { youtubeProvider } = await import('@/lib/oauth/youtube');
    const url = youtubeProvider.authorizationUrl({ state: 'x', redirectUri: 'https://example.com/cb' });
    expect(new URL(url).searchParams.get('prompt')).toBe('consent');
  });

  it('includes the correct YouTube upload scope', async () => {
    const { youtubeProvider } = await import('@/lib/oauth/youtube');
    const url = youtubeProvider.authorizationUrl({ state: 'x', redirectUri: 'https://example.com/cb' });
    expect(new URL(url).searchParams.get('scope')).toContain('youtube.upload');
  });

  it('includes response_type=code', async () => {
    const { youtubeProvider } = await import('@/lib/oauth/youtube');
    const url = youtubeProvider.authorizationUrl({ state: 'x', redirectUri: 'https://example.com/cb' });
    expect(new URL(url).searchParams.get('response_type')).toBe('code');
  });

  it('includes the redirect_uri', async () => {
    const { youtubeProvider } = await import('@/lib/oauth/youtube');
    const uri = 'https://app.example.com/api/oauth/youtube/callback';
    const url = youtubeProvider.authorizationUrl({ state: 'x', redirectUri: uri });
    expect(new URL(url).searchParams.get('redirect_uri')).toBe(uri);
  });

  it('does not require PKCE', async () => {
    const { youtubeProvider } = await import('@/lib/oauth/youtube');
    expect(youtubeProvider.requiresPkce).toBe(false);
  });

  it('throws when YOUTUBE_OAUTH_CLIENT_ID is not set', async () => {
    delete process.env.YOUTUBE_OAUTH_CLIENT_ID;
    const { youtubeProvider } = await import('@/lib/oauth/youtube');
    expect(() =>
      youtubeProvider.authorizationUrl({ state: 'x', redirectUri: 'https://example.com' })
    ).toThrow('YOUTUBE_OAUTH_CLIENT_ID');
  });
});

// ─── TikTok Provider ─────────────────────────────────────────────────────────

describe('tiktokProvider.authorizationUrl()', () => {
  beforeEach(() =>
    setEnv({
      TIKTOK_OAUTH_CLIENT_KEY: 'tt-client-key',
      TIKTOK_OAUTH_CLIENT_SECRET: 'tt-client-secret',
    })
  );
  afterEach(restoreEnv);

  it('targets the TikTok v2 authorization endpoint', async () => {
    const { tiktokProvider } = await import('@/lib/oauth/tiktok');
    const url = tiktokProvider.authorizationUrl({ state: 'abc', redirectUri: 'https://example.com/cb' });
    expect(url).toContain('https://www.tiktok.com/v2/auth/authorize/');
  });

  it('includes the client_key', async () => {
    const { tiktokProvider } = await import('@/lib/oauth/tiktok');
    const url = tiktokProvider.authorizationUrl({ state: 'abc', redirectUri: 'https://example.com/cb' });
    expect(new URL(url).searchParams.get('client_key')).toBe('tt-client-key');
  });

  it('includes the state', async () => {
    const { tiktokProvider } = await import('@/lib/oauth/tiktok');
    const url = tiktokProvider.authorizationUrl({ state: 'nonce123', redirectUri: 'https://example.com/cb' });
    expect(new URL(url).searchParams.get('state')).toBe('nonce123');
  });

  it('includes the video.publish scope', async () => {
    const { tiktokProvider } = await import('@/lib/oauth/tiktok');
    const url = tiktokProvider.authorizationUrl({ state: 'x', redirectUri: 'https://example.com/cb' });
    expect(new URL(url).searchParams.get('scope')).toBe('video.publish');
  });

  it('includes response_type=code', async () => {
    const { tiktokProvider } = await import('@/lib/oauth/tiktok');
    const url = tiktokProvider.authorizationUrl({ state: 'x', redirectUri: 'https://example.com/cb' });
    expect(new URL(url).searchParams.get('response_type')).toBe('code');
  });

  it('includes the redirect_uri', async () => {
    const { tiktokProvider } = await import('@/lib/oauth/tiktok');
    const uri = 'https://app.example.com/api/oauth/tiktok/callback';
    const url = tiktokProvider.authorizationUrl({ state: 'x', redirectUri: uri });
    expect(new URL(url).searchParams.get('redirect_uri')).toBe(uri);
  });

  it('does not require PKCE', async () => {
    const { tiktokProvider } = await import('@/lib/oauth/tiktok');
    expect(tiktokProvider.requiresPkce).toBe(false);
  });

  it('throws when TIKTOK_OAUTH_CLIENT_KEY is not set', async () => {
    delete process.env.TIKTOK_OAUTH_CLIENT_KEY;
    const { tiktokProvider } = await import('@/lib/oauth/tiktok');
    expect(() =>
      tiktokProvider.authorizationUrl({ state: 'x', redirectUri: 'https://example.com' })
    ).toThrow('TIKTOK_OAUTH_CLIENT_KEY');
  });
});

// ─── Facebook Provider ───────────────────────────────────────────────────────

describe('facebookProvider.authorizationUrl()', () => {
  beforeEach(() =>
    setEnv({
      FACEBOOK_APP_ID: 'fb-app-id',
      FACEBOOK_APP_SECRET: 'fb-app-secret',
    })
  );
  afterEach(restoreEnv);

  it('targets the Facebook OAuth dialog for v21.0', async () => {
    const { facebookProvider } = await import('@/lib/oauth/facebook');
    const url = facebookProvider.authorizationUrl({ state: 'abc', redirectUri: 'https://example.com/cb' });
    expect(url).toContain('facebook.com/v21.0/dialog/oauth');
  });

  it('includes the client_id', async () => {
    const { facebookProvider } = await import('@/lib/oauth/facebook');
    const url = facebookProvider.authorizationUrl({ state: 'abc', redirectUri: 'https://example.com/cb' });
    expect(new URL(url).searchParams.get('client_id')).toBe('fb-app-id');
  });

  it('includes the state', async () => {
    const { facebookProvider } = await import('@/lib/oauth/facebook');
    const url = facebookProvider.authorizationUrl({ state: 'nonce-fb', redirectUri: 'https://example.com/cb' });
    expect(new URL(url).searchParams.get('state')).toBe('nonce-fb');
  });

  it('includes the Page management scopes', async () => {
    const { facebookProvider } = await import('@/lib/oauth/facebook');
    const url = facebookProvider.authorizationUrl({ state: 'x', redirectUri: 'https://example.com/cb' });
    const scope = new URL(url).searchParams.get('scope') ?? '';
    expect(scope).toContain('pages_show_list');
    expect(scope).toContain('pages_read_engagement');
    expect(scope).toContain('pages_manage_posts');
  });

  it('includes response_type=code', async () => {
    const { facebookProvider } = await import('@/lib/oauth/facebook');
    const url = facebookProvider.authorizationUrl({ state: 'x', redirectUri: 'https://example.com/cb' });
    expect(new URL(url).searchParams.get('response_type')).toBe('code');
  });

  it('includes the redirect_uri', async () => {
    const { facebookProvider } = await import('@/lib/oauth/facebook');
    const uri = 'https://app.example.com/api/oauth/facebook/callback';
    const url = facebookProvider.authorizationUrl({ state: 'x', redirectUri: uri });
    expect(new URL(url).searchParams.get('redirect_uri')).toBe(uri);
  });

  it('does not require PKCE', async () => {
    const { facebookProvider } = await import('@/lib/oauth/facebook');
    expect(facebookProvider.requiresPkce).toBe(false);
  });

  it('throws when FACEBOOK_APP_ID is not set', async () => {
    delete process.env.FACEBOOK_APP_ID;
    const { facebookProvider } = await import('@/lib/oauth/facebook');
    expect(() =>
      facebookProvider.authorizationUrl({ state: 'x', redirectUri: 'https://example.com' })
    ).toThrow('FACEBOOK_APP_ID');
  });
});

// ─── Canva Provider ──────────────────────────────────────────────────────────

describe('canvaProvider.authorizationUrl()', () => {
  beforeEach(() =>
    setEnv({
      CANVA_CLIENT_ID: 'canva-client-id',
      CANVA_CLIENT_SECRET: 'canva-client-secret',
    })
  );
  afterEach(restoreEnv);

  it('targets the Canva OAuth authorization endpoint', async () => {
    const { canvaProvider } = await import('@/lib/oauth/canva');
    const url = canvaProvider.authorizationUrl({ state: 'abc', redirectUri: 'https://example.com/cb', codeChallenge: 'ch' });
    expect(url).toContain('https://www.canva.com/api/oauth/authorize');
  });

  it('includes the client_id', async () => {
    const { canvaProvider } = await import('@/lib/oauth/canva');
    const url = canvaProvider.authorizationUrl({ state: 'x', redirectUri: 'https://example.com/cb', codeChallenge: 'ch' });
    expect(new URL(url).searchParams.get('client_id')).toBe('canva-client-id');
  });

  it('includes the state', async () => {
    const { canvaProvider } = await import('@/lib/oauth/canva');
    const url = canvaProvider.authorizationUrl({ state: 'canva-nonce', redirectUri: 'https://example.com/cb', codeChallenge: 'ch' });
    expect(new URL(url).searchParams.get('state')).toBe('canva-nonce');
  });

  it('includes the code_challenge', async () => {
    const { canvaProvider } = await import('@/lib/oauth/canva');
    const url = canvaProvider.authorizationUrl({ state: 'x', redirectUri: 'https://example.com/cb', codeChallenge: 'my-challenge' });
    expect(new URL(url).searchParams.get('code_challenge')).toBe('my-challenge');
  });

  it('includes code_challenge_method=S256', async () => {
    const { canvaProvider } = await import('@/lib/oauth/canva');
    const url = canvaProvider.authorizationUrl({ state: 'x', redirectUri: 'https://example.com/cb', codeChallenge: 'ch' });
    expect(new URL(url).searchParams.get('code_challenge_method')).toBe('S256');
  });

  it('includes the expected design scopes', async () => {
    const { canvaProvider } = await import('@/lib/oauth/canva');
    const url = canvaProvider.authorizationUrl({ state: 'x', redirectUri: 'https://example.com/cb', codeChallenge: 'ch' });
    const scope = new URL(url).searchParams.get('scope') ?? '';
    expect(scope).toContain('design:content:write');
    expect(scope).toContain('profile:read');
  });

  it('requires PKCE', async () => {
    const { canvaProvider } = await import('@/lib/oauth/canva');
    expect(canvaProvider.requiresPkce).toBe(true);
  });

  it('includes response_type=code', async () => {
    const { canvaProvider } = await import('@/lib/oauth/canva');
    const url = canvaProvider.authorizationUrl({ state: 'x', redirectUri: 'https://example.com/cb', codeChallenge: 'ch' });
    expect(new URL(url).searchParams.get('response_type')).toBe('code');
  });

  it('throws when CANVA_CLIENT_ID is not set', async () => {
    delete process.env.CANVA_CLIENT_ID;
    const { canvaProvider } = await import('@/lib/oauth/canva');
    expect(() =>
      canvaProvider.authorizationUrl({ state: 'x', redirectUri: 'https://example.com', codeChallenge: 'ch' })
    ).toThrow('CANVA_CLIENT_ID');
  });

  it('sets empty string for code_challenge when not provided', async () => {
    const { canvaProvider } = await import('@/lib/oauth/canva');
    const url = canvaProvider.authorizationUrl({ state: 'x', redirectUri: 'https://example.com/cb' });
    expect(new URL(url).searchParams.get('code_challenge')).toBe('');
  });
});

// ─── getOAuthProvider() ───────────────────────────────────────────────────────

describe('getOAuthProvider()', () => {
  it('returns the youtube provider for "youtube"', async () => {
    const { getOAuthProvider } = await import('@/lib/oauth/index');
    const { youtubeProvider } = await import('@/lib/oauth/youtube');
    expect(getOAuthProvider('youtube')).toBe(youtubeProvider);
  });

  it('returns the tiktok provider for "tiktok"', async () => {
    const { getOAuthProvider } = await import('@/lib/oauth/index');
    const { tiktokProvider } = await import('@/lib/oauth/tiktok');
    expect(getOAuthProvider('tiktok')).toBe(tiktokProvider);
  });

  it('returns the facebook provider for "facebook"', async () => {
    const { getOAuthProvider } = await import('@/lib/oauth/index');
    const { facebookProvider } = await import('@/lib/oauth/facebook');
    expect(getOAuthProvider('facebook')).toBe(facebookProvider);
  });

  it('returns the canva provider for "canva"', async () => {
    const { getOAuthProvider } = await import('@/lib/oauth/index');
    const { canvaProvider } = await import('@/lib/oauth/canva');
    expect(getOAuthProvider('canva')).toBe(canvaProvider);
  });

  it('each returned provider has required interface methods', async () => {
    const { getOAuthProvider } = await import('@/lib/oauth/index');
    for (const platform of ['youtube', 'tiktok', 'facebook', 'canva'] as const) {
      const p = getOAuthProvider(platform);
      expect(typeof p.authorizationUrl).toBe('function');
      expect(typeof p.exchangeCode).toBe('function');
      expect(typeof p.refreshAccessToken).toBe('function');
      expect(typeof p.requiresPkce).toBe('boolean');
    }
  });
});
