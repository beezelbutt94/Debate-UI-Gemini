/**
 * Tests for the authorizationUrl() methods on the four OAuth providers.
 * These are pure URL-builders that don't make network calls and are
 * entirely testable without mocking fetch.
 *
 * exchangeCode / refreshAccessToken make network calls so they are excluded
 * here (they would require integration-test-level fetch mocking not needed
 * to hit 98 %).
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { getOAuthProvider } from '@/lib/oauth';
import { youtubeProvider } from '@/lib/oauth/youtube';
import { tiktokProvider } from '@/lib/oauth/tiktok';
import { facebookProvider } from '@/lib/oauth/facebook';
import { canvaProvider } from '@/lib/oauth/canva';

const STATE = 'test-state-abc';
const REDIRECT_URI = 'https://app.example.com/api/oauth/youtube/callback';

// Set environment vars needed by requireEnv() inside the providers
beforeEach(() => {
  process.env.YOUTUBE_OAUTH_CLIENT_ID = 'yt-client-id';
  process.env.YOUTUBE_OAUTH_CLIENT_SECRET = 'yt-client-secret';
  process.env.TIKTOK_OAUTH_CLIENT_KEY = 'tk-client-key';
  process.env.TIKTOK_OAUTH_CLIENT_SECRET = 'tk-client-secret';
  process.env.FACEBOOK_APP_ID = 'fb-app-id';
  process.env.FACEBOOK_APP_SECRET = 'fb-app-secret';
  process.env.CANVA_CLIENT_ID = 'canva-client-id';
  process.env.CANVA_CLIENT_SECRET = 'canva-client-secret';
});

afterEach(() => {
  delete process.env.YOUTUBE_OAUTH_CLIENT_ID;
  delete process.env.YOUTUBE_OAUTH_CLIENT_SECRET;
  delete process.env.TIKTOK_OAUTH_CLIENT_KEY;
  delete process.env.TIKTOK_OAUTH_CLIENT_SECRET;
  delete process.env.FACEBOOK_APP_ID;
  delete process.env.FACEBOOK_APP_SECRET;
  delete process.env.CANVA_CLIENT_ID;
  delete process.env.CANVA_CLIENT_SECRET;
});

// ─── getOAuthProvider ───────────────────────────────────────────────────────

describe('getOAuthProvider', () => {
  it('returns youtubeProvider for youtube', () => {
    expect(getOAuthProvider('youtube')).toBe(youtubeProvider);
  });

  it('returns tiktokProvider for tiktok', () => {
    expect(getOAuthProvider('tiktok')).toBe(tiktokProvider);
  });

  it('returns facebookProvider for facebook', () => {
    expect(getOAuthProvider('facebook')).toBe(facebookProvider);
  });

  it('returns canvaProvider for canva', () => {
    expect(getOAuthProvider('canva')).toBe(canvaProvider);
  });
});

// ─── YouTube provider ────────────────────────────────────────────────────────

describe('youtubeProvider.authorizationUrl', () => {
  it('returns a valid HTTPS URL', () => {
    const url = youtubeProvider.authorizationUrl({ state: STATE, redirectUri: REDIRECT_URI });
    expect(url).toMatch(/^https:\/\//);
  });

  it('targets Google accounts endpoint', () => {
    const url = youtubeProvider.authorizationUrl({ state: STATE, redirectUri: REDIRECT_URI });
    expect(url).toContain('accounts.google.com');
  });

  it('contains the client_id', () => {
    const url = youtubeProvider.authorizationUrl({ state: STATE, redirectUri: REDIRECT_URI });
    expect(url).toContain('client_id=yt-client-id');
  });

  it('contains the state', () => {
    const url = youtubeProvider.authorizationUrl({ state: STATE, redirectUri: REDIRECT_URI });
    expect(url).toContain(`state=${STATE}`);
  });

  it('contains the redirect_uri', () => {
    const url = youtubeProvider.authorizationUrl({ state: STATE, redirectUri: REDIRECT_URI });
    expect(url).toContain(encodeURIComponent(REDIRECT_URI));
  });

  it('requests offline access_type', () => {
    const url = youtubeProvider.authorizationUrl({ state: STATE, redirectUri: REDIRECT_URI });
    expect(url).toContain('access_type=offline');
  });

  it('requests consent prompt to always get a refresh token', () => {
    const url = youtubeProvider.authorizationUrl({ state: STATE, redirectUri: REDIRECT_URI });
    expect(url).toContain('prompt=consent');
  });

  it('requests youtube.upload scope', () => {
    const url = youtubeProvider.authorizationUrl({ state: STATE, redirectUri: REDIRECT_URI });
    expect(decodeURIComponent(url)).toContain('youtube.upload');
  });

  it('does not require PKCE', () => {
    expect(youtubeProvider.requiresPkce).toBe(false);
  });

  it('throws when YOUTUBE_OAUTH_CLIENT_ID is missing', () => {
    delete process.env.YOUTUBE_OAUTH_CLIENT_ID;
    expect(() => youtubeProvider.authorizationUrl({ state: STATE, redirectUri: REDIRECT_URI })).toThrow();
  });
});

// ─── TikTok provider ─────────────────────────────────────────────────────────

describe('tiktokProvider.authorizationUrl', () => {
  it('targets TikTok authorize endpoint', () => {
    const url = tiktokProvider.authorizationUrl({ state: STATE, redirectUri: REDIRECT_URI });
    expect(url).toContain('tiktok.com');
  });

  it('contains client_key', () => {
    const url = tiktokProvider.authorizationUrl({ state: STATE, redirectUri: REDIRECT_URI });
    expect(url).toContain('client_key=tk-client-key');
  });

  it('requests video.publish scope', () => {
    const url = tiktokProvider.authorizationUrl({ state: STATE, redirectUri: REDIRECT_URI });
    expect(url).toContain('scope=video.publish');
  });

  it('contains the state', () => {
    const url = tiktokProvider.authorizationUrl({ state: STATE, redirectUri: REDIRECT_URI });
    expect(url).toContain(`state=${STATE}`);
  });

  it('contains the redirect_uri', () => {
    const url = tiktokProvider.authorizationUrl({ state: STATE, redirectUri: REDIRECT_URI });
    expect(url).toContain(encodeURIComponent(REDIRECT_URI));
  });

  it('does not require PKCE', () => {
    expect(tiktokProvider.requiresPkce).toBe(false);
  });

  it('throws when TIKTOK_OAUTH_CLIENT_KEY is missing', () => {
    delete process.env.TIKTOK_OAUTH_CLIENT_KEY;
    expect(() => tiktokProvider.authorizationUrl({ state: STATE, redirectUri: REDIRECT_URI })).toThrow();
  });
});

// ─── Facebook provider ───────────────────────────────────────────────────────

describe('facebookProvider.authorizationUrl', () => {
  it('targets Facebook dialog/oauth endpoint', () => {
    const url = facebookProvider.authorizationUrl({ state: STATE, redirectUri: REDIRECT_URI });
    expect(url).toContain('facebook.com');
    expect(url).toContain('dialog/oauth');
  });

  it('contains client_id', () => {
    const url = facebookProvider.authorizationUrl({ state: STATE, redirectUri: REDIRECT_URI });
    expect(url).toContain('client_id=fb-app-id');
  });

  it('contains the pages scopes', () => {
    const url = facebookProvider.authorizationUrl({ state: STATE, redirectUri: REDIRECT_URI });
    expect(decodeURIComponent(url)).toContain('pages_show_list');
  });

  it('contains the state', () => {
    const url = facebookProvider.authorizationUrl({ state: STATE, redirectUri: REDIRECT_URI });
    expect(url).toContain(`state=${STATE}`);
  });

  it('does not require PKCE', () => {
    expect(facebookProvider.requiresPkce).toBe(false);
  });

  it('throws when FACEBOOK_APP_ID is missing', () => {
    delete process.env.FACEBOOK_APP_ID;
    expect(() => facebookProvider.authorizationUrl({ state: STATE, redirectUri: REDIRECT_URI })).toThrow();
  });
});

// ─── Canva provider ──────────────────────────────────────────────────────────

describe('canvaProvider.authorizationUrl', () => {
  const CODE_CHALLENGE = 'some-code-challenge-base64url';

  it('targets Canva authorize endpoint', () => {
    const url = canvaProvider.authorizationUrl({ state: STATE, redirectUri: REDIRECT_URI, codeChallenge: CODE_CHALLENGE });
    expect(url).toContain('canva.com');
    expect(url).toContain('authorize');
  });

  it('contains client_id', () => {
    const url = canvaProvider.authorizationUrl({ state: STATE, redirectUri: REDIRECT_URI, codeChallenge: CODE_CHALLENGE });
    expect(url).toContain('client_id=canva-client-id');
  });

  it('contains the code_challenge', () => {
    const url = canvaProvider.authorizationUrl({ state: STATE, redirectUri: REDIRECT_URI, codeChallenge: CODE_CHALLENGE });
    expect(url).toContain(`code_challenge=${CODE_CHALLENGE}`);
  });

  it('uses S256 code_challenge_method', () => {
    const url = canvaProvider.authorizationUrl({ state: STATE, redirectUri: REDIRECT_URI, codeChallenge: CODE_CHALLENGE });
    expect(url).toContain('code_challenge_method=S256');
  });

  it('contains the state', () => {
    const url = canvaProvider.authorizationUrl({ state: STATE, redirectUri: REDIRECT_URI, codeChallenge: CODE_CHALLENGE });
    expect(url).toContain(`state=${STATE}`);
  });

  it('requires PKCE', () => {
    expect(canvaProvider.requiresPkce).toBe(true);
  });

  it('throws when CANVA_CLIENT_ID is missing', () => {
    delete process.env.CANVA_CLIENT_ID;
    expect(() =>
      canvaProvider.authorizationUrl({ state: STATE, redirectUri: REDIRECT_URI, codeChallenge: CODE_CHALLENGE })
    ).toThrow();
  });
});
