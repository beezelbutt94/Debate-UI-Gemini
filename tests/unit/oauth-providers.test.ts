import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { youtubeProvider } from '@/lib/oauth/youtube';
import { tiktokProvider } from '@/lib/oauth/tiktok';
import { facebookProvider } from '@/lib/oauth/facebook';
import { canvaProvider } from '@/lib/oauth/canva';
import { getOAuthProvider, isOAuthPlatform } from '@/lib/oauth/index';

// ─── Environment setup ────────────────────────────────────────────────────────

const envBackup: Record<string, string | undefined> = {};

const TEST_ENV: Record<string, string> = {
  YOUTUBE_OAUTH_CLIENT_ID: 'yt-client-id',
  YOUTUBE_OAUTH_CLIENT_SECRET: 'yt-client-secret',
  TIKTOK_OAUTH_CLIENT_KEY: 'tt-client-key',
  TIKTOK_OAUTH_CLIENT_SECRET: 'tt-client-secret',
  FACEBOOK_APP_ID: 'fb-app-id',
  FACEBOOK_APP_SECRET: 'fb-app-secret',
  CANVA_CLIENT_ID: 'canva-client-id',
  CANVA_CLIENT_SECRET: 'canva-client-secret',
};

beforeAll(() => {
  for (const [key, value] of Object.entries(TEST_ENV)) {
    envBackup[key] = process.env[key];
    process.env[key] = value;
  }
});

afterAll(() => {
  for (const [key, original] of Object.entries(envBackup)) {
    if (original === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = original;
    }
  }
});

const REDIRECT_URI = 'https://app.example.com/api/oauth/youtube/callback';
const STATE = 'random-state-token';
const CODE_CHALLENGE = 'sha256-base64url-challenge';

// ─── getOAuthProvider ─────────────────────────────────────────────────────────

describe('getOAuthProvider', () => {
  it('returns youtubeProvider for "youtube"', () => {
    expect(getOAuthProvider('youtube')).toBe(youtubeProvider);
  });

  it('returns tiktokProvider for "tiktok"', () => {
    expect(getOAuthProvider('tiktok')).toBe(tiktokProvider);
  });

  it('returns facebookProvider for "facebook"', () => {
    expect(getOAuthProvider('facebook')).toBe(facebookProvider);
  });

  it('returns canvaProvider for "canva"', () => {
    expect(getOAuthProvider('canva')).toBe(canvaProvider);
  });
});

// ─── YouTube provider ─────────────────────────────────────────────────────────

describe('youtubeProvider', () => {
  it('requiresPkce is false', () => {
    expect(youtubeProvider.requiresPkce).toBe(false);
  });

  it('authorizationUrl is a valid URL', () => {
    const url = youtubeProvider.authorizationUrl({ state: STATE, redirectUri: REDIRECT_URI });
    expect(() => new URL(url)).not.toThrow();
  });

  it('authorizationUrl uses Google OAuth endpoint', () => {
    const url = youtubeProvider.authorizationUrl({ state: STATE, redirectUri: REDIRECT_URI });
    expect(url).toContain('accounts.google.com');
  });

  it('authorizationUrl includes client_id from env', () => {
    const url = youtubeProvider.authorizationUrl({ state: STATE, redirectUri: REDIRECT_URI });
    expect(url).toContain('yt-client-id');
  });

  it('authorizationUrl includes the state parameter', () => {
    const url = youtubeProvider.authorizationUrl({ state: STATE, redirectUri: REDIRECT_URI });
    const params = new URL(url).searchParams;
    expect(params.get('state')).toBe(STATE);
  });

  it('authorizationUrl includes redirect_uri', () => {
    const url = youtubeProvider.authorizationUrl({ state: STATE, redirectUri: REDIRECT_URI });
    const params = new URL(url).searchParams;
    expect(params.get('redirect_uri')).toBe(REDIRECT_URI);
  });

  it('authorizationUrl has response_type=code', () => {
    const url = youtubeProvider.authorizationUrl({ state: STATE, redirectUri: REDIRECT_URI });
    const params = new URL(url).searchParams;
    expect(params.get('response_type')).toBe('code');
  });

  it('authorizationUrl has access_type=offline for refresh token', () => {
    const url = youtubeProvider.authorizationUrl({ state: STATE, redirectUri: REDIRECT_URI });
    const params = new URL(url).searchParams;
    expect(params.get('access_type')).toBe('offline');
  });

  it('authorizationUrl has prompt=consent to always get refresh token', () => {
    const url = youtubeProvider.authorizationUrl({ state: STATE, redirectUri: REDIRECT_URI });
    const params = new URL(url).searchParams;
    expect(params.get('prompt')).toBe('consent');
  });

  it('authorizationUrl includes YouTube upload scope', () => {
    const url = youtubeProvider.authorizationUrl({ state: STATE, redirectUri: REDIRECT_URI });
    const params = new URL(url).searchParams;
    expect(params.get('scope')).toContain('youtube.upload');
  });

  it('throws when YOUTUBE_OAUTH_CLIENT_ID is unset', () => {
    const savedId = process.env['YOUTUBE_OAUTH_CLIENT_ID'];
    delete process.env['YOUTUBE_OAUTH_CLIENT_ID'];
    expect(() =>
      youtubeProvider.authorizationUrl({ state: STATE, redirectUri: REDIRECT_URI })
    ).toThrow(/YOUTUBE_OAUTH_CLIENT_ID/);
    process.env['YOUTUBE_OAUTH_CLIENT_ID'] = savedId;
  });
});

// ─── TikTok provider ──────────────────────────────────────────────────────────

describe('tiktokProvider', () => {
  it('requiresPkce is false', () => {
    expect(tiktokProvider.requiresPkce).toBe(false);
  });

  it('authorizationUrl is a valid URL', () => {
    const url = tiktokProvider.authorizationUrl({ state: STATE, redirectUri: REDIRECT_URI });
    expect(() => new URL(url)).not.toThrow();
  });

  it('authorizationUrl uses TikTok v2 auth endpoint', () => {
    const url = tiktokProvider.authorizationUrl({ state: STATE, redirectUri: REDIRECT_URI });
    expect(url).toContain('tiktok.com');
    expect(url).toContain('v2/auth');
  });

  it('authorizationUrl includes client_key from env', () => {
    const url = tiktokProvider.authorizationUrl({ state: STATE, redirectUri: REDIRECT_URI });
    expect(url).toContain('tt-client-key');
  });

  it('authorizationUrl includes state', () => {
    const url = tiktokProvider.authorizationUrl({ state: STATE, redirectUri: REDIRECT_URI });
    const params = new URL(url).searchParams;
    expect(params.get('state')).toBe(STATE);
  });

  it('authorizationUrl includes redirect_uri', () => {
    const url = tiktokProvider.authorizationUrl({ state: STATE, redirectUri: REDIRECT_URI });
    const params = new URL(url).searchParams;
    expect(params.get('redirect_uri')).toBe(REDIRECT_URI);
  });

  it('authorizationUrl has response_type=code', () => {
    const url = tiktokProvider.authorizationUrl({ state: STATE, redirectUri: REDIRECT_URI });
    const params = new URL(url).searchParams;
    expect(params.get('response_type')).toBe('code');
  });

  it('authorizationUrl includes video.publish scope', () => {
    const url = tiktokProvider.authorizationUrl({ state: STATE, redirectUri: REDIRECT_URI });
    const params = new URL(url).searchParams;
    expect(params.get('scope')).toContain('video.publish');
  });

  it('throws when TIKTOK_OAUTH_CLIENT_KEY is unset', () => {
    const savedKey = process.env['TIKTOK_OAUTH_CLIENT_KEY'];
    delete process.env['TIKTOK_OAUTH_CLIENT_KEY'];
    expect(() =>
      tiktokProvider.authorizationUrl({ state: STATE, redirectUri: REDIRECT_URI })
    ).toThrow(/TIKTOK_OAUTH_CLIENT_KEY/);
    process.env['TIKTOK_OAUTH_CLIENT_KEY'] = savedKey;
  });
});

// ─── Facebook provider ────────────────────────────────────────────────────────

describe('facebookProvider', () => {
  it('requiresPkce is false', () => {
    expect(facebookProvider.requiresPkce).toBe(false);
  });

  it('authorizationUrl is a valid URL', () => {
    const url = facebookProvider.authorizationUrl({ state: STATE, redirectUri: REDIRECT_URI });
    expect(() => new URL(url)).not.toThrow();
  });

  it('authorizationUrl uses facebook.com dialog/oauth', () => {
    const url = facebookProvider.authorizationUrl({ state: STATE, redirectUri: REDIRECT_URI });
    expect(url).toContain('facebook.com');
    expect(url).toContain('dialog/oauth');
  });

  it('authorizationUrl includes client_id (app id) from env', () => {
    const url = facebookProvider.authorizationUrl({ state: STATE, redirectUri: REDIRECT_URI });
    expect(url).toContain('fb-app-id');
  });

  it('authorizationUrl includes state', () => {
    const url = facebookProvider.authorizationUrl({ state: STATE, redirectUri: REDIRECT_URI });
    const params = new URL(url).searchParams;
    expect(params.get('state')).toBe(STATE);
  });

  it('authorizationUrl includes redirect_uri', () => {
    const url = facebookProvider.authorizationUrl({ state: STATE, redirectUri: REDIRECT_URI });
    const params = new URL(url).searchParams;
    expect(params.get('redirect_uri')).toBe(REDIRECT_URI);
  });

  it('authorizationUrl has response_type=code', () => {
    const url = facebookProvider.authorizationUrl({ state: STATE, redirectUri: REDIRECT_URI });
    const params = new URL(url).searchParams;
    expect(params.get('response_type')).toBe('code');
  });

  it('authorizationUrl includes page-related scopes', () => {
    const url = facebookProvider.authorizationUrl({ state: STATE, redirectUri: REDIRECT_URI });
    const params = new URL(url).searchParams;
    const scope = params.get('scope') ?? '';
    expect(scope).toContain('pages_manage_posts');
  });

  it('authorizationUrl uses the configured Graph API version', () => {
    const url = facebookProvider.authorizationUrl({ state: STATE, redirectUri: REDIRECT_URI });
    // Should contain a version like v21.0
    expect(url).toMatch(/v\d+\.\d+/);
  });

  it('throws when FACEBOOK_APP_ID is unset', () => {
    const savedId = process.env['FACEBOOK_APP_ID'];
    delete process.env['FACEBOOK_APP_ID'];
    expect(() =>
      facebookProvider.authorizationUrl({ state: STATE, redirectUri: REDIRECT_URI })
    ).toThrow(/FACEBOOK_APP_ID/);
    process.env['FACEBOOK_APP_ID'] = savedId;
  });
});

// ─── Canva provider ───────────────────────────────────────────────────────────

describe('canvaProvider', () => {
  it('requiresPkce is true', () => {
    expect(canvaProvider.requiresPkce).toBe(true);
  });

  it('authorizationUrl is a valid URL', () => {
    const url = canvaProvider.authorizationUrl({
      state: STATE,
      redirectUri: REDIRECT_URI,
      codeChallenge: CODE_CHALLENGE,
    });
    expect(() => new URL(url)).not.toThrow();
  });

  it('authorizationUrl uses canva.com/api/oauth/authorize', () => {
    const url = canvaProvider.authorizationUrl({
      state: STATE,
      redirectUri: REDIRECT_URI,
      codeChallenge: CODE_CHALLENGE,
    });
    expect(url).toContain('canva.com');
    expect(url).toContain('oauth/authorize');
  });

  it('authorizationUrl includes client_id from env', () => {
    const url = canvaProvider.authorizationUrl({
      state: STATE,
      redirectUri: REDIRECT_URI,
      codeChallenge: CODE_CHALLENGE,
    });
    expect(url).toContain('canva-client-id');
  });

  it('authorizationUrl includes the code_challenge', () => {
    const url = canvaProvider.authorizationUrl({
      state: STATE,
      redirectUri: REDIRECT_URI,
      codeChallenge: CODE_CHALLENGE,
    });
    const params = new URL(url).searchParams;
    expect(params.get('code_challenge')).toBe(CODE_CHALLENGE);
  });

  it('authorizationUrl sets code_challenge_method=S256', () => {
    const url = canvaProvider.authorizationUrl({
      state: STATE,
      redirectUri: REDIRECT_URI,
      codeChallenge: CODE_CHALLENGE,
    });
    const params = new URL(url).searchParams;
    expect(params.get('code_challenge_method')).toBe('S256');
  });

  it('authorizationUrl includes state', () => {
    const url = canvaProvider.authorizationUrl({
      state: STATE,
      redirectUri: REDIRECT_URI,
      codeChallenge: CODE_CHALLENGE,
    });
    const params = new URL(url).searchParams;
    expect(params.get('state')).toBe(STATE);
  });

  it('authorizationUrl includes redirect_uri', () => {
    const url = canvaProvider.authorizationUrl({
      state: STATE,
      redirectUri: REDIRECT_URI,
      codeChallenge: CODE_CHALLENGE,
    });
    const params = new URL(url).searchParams;
    expect(params.get('redirect_uri')).toBe(REDIRECT_URI);
  });

  it('authorizationUrl includes the design-related scopes', () => {
    const url = canvaProvider.authorizationUrl({
      state: STATE,
      redirectUri: REDIRECT_URI,
      codeChallenge: CODE_CHALLENGE,
    });
    const params = new URL(url).searchParams;
    const scope = params.get('scope') ?? '';
    expect(scope).toContain('design:content:write');
  });

  it('authorizationUrl includes response_type=code', () => {
    const url = canvaProvider.authorizationUrl({
      state: STATE,
      redirectUri: REDIRECT_URI,
      codeChallenge: CODE_CHALLENGE,
    });
    const params = new URL(url).searchParams;
    expect(params.get('response_type')).toBe('code');
  });

  it('throws when CANVA_CLIENT_ID is unset', () => {
    const savedId = process.env['CANVA_CLIENT_ID'];
    delete process.env['CANVA_CLIENT_ID'];
    expect(() =>
      canvaProvider.authorizationUrl({
        state: STATE,
        redirectUri: REDIRECT_URI,
        codeChallenge: CODE_CHALLENGE,
      })
    ).toThrow(/CANVA_CLIENT_ID/);
    process.env['CANVA_CLIENT_ID'] = savedId;
  });
});

// ─── isOAuthPlatform re-export check ─────────────────────────────────────────

describe('oauth/index re-exports', () => {
  it('isOAuthPlatform is re-exported from index', () => {
    expect(typeof isOAuthPlatform).toBe('function');
    expect(isOAuthPlatform('youtube')).toBe(true);
    expect(isOAuthPlatform('invalid')).toBe(false);
  });
});
