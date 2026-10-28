import { describe, it, expect, beforeEach, afterEach } from 'vitest';

// Each provider reads env vars at call time, so we set them before importing.
// We import dynamically inside tests where necessary to avoid module caching
// issues, but the providers themselves don't memoize env reads so static
// imports work fine here.
import { youtubeProvider } from '@/lib/oauth/youtube';
import { tiktokProvider } from '@/lib/oauth/tiktok';
import { facebookProvider } from '@/lib/oauth/facebook';
import { canvaProvider } from '@/lib/oauth/canva';

const REDIRECT_URI = 'https://app.example.com/api/oauth/youtube/callback';

// ── YouTube ──────────────────────────────────────────────────────────────

describe('youtubeProvider.authorizationUrl()', () => {
  beforeEach(() => {
    process.env.YOUTUBE_OAUTH_CLIENT_ID = 'yt-client-id';
    process.env.YOUTUBE_OAUTH_CLIENT_SECRET = 'yt-secret';
  });
  afterEach(() => {
    delete process.env.YOUTUBE_OAUTH_CLIENT_ID;
    delete process.env.YOUTUBE_OAUTH_CLIENT_SECRET;
  });

  it('points to the Google accounts endpoint', () => {
    const url = youtubeProvider.authorizationUrl({ state: 'abc', redirectUri: REDIRECT_URI });
    expect(url).toContain('accounts.google.com/o/oauth2/v2/auth');
  });

  it('includes the client_id', () => {
    const url = youtubeProvider.authorizationUrl({ state: 'abc', redirectUri: REDIRECT_URI });
    expect(url).toContain('client_id=yt-client-id');
  });

  it('includes the correct scope', () => {
    const url = youtubeProvider.authorizationUrl({ state: 'abc', redirectUri: REDIRECT_URI });
    expect(url).toContain('youtube.upload');
  });

  it('includes access_type=offline', () => {
    const url = youtubeProvider.authorizationUrl({ state: 'abc', redirectUri: REDIRECT_URI });
    expect(url).toContain('access_type=offline');
  });

  it('includes prompt=consent', () => {
    const url = youtubeProvider.authorizationUrl({ state: 'abc', redirectUri: REDIRECT_URI });
    expect(url).toContain('prompt=consent');
  });

  it('includes the state parameter', () => {
    const url = youtubeProvider.authorizationUrl({ state: 'my-state-xyz', redirectUri: REDIRECT_URI });
    expect(url).toContain('state=my-state-xyz');
  });

  it('includes the redirect_uri', () => {
    const url = youtubeProvider.authorizationUrl({ state: 'abc', redirectUri: REDIRECT_URI });
    expect(url).toContain(encodeURIComponent(REDIRECT_URI));
  });

  it('does not require PKCE', () => {
    expect(youtubeProvider.requiresPkce).toBe(false);
  });

  it('throws when YOUTUBE_OAUTH_CLIENT_ID is missing', () => {
    delete process.env.YOUTUBE_OAUTH_CLIENT_ID;
    expect(() => youtubeProvider.authorizationUrl({ state: 'abc', redirectUri: REDIRECT_URI })).toThrow(
      'YOUTUBE_OAUTH_CLIENT_ID'
    );
  });
});

// ── TikTok ───────────────────────────────────────────────────────────────

describe('tiktokProvider.authorizationUrl()', () => {
  beforeEach(() => {
    process.env.TIKTOK_OAUTH_CLIENT_KEY = 'tt-client-key';
    process.env.TIKTOK_OAUTH_CLIENT_SECRET = 'tt-secret';
  });
  afterEach(() => {
    delete process.env.TIKTOK_OAUTH_CLIENT_KEY;
    delete process.env.TIKTOK_OAUTH_CLIENT_SECRET;
  });

  it('points to the TikTok authorization endpoint', () => {
    const url = tiktokProvider.authorizationUrl({ state: 'abc', redirectUri: REDIRECT_URI });
    expect(url).toContain('tiktok.com/v2/auth/authorize');
  });

  it('includes the client_key', () => {
    const url = tiktokProvider.authorizationUrl({ state: 'abc', redirectUri: REDIRECT_URI });
    expect(url).toContain('client_key=tt-client-key');
  });

  it('includes video.publish scope', () => {
    const url = tiktokProvider.authorizationUrl({ state: 'abc', redirectUri: REDIRECT_URI });
    expect(url).toContain('video.publish');
  });

  it('includes the state parameter', () => {
    const url = tiktokProvider.authorizationUrl({ state: 'tiktok-state', redirectUri: REDIRECT_URI });
    expect(url).toContain('state=tiktok-state');
  });

  it('does not require PKCE', () => {
    expect(tiktokProvider.requiresPkce).toBe(false);
  });

  it('throws when TIKTOK_OAUTH_CLIENT_KEY is missing', () => {
    delete process.env.TIKTOK_OAUTH_CLIENT_KEY;
    expect(() => tiktokProvider.authorizationUrl({ state: 'abc', redirectUri: REDIRECT_URI })).toThrow(
      'TIKTOK_OAUTH_CLIENT_KEY'
    );
  });
});

// ── Facebook ─────────────────────────────────────────────────────────────

describe('facebookProvider.authorizationUrl()', () => {
  beforeEach(() => {
    process.env.FACEBOOK_APP_ID = 'fb-app-id';
    process.env.FACEBOOK_APP_SECRET = 'fb-secret';
  });
  afterEach(() => {
    delete process.env.FACEBOOK_APP_ID;
    delete process.env.FACEBOOK_APP_SECRET;
  });

  it('points to the Facebook oauth dialog', () => {
    const url = facebookProvider.authorizationUrl({ state: 'abc', redirectUri: REDIRECT_URI });
    expect(url).toContain('facebook.com');
    expect(url).toContain('/dialog/oauth');
  });

  it('includes the client_id (app id)', () => {
    const url = facebookProvider.authorizationUrl({ state: 'abc', redirectUri: REDIRECT_URI });
    expect(url).toContain('client_id=fb-app-id');
  });

  it('includes page management scopes', () => {
    const url = facebookProvider.authorizationUrl({ state: 'abc', redirectUri: REDIRECT_URI });
    expect(url).toContain('pages_show_list');
    expect(url).toContain('pages_manage_posts');
  });

  it('includes the state parameter', () => {
    const url = facebookProvider.authorizationUrl({ state: 'fb-state', redirectUri: REDIRECT_URI });
    expect(url).toContain('state=fb-state');
  });

  it('does not require PKCE', () => {
    expect(facebookProvider.requiresPkce).toBe(false);
  });

  it('throws when FACEBOOK_APP_ID is missing', () => {
    delete process.env.FACEBOOK_APP_ID;
    expect(() => facebookProvider.authorizationUrl({ state: 'abc', redirectUri: REDIRECT_URI })).toThrow(
      'FACEBOOK_APP_ID'
    );
  });
});

// ── Canva ────────────────────────────────────────────────────────────────

describe('canvaProvider.authorizationUrl()', () => {
  beforeEach(() => {
    process.env.CANVA_CLIENT_ID = 'canva-client-id';
    process.env.CANVA_CLIENT_SECRET = 'canva-secret';
  });
  afterEach(() => {
    delete process.env.CANVA_CLIENT_ID;
    delete process.env.CANVA_CLIENT_SECRET;
  });

  it('points to the Canva authorization endpoint', () => {
    const url = canvaProvider.authorizationUrl({
      state: 'abc',
      redirectUri: REDIRECT_URI,
      codeChallenge: 'challenge123',
    });
    expect(url).toContain('canva.com/api/oauth/authorize');
  });

  it('includes the client_id', () => {
    const url = canvaProvider.authorizationUrl({
      state: 'abc',
      redirectUri: REDIRECT_URI,
      codeChallenge: 'challenge123',
    });
    expect(url).toContain('client_id=canva-client-id');
  });

  it('includes the code_challenge', () => {
    const url = canvaProvider.authorizationUrl({
      state: 'abc',
      redirectUri: REDIRECT_URI,
      codeChallenge: 'my-challenge',
    });
    expect(url).toContain('code_challenge=my-challenge');
  });

  it('includes code_challenge_method=S256', () => {
    const url = canvaProvider.authorizationUrl({
      state: 'abc',
      redirectUri: REDIRECT_URI,
      codeChallenge: 'challenge123',
    });
    expect(url).toContain('code_challenge_method=S256');
  });

  it('includes design scopes', () => {
    const url = canvaProvider.authorizationUrl({
      state: 'abc',
      redirectUri: REDIRECT_URI,
      codeChallenge: 'challenge123',
    });
    expect(url).toContain('design%3Acontent%3Awrite');
  });

  it('includes the state parameter', () => {
    const url = canvaProvider.authorizationUrl({
      state: 'canva-state',
      redirectUri: REDIRECT_URI,
      codeChallenge: 'challenge123',
    });
    expect(url).toContain('state=canva-state');
  });

  it('requires PKCE', () => {
    expect(canvaProvider.requiresPkce).toBe(true);
  });

  it('throws when CANVA_CLIENT_ID is missing', () => {
    delete process.env.CANVA_CLIENT_ID;
    expect(() =>
      canvaProvider.authorizationUrl({ state: 'abc', redirectUri: REDIRECT_URI, codeChallenge: 'c' })
    ).toThrow('CANVA_CLIENT_ID');
  });
});

// ── getOAuthProvider (index) ──────────────────────────────────────────────

describe('getOAuthProvider()', () => {
  it('returns youtubeProvider for "youtube"', async () => {
    const { getOAuthProvider } = await import('@/lib/oauth/index');
    expect(getOAuthProvider('youtube')).toBe(youtubeProvider);
  });

  it('returns tiktokProvider for "tiktok"', async () => {
    const { getOAuthProvider } = await import('@/lib/oauth/index');
    expect(getOAuthProvider('tiktok')).toBe(tiktokProvider);
  });

  it('returns facebookProvider for "facebook"', async () => {
    const { getOAuthProvider } = await import('@/lib/oauth/index');
    expect(getOAuthProvider('facebook')).toBe(facebookProvider);
  });

  it('returns canvaProvider for "canva"', async () => {
    const { getOAuthProvider } = await import('@/lib/oauth/index');
    expect(getOAuthProvider('canva')).toBe(canvaProvider);
  });
});
