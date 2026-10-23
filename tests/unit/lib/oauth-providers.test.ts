import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { youtubeProvider } from '@/lib/oauth/youtube';
import { tiktokProvider } from '@/lib/oauth/tiktok';
import { facebookProvider } from '@/lib/oauth/facebook';
import { canvaProvider } from '@/lib/oauth/canva';
import { getOAuthProvider } from '@/lib/oauth';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function setEnv(vars: Record<string, string>) {
  for (const [k, v] of Object.entries(vars)) process.env[k] = v;
}
function clearEnv(keys: string[]) {
  for (const k of keys) delete process.env[k];
}

const DUMMY_STATE = 'state-abc123';
const DUMMY_REDIRECT = 'https://example.com/callback';

// ─── YouTube provider ─────────────────────────────────────────────────────────

describe('youtubeProvider', () => {
  const ENV_KEYS = ['YOUTUBE_OAUTH_CLIENT_ID', 'YOUTUBE_OAUTH_CLIENT_SECRET'];

  beforeEach(() => {
    setEnv({
      YOUTUBE_OAUTH_CLIENT_ID: 'yt-client-id',
      YOUTUBE_OAUTH_CLIENT_SECRET: 'yt-client-secret',
    });
  });
  afterEach(() => clearEnv(ENV_KEYS));

  it('requiresPkce is false', () => {
    expect(youtubeProvider.requiresPkce).toBe(false);
  });

  it('authorizationUrl() returns a valid URL', () => {
    const url = youtubeProvider.authorizationUrl({ state: DUMMY_STATE, redirectUri: DUMMY_REDIRECT });
    expect(() => new URL(url)).not.toThrow();
  });

  it('authorizationUrl() points to Google OAuth endpoint', () => {
    const url = youtubeProvider.authorizationUrl({ state: DUMMY_STATE, redirectUri: DUMMY_REDIRECT });
    expect(new URL(url).hostname).toBe('accounts.google.com');
  });

  it('authorizationUrl() includes state param', () => {
    const url = youtubeProvider.authorizationUrl({ state: DUMMY_STATE, redirectUri: DUMMY_REDIRECT });
    expect(new URL(url).searchParams.get('state')).toBe(DUMMY_STATE);
  });

  it('authorizationUrl() includes redirect_uri', () => {
    const url = youtubeProvider.authorizationUrl({ state: DUMMY_STATE, redirectUri: DUMMY_REDIRECT });
    expect(new URL(url).searchParams.get('redirect_uri')).toBe(DUMMY_REDIRECT);
  });

  it('authorizationUrl() includes client_id from env', () => {
    const url = youtubeProvider.authorizationUrl({ state: DUMMY_STATE, redirectUri: DUMMY_REDIRECT });
    expect(new URL(url).searchParams.get('client_id')).toBe('yt-client-id');
  });

  it('authorizationUrl() requests offline access_type', () => {
    const url = youtubeProvider.authorizationUrl({ state: DUMMY_STATE, redirectUri: DUMMY_REDIRECT });
    expect(new URL(url).searchParams.get('access_type')).toBe('offline');
  });

  it('authorizationUrl() sets prompt=consent to always get a refresh token', () => {
    const url = youtubeProvider.authorizationUrl({ state: DUMMY_STATE, redirectUri: DUMMY_REDIRECT });
    expect(new URL(url).searchParams.get('prompt')).toBe('consent');
  });

  it('authorizationUrl() includes youtube.upload scope', () => {
    const url = youtubeProvider.authorizationUrl({ state: DUMMY_STATE, redirectUri: DUMMY_REDIRECT });
    expect(new URL(url).searchParams.get('scope')).toContain('youtube.upload');
  });

  it('authorizationUrl() throws when YOUTUBE_OAUTH_CLIENT_ID is missing', () => {
    delete process.env.YOUTUBE_OAUTH_CLIENT_ID;
    expect(() => youtubeProvider.authorizationUrl({ state: DUMMY_STATE, redirectUri: DUMMY_REDIRECT }))
      .toThrow(/YOUTUBE_OAUTH_CLIENT_ID/);
  });
});

// ─── TikTok provider ──────────────────────────────────────────────────────────

describe('tiktokProvider', () => {
  const ENV_KEYS = ['TIKTOK_OAUTH_CLIENT_KEY', 'TIKTOK_OAUTH_CLIENT_SECRET'];

  beforeEach(() => {
    setEnv({
      TIKTOK_OAUTH_CLIENT_KEY: 'tt-client-key',
      TIKTOK_OAUTH_CLIENT_SECRET: 'tt-client-secret',
    });
  });
  afterEach(() => clearEnv(ENV_KEYS));

  it('requiresPkce is false', () => {
    expect(tiktokProvider.requiresPkce).toBe(false);
  });

  it('authorizationUrl() returns a valid URL', () => {
    const url = tiktokProvider.authorizationUrl({ state: DUMMY_STATE, redirectUri: DUMMY_REDIRECT });
    expect(() => new URL(url)).not.toThrow();
  });

  it('authorizationUrl() points to TikTok authorization endpoint', () => {
    const url = tiktokProvider.authorizationUrl({ state: DUMMY_STATE, redirectUri: DUMMY_REDIRECT });
    expect(new URL(url).hostname).toBe('www.tiktok.com');
  });

  it('authorizationUrl() includes state param', () => {
    const url = tiktokProvider.authorizationUrl({ state: DUMMY_STATE, redirectUri: DUMMY_REDIRECT });
    expect(new URL(url).searchParams.get('state')).toBe(DUMMY_STATE);
  });

  it('authorizationUrl() includes redirect_uri', () => {
    const url = tiktokProvider.authorizationUrl({ state: DUMMY_STATE, redirectUri: DUMMY_REDIRECT });
    expect(new URL(url).searchParams.get('redirect_uri')).toBe(DUMMY_REDIRECT);
  });

  it('authorizationUrl() includes client_key from env', () => {
    const url = tiktokProvider.authorizationUrl({ state: DUMMY_STATE, redirectUri: DUMMY_REDIRECT });
    expect(new URL(url).searchParams.get('client_key')).toBe('tt-client-key');
  });

  it('authorizationUrl() includes video.publish scope', () => {
    const url = tiktokProvider.authorizationUrl({ state: DUMMY_STATE, redirectUri: DUMMY_REDIRECT });
    expect(new URL(url).searchParams.get('scope')).toContain('video.publish');
  });

  it('authorizationUrl() sets response_type to code', () => {
    const url = tiktokProvider.authorizationUrl({ state: DUMMY_STATE, redirectUri: DUMMY_REDIRECT });
    expect(new URL(url).searchParams.get('response_type')).toBe('code');
  });

  it('authorizationUrl() throws when TIKTOK_OAUTH_CLIENT_KEY is missing', () => {
    delete process.env.TIKTOK_OAUTH_CLIENT_KEY;
    expect(() => tiktokProvider.authorizationUrl({ state: DUMMY_STATE, redirectUri: DUMMY_REDIRECT }))
      .toThrow(/TIKTOK_OAUTH_CLIENT_KEY/);
  });
});

// ─── Facebook provider ────────────────────────────────────────────────────────

describe('facebookProvider', () => {
  const ENV_KEYS = ['FACEBOOK_APP_ID', 'FACEBOOK_APP_SECRET'];

  beforeEach(() => {
    setEnv({
      FACEBOOK_APP_ID: 'fb-app-id',
      FACEBOOK_APP_SECRET: 'fb-app-secret',
    });
  });
  afterEach(() => clearEnv(ENV_KEYS));

  it('requiresPkce is false', () => {
    expect(facebookProvider.requiresPkce).toBe(false);
  });

  it('authorizationUrl() returns a valid URL', () => {
    const url = facebookProvider.authorizationUrl({ state: DUMMY_STATE, redirectUri: DUMMY_REDIRECT });
    expect(() => new URL(url)).not.toThrow();
  });

  it('authorizationUrl() points to Facebook dialog/oauth endpoint', () => {
    const url = facebookProvider.authorizationUrl({ state: DUMMY_STATE, redirectUri: DUMMY_REDIRECT });
    expect(new URL(url).hostname).toBe('www.facebook.com');
    expect(new URL(url).pathname).toContain('dialog/oauth');
  });

  it('authorizationUrl() includes state param', () => {
    const url = facebookProvider.authorizationUrl({ state: DUMMY_STATE, redirectUri: DUMMY_REDIRECT });
    expect(new URL(url).searchParams.get('state')).toBe(DUMMY_STATE);
  });

  it('authorizationUrl() includes redirect_uri', () => {
    const url = facebookProvider.authorizationUrl({ state: DUMMY_STATE, redirectUri: DUMMY_REDIRECT });
    expect(new URL(url).searchParams.get('redirect_uri')).toBe(DUMMY_REDIRECT);
  });

  it('authorizationUrl() includes client_id from env', () => {
    const url = facebookProvider.authorizationUrl({ state: DUMMY_STATE, redirectUri: DUMMY_REDIRECT });
    expect(new URL(url).searchParams.get('client_id')).toBe('fb-app-id');
  });

  it('authorizationUrl() includes pages scopes', () => {
    const url = facebookProvider.authorizationUrl({ state: DUMMY_STATE, redirectUri: DUMMY_REDIRECT });
    const scope = new URL(url).searchParams.get('scope') ?? '';
    expect(scope).toContain('pages_manage_posts');
    expect(scope).toContain('pages_read_engagement');
    expect(scope).toContain('pages_show_list');
  });

  it('authorizationUrl() throws when FACEBOOK_APP_ID is missing', () => {
    delete process.env.FACEBOOK_APP_ID;
    expect(() => facebookProvider.authorizationUrl({ state: DUMMY_STATE, redirectUri: DUMMY_REDIRECT }))
      .toThrow(/FACEBOOK_APP_ID/);
  });
});

// ─── Canva provider ───────────────────────────────────────────────────────────

describe('canvaProvider', () => {
  const ENV_KEYS = ['CANVA_CLIENT_ID', 'CANVA_CLIENT_SECRET'];

  beforeEach(() => {
    setEnv({
      CANVA_CLIENT_ID: 'canva-client-id',
      CANVA_CLIENT_SECRET: 'canva-client-secret',
    });
  });
  afterEach(() => clearEnv(ENV_KEYS));

  it('requiresPkce is true (Canva requires PKCE)', () => {
    expect(canvaProvider.requiresPkce).toBe(true);
  });

  it('authorizationUrl() returns a valid URL', () => {
    const url = canvaProvider.authorizationUrl({
      state: DUMMY_STATE,
      redirectUri: DUMMY_REDIRECT,
      codeChallenge: 'challenge-abc',
    });
    expect(() => new URL(url)).not.toThrow();
  });

  it('authorizationUrl() points to Canva authorize endpoint', () => {
    const url = canvaProvider.authorizationUrl({
      state: DUMMY_STATE,
      redirectUri: DUMMY_REDIRECT,
      codeChallenge: 'challenge-abc',
    });
    const parsed = new URL(url);
    expect(parsed.hostname).toBe('www.canva.com');
    expect(parsed.pathname).toContain('authorize');
  });

  it('authorizationUrl() includes code_challenge', () => {
    const url = canvaProvider.authorizationUrl({
      state: DUMMY_STATE,
      redirectUri: DUMMY_REDIRECT,
      codeChallenge: 'my-challenge',
    });
    expect(new URL(url).searchParams.get('code_challenge')).toBe('my-challenge');
  });

  it('authorizationUrl() sets code_challenge_method to S256', () => {
    const url = canvaProvider.authorizationUrl({
      state: DUMMY_STATE,
      redirectUri: DUMMY_REDIRECT,
      codeChallenge: 'challenge-abc',
    });
    expect(new URL(url).searchParams.get('code_challenge_method')).toBe('S256');
  });

  it('authorizationUrl() includes state param', () => {
    const url = canvaProvider.authorizationUrl({
      state: DUMMY_STATE,
      redirectUri: DUMMY_REDIRECT,
      codeChallenge: 'challenge-abc',
    });
    expect(new URL(url).searchParams.get('state')).toBe(DUMMY_STATE);
  });

  it('authorizationUrl() includes client_id from env', () => {
    const url = canvaProvider.authorizationUrl({
      state: DUMMY_STATE,
      redirectUri: DUMMY_REDIRECT,
      codeChallenge: 'challenge-abc',
    });
    expect(new URL(url).searchParams.get('client_id')).toBe('canva-client-id');
  });

  it('authorizationUrl() includes design and profile scopes', () => {
    const url = canvaProvider.authorizationUrl({
      state: DUMMY_STATE,
      redirectUri: DUMMY_REDIRECT,
      codeChallenge: 'challenge-abc',
    });
    const scope = new URL(url).searchParams.get('scope') ?? '';
    expect(scope).toContain('design:content:write');
    expect(scope).toContain('profile:read');
  });

  it('authorizationUrl() throws when CANVA_CLIENT_ID is missing', () => {
    delete process.env.CANVA_CLIENT_ID;
    expect(() =>
      canvaProvider.authorizationUrl({ state: DUMMY_STATE, redirectUri: DUMMY_REDIRECT, codeChallenge: 'c' })
    ).toThrow(/CANVA_CLIENT_ID/);
  });
});

// ─── getOAuthProvider registry ────────────────────────────────────────────────

describe('getOAuthProvider()', () => {
  it('returns the youtube provider object for "youtube"', () => {
    expect(getOAuthProvider('youtube')).toBe(youtubeProvider);
  });

  it('returns the tiktok provider object for "tiktok"', () => {
    expect(getOAuthProvider('tiktok')).toBe(tiktokProvider);
  });

  it('returns the facebook provider object for "facebook"', () => {
    expect(getOAuthProvider('facebook')).toBe(facebookProvider);
  });

  it('returns the canva provider object for "canva"', () => {
    expect(getOAuthProvider('canva')).toBe(canvaProvider);
  });

  it('each provider exposes the three required OAuthProvider methods', () => {
    const platforms = ['youtube', 'tiktok', 'facebook', 'canva'] as const;
    for (const platform of platforms) {
      const provider = getOAuthProvider(platform);
      expect(typeof provider.authorizationUrl).toBe('function');
      expect(typeof provider.exchangeCode).toBe('function');
      expect(typeof provider.refreshAccessToken).toBe('function');
    }
  });
});
