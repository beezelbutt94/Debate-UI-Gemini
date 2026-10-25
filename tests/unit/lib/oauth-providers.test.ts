/**
 * Tests for OAuth provider authorizationUrl() methods — these are pure URL
 * builders that don't require network access or real credentials.
 *
 * exchangeCode() and refreshAccessToken() are excluded because they make
 * real HTTP calls; those belong to integration/E2E tests.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { youtubeProvider } from '@/lib/oauth/youtube';
import { tiktokProvider } from '@/lib/oauth/tiktok';
import { facebookProvider } from '@/lib/oauth/facebook';
import { canvaProvider } from '@/lib/oauth/canva';
import { getOAuthProvider } from '@/lib/oauth/index';

const FAKE_ENV = {
  YOUTUBE_OAUTH_CLIENT_ID: 'yt-client-id',
  YOUTUBE_OAUTH_CLIENT_SECRET: 'yt-secret',
  TIKTOK_OAUTH_CLIENT_KEY: 'tt-client-key',
  TIKTOK_OAUTH_CLIENT_SECRET: 'tt-secret',
  FACEBOOK_APP_ID: 'fb-app-id',
  FACEBOOK_APP_SECRET: 'fb-secret',
  CANVA_CLIENT_ID: 'canva-client-id',
  CANVA_CLIENT_SECRET: 'canva-secret',
};

let saved: Record<string, string | undefined> = {};

beforeEach(() => {
  // Snapshot and inject env vars
  for (const [k, v] of Object.entries(FAKE_ENV)) {
    saved[k] = process.env[k];
    process.env[k] = v;
  }
});

afterEach(() => {
  // Restore original env vars
  for (const k of Object.keys(FAKE_ENV)) {
    if (saved[k] === undefined) {
      delete process.env[k];
    } else {
      process.env[k] = saved[k];
    }
  }
  saved = {};
});

// ── youtubeProvider ─────────────────────────────────────────────────────────

describe('youtubeProvider.authorizationUrl', () => {
  const PARAMS = { state: 'test-state', redirectUri: 'https://app.example.com/callback' };

  it('returns a valid URL', () => {
    expect(() => new URL(youtubeProvider.authorizationUrl(PARAMS))).not.toThrow();
  });

  it('points to Google accounts OAuth endpoint', () => {
    const url = new URL(youtubeProvider.authorizationUrl(PARAMS));
    expect(url.hostname).toBe('accounts.google.com');
  });

  it('includes state param', () => {
    const url = new URL(youtubeProvider.authorizationUrl(PARAMS));
    expect(url.searchParams.get('state')).toBe('test-state');
  });

  it('includes redirect_uri param', () => {
    const url = new URL(youtubeProvider.authorizationUrl(PARAMS));
    expect(url.searchParams.get('redirect_uri')).toBe('https://app.example.com/callback');
  });

  it('requests offline access for refresh token', () => {
    const url = new URL(youtubeProvider.authorizationUrl(PARAMS));
    expect(url.searchParams.get('access_type')).toBe('offline');
  });

  it('forces consent prompt to always get refresh token', () => {
    const url = new URL(youtubeProvider.authorizationUrl(PARAMS));
    expect(url.searchParams.get('prompt')).toBe('consent');
  });

  it('requests code response_type', () => {
    const url = new URL(youtubeProvider.authorizationUrl(PARAMS));
    expect(url.searchParams.get('response_type')).toBe('code');
  });

  it('requests youtube.upload scope', () => {
    const url = new URL(youtubeProvider.authorizationUrl(PARAMS));
    expect(url.searchParams.get('scope')).toContain('youtube.upload');
  });

  it('includes the client_id env var', () => {
    const url = new URL(youtubeProvider.authorizationUrl(PARAMS));
    expect(url.searchParams.get('client_id')).toBe('yt-client-id');
  });

  it('requiresPkce is false', () => {
    expect(youtubeProvider.requiresPkce).toBe(false);
  });

  it('throws if YOUTUBE_OAUTH_CLIENT_ID is missing', () => {
    delete process.env.YOUTUBE_OAUTH_CLIENT_ID;
    expect(() => youtubeProvider.authorizationUrl(PARAMS)).toThrow('YOUTUBE_OAUTH_CLIENT_ID');
  });
});

// ── tiktokProvider ──────────────────────────────────────────────────────────

describe('tiktokProvider.authorizationUrl', () => {
  const PARAMS = { state: 'tiktok-state', redirectUri: 'https://app.example.com/callback/tiktok' };

  it('returns a valid URL', () => {
    expect(() => new URL(tiktokProvider.authorizationUrl(PARAMS))).not.toThrow();
  });

  it('points to TikTok auth endpoint', () => {
    const url = new URL(tiktokProvider.authorizationUrl(PARAMS));
    expect(url.hostname).toContain('tiktok.com');
  });

  it('includes state param', () => {
    const url = new URL(tiktokProvider.authorizationUrl(PARAMS));
    expect(url.searchParams.get('state')).toBe('tiktok-state');
  });

  it('includes redirect_uri', () => {
    const url = new URL(tiktokProvider.authorizationUrl(PARAMS));
    expect(url.searchParams.get('redirect_uri')).toBe('https://app.example.com/callback/tiktok');
  });

  it('includes video.publish scope', () => {
    const url = new URL(tiktokProvider.authorizationUrl(PARAMS));
    expect(url.searchParams.get('scope')).toContain('video.publish');
  });

  it('requests code response_type', () => {
    const url = new URL(tiktokProvider.authorizationUrl(PARAMS));
    expect(url.searchParams.get('response_type')).toBe('code');
  });

  it('includes client_key from env', () => {
    const url = new URL(tiktokProvider.authorizationUrl(PARAMS));
    expect(url.searchParams.get('client_key')).toBe('tt-client-key');
  });

  it('requiresPkce is false', () => {
    expect(tiktokProvider.requiresPkce).toBe(false);
  });

  it('throws if TIKTOK_OAUTH_CLIENT_KEY is missing', () => {
    delete process.env.TIKTOK_OAUTH_CLIENT_KEY;
    expect(() => tiktokProvider.authorizationUrl(PARAMS)).toThrow('TIKTOK_OAUTH_CLIENT_KEY');
  });
});

// ── facebookProvider ────────────────────────────────────────────────────────

describe('facebookProvider.authorizationUrl', () => {
  const PARAMS = { state: 'fb-state', redirectUri: 'https://app.example.com/callback/facebook' };

  it('returns a valid URL', () => {
    expect(() => new URL(facebookProvider.authorizationUrl(PARAMS))).not.toThrow();
  });

  it('points to facebook.com dialog/oauth', () => {
    const url = new URL(facebookProvider.authorizationUrl(PARAMS));
    expect(url.hostname).toContain('facebook.com');
    expect(url.pathname).toContain('oauth');
  });

  it('includes state param', () => {
    const url = new URL(facebookProvider.authorizationUrl(PARAMS));
    expect(url.searchParams.get('state')).toBe('fb-state');
  });

  it('includes redirect_uri', () => {
    const url = new URL(facebookProvider.authorizationUrl(PARAMS));
    expect(url.searchParams.get('redirect_uri')).toBe('https://app.example.com/callback/facebook');
  });

  it('includes page-related scopes', () => {
    const url = new URL(facebookProvider.authorizationUrl(PARAMS));
    const scope = url.searchParams.get('scope') ?? '';
    expect(scope).toContain('pages_manage_posts');
  });

  it('requests code response_type', () => {
    const url = new URL(facebookProvider.authorizationUrl(PARAMS));
    expect(url.searchParams.get('response_type')).toBe('code');
  });

  it('includes client_id from env', () => {
    const url = new URL(facebookProvider.authorizationUrl(PARAMS));
    expect(url.searchParams.get('client_id')).toBe('fb-app-id');
  });

  it('requiresPkce is false', () => {
    expect(facebookProvider.requiresPkce).toBe(false);
  });

  it('throws if FACEBOOK_APP_ID is missing', () => {
    delete process.env.FACEBOOK_APP_ID;
    expect(() => facebookProvider.authorizationUrl(PARAMS)).toThrow('FACEBOOK_APP_ID');
  });
});

// ── canvaProvider ───────────────────────────────────────────────────────────

describe('canvaProvider.authorizationUrl', () => {
  const PARAMS = {
    state: 'canva-state',
    redirectUri: 'https://app.example.com/callback/canva',
    codeChallenge: 'abc123challenge',
  };

  it('returns a valid URL', () => {
    expect(() => new URL(canvaProvider.authorizationUrl(PARAMS))).not.toThrow();
  });

  it('points to canva.com authorize endpoint', () => {
    const url = new URL(canvaProvider.authorizationUrl(PARAMS));
    expect(url.hostname).toContain('canva.com');
  });

  it('includes state param', () => {
    const url = new URL(canvaProvider.authorizationUrl(PARAMS));
    expect(url.searchParams.get('state')).toBe('canva-state');
  });

  it('includes redirect_uri', () => {
    const url = new URL(canvaProvider.authorizationUrl(PARAMS));
    expect(url.searchParams.get('redirect_uri')).toBe('https://app.example.com/callback/canva');
  });

  it('includes code_challenge', () => {
    const url = new URL(canvaProvider.authorizationUrl(PARAMS));
    expect(url.searchParams.get('code_challenge')).toBe('abc123challenge');
  });

  it('sets code_challenge_method to S256', () => {
    const url = new URL(canvaProvider.authorizationUrl(PARAMS));
    expect(url.searchParams.get('code_challenge_method')).toBe('S256');
  });

  it('requests code response_type', () => {
    const url = new URL(canvaProvider.authorizationUrl(PARAMS));
    expect(url.searchParams.get('response_type')).toBe('code');
  });

  it('includes design:content:write in scope', () => {
    const url = new URL(canvaProvider.authorizationUrl(PARAMS));
    expect(url.searchParams.get('scope')).toContain('design:content:write');
  });

  it('requiresPkce is true', () => {
    expect(canvaProvider.requiresPkce).toBe(true);
  });

  it('throws if CANVA_CLIENT_ID is missing', () => {
    delete process.env.CANVA_CLIENT_ID;
    expect(() => canvaProvider.authorizationUrl(PARAMS)).toThrow('CANVA_CLIENT_ID');
  });
});

// ── getOAuthProvider ────────────────────────────────────────────────────────

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
