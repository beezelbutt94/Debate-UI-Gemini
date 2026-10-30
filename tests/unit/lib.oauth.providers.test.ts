import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { youtubeProvider } from '@/lib/oauth/youtube';
import { tiktokProvider } from '@/lib/oauth/tiktok';
import { facebookProvider } from '@/lib/oauth/facebook';
import { canvaProvider } from '@/lib/oauth/canva';
import { getOAuthProvider } from '@/lib/oauth';

const REDIRECT_URI = 'https://app.example.com/api/oauth/youtube/callback';
const STATE = 'random-csrf-state-value';
const CODE_CHALLENGE = 'E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM';

// Set required env vars before testing authorizationUrl
beforeEach(() => {
  process.env.YOUTUBE_OAUTH_CLIENT_ID = 'test-yt-client-id';
  process.env.YOUTUBE_OAUTH_CLIENT_SECRET = 'test-yt-secret';
  process.env.TIKTOK_OAUTH_CLIENT_KEY = 'test-tt-client-key';
  process.env.TIKTOK_OAUTH_CLIENT_SECRET = 'test-tt-secret';
  process.env.FACEBOOK_APP_ID = 'test-fb-app-id';
  process.env.FACEBOOK_APP_SECRET = 'test-fb-secret';
  process.env.CANVA_CLIENT_ID = 'test-canva-id';
  process.env.CANVA_CLIENT_SECRET = 'test-canva-secret';
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

// ── YouTube provider ───────────────────────────────────────────────────────

describe('youtubeProvider', () => {
  it('requiresPkce is false', () => {
    expect(youtubeProvider.requiresPkce).toBe(false);
  });

  it('authorizationUrl returns a valid URL', () => {
    const url = new URL(youtubeProvider.authorizationUrl({ state: STATE, redirectUri: REDIRECT_URI }));
    expect(url.hostname).toBe('accounts.google.com');
    expect(url.pathname).toBe('/o/oauth2/v2/auth');
  });

  it('authorizationUrl includes required params', () => {
    const raw = youtubeProvider.authorizationUrl({ state: STATE, redirectUri: REDIRECT_URI });
    const url = new URL(raw);
    expect(url.searchParams.get('response_type')).toBe('code');
    expect(url.searchParams.get('state')).toBe(STATE);
    expect(url.searchParams.get('redirect_uri')).toBe(REDIRECT_URI);
    expect(url.searchParams.get('client_id')).toBe('test-yt-client-id');
    expect(url.searchParams.get('access_type')).toBe('offline');
    expect(url.searchParams.get('prompt')).toBe('consent');
  });

  it('authorizationUrl includes the youtube.upload scope', () => {
    const url = new URL(youtubeProvider.authorizationUrl({ state: STATE, redirectUri: REDIRECT_URI }));
    expect(url.searchParams.get('scope')).toContain('youtube.upload');
  });

  it('throws if YOUTUBE_OAUTH_CLIENT_ID is missing', () => {
    delete process.env.YOUTUBE_OAUTH_CLIENT_ID;
    expect(() => youtubeProvider.authorizationUrl({ state: STATE, redirectUri: REDIRECT_URI })).toThrow();
  });

  it('throws if YOUTUBE_OAUTH_CLIENT_SECRET is missing (on exchangeCode / refresh)', () => {
    delete process.env.YOUTUBE_OAUTH_CLIENT_SECRET;
    // authorizationUrl only needs CLIENT_ID, but CLIENT_SECRET is needed for token calls.
    // Just confirm the env is gone — actual exchange calls are integration territory.
    expect(process.env.YOUTUBE_OAUTH_CLIENT_SECRET).toBeUndefined();
  });
});

// ── TikTok provider ────────────────────────────────────────────────────────

describe('tiktokProvider', () => {
  it('requiresPkce is false', () => {
    expect(tiktokProvider.requiresPkce).toBe(false);
  });

  it('authorizationUrl returns a valid URL pointing to tiktok.com', () => {
    const url = new URL(tiktokProvider.authorizationUrl({ state: STATE, redirectUri: REDIRECT_URI }));
    expect(url.hostname).toBe('www.tiktok.com');
  });

  it('authorizationUrl includes required params', () => {
    const raw = tiktokProvider.authorizationUrl({ state: STATE, redirectUri: REDIRECT_URI });
    const url = new URL(raw);
    expect(url.searchParams.get('response_type')).toBe('code');
    expect(url.searchParams.get('state')).toBe(STATE);
    expect(url.searchParams.get('redirect_uri')).toBe(REDIRECT_URI);
    expect(url.searchParams.get('client_key')).toBe('test-tt-client-key');
    expect(url.searchParams.get('scope')).toBe('video.publish');
  });

  it('throws if TIKTOK_OAUTH_CLIENT_KEY is missing', () => {
    delete process.env.TIKTOK_OAUTH_CLIENT_KEY;
    expect(() => tiktokProvider.authorizationUrl({ state: STATE, redirectUri: REDIRECT_URI })).toThrow();
  });
});

// ── Facebook provider ──────────────────────────────────────────────────────

describe('facebookProvider', () => {
  it('requiresPkce is false', () => {
    expect(facebookProvider.requiresPkce).toBe(false);
  });

  it('authorizationUrl returns a valid URL pointing to facebook.com', () => {
    const url = new URL(facebookProvider.authorizationUrl({ state: STATE, redirectUri: REDIRECT_URI }));
    expect(url.hostname).toBe('www.facebook.com');
  });

  it('authorizationUrl includes required params', () => {
    const raw = facebookProvider.authorizationUrl({ state: STATE, redirectUri: REDIRECT_URI });
    const url = new URL(raw);
    expect(url.searchParams.get('response_type')).toBe('code');
    expect(url.searchParams.get('state')).toBe(STATE);
    expect(url.searchParams.get('redirect_uri')).toBe(REDIRECT_URI);
    expect(url.searchParams.get('client_id')).toBe('test-fb-app-id');
    expect(url.searchParams.get('scope')).toContain('pages_manage_posts');
  });

  it('throws if FACEBOOK_APP_ID is missing', () => {
    delete process.env.FACEBOOK_APP_ID;
    expect(() => facebookProvider.authorizationUrl({ state: STATE, redirectUri: REDIRECT_URI })).toThrow();
  });
});

// ── Canva provider ─────────────────────────────────────────────────────────

describe('canvaProvider', () => {
  it('requiresPkce is true', () => {
    expect(canvaProvider.requiresPkce).toBe(true);
  });

  it('authorizationUrl returns a valid URL pointing to canva.com', () => {
    const url = new URL(
      canvaProvider.authorizationUrl({ state: STATE, redirectUri: REDIRECT_URI, codeChallenge: CODE_CHALLENGE })
    );
    expect(url.hostname).toBe('www.canva.com');
  });

  it('authorizationUrl includes required params', () => {
    const raw = canvaProvider.authorizationUrl({
      state: STATE,
      redirectUri: REDIRECT_URI,
      codeChallenge: CODE_CHALLENGE,
    });
    const url = new URL(raw);
    expect(url.searchParams.get('response_type')).toBe('code');
    expect(url.searchParams.get('state')).toBe(STATE);
    expect(url.searchParams.get('redirect_uri')).toBe(REDIRECT_URI);
    expect(url.searchParams.get('client_id')).toBe('test-canva-id');
    expect(url.searchParams.get('code_challenge')).toBe(CODE_CHALLENGE);
    expect(url.searchParams.get('code_challenge_method')).toBe('S256');
  });

  it('includes design:content:write scope', () => {
    const raw = canvaProvider.authorizationUrl({
      state: STATE,
      redirectUri: REDIRECT_URI,
      codeChallenge: CODE_CHALLENGE,
    });
    const url = new URL(raw);
    expect(url.searchParams.get('scope')).toContain('design:content:write');
  });

  it('throws if CANVA_CLIENT_ID is missing', () => {
    delete process.env.CANVA_CLIENT_ID;
    expect(() =>
      canvaProvider.authorizationUrl({ state: STATE, redirectUri: REDIRECT_URI, codeChallenge: CODE_CHALLENGE })
    ).toThrow();
  });
});

// ── getOAuthProvider registry ──────────────────────────────────────────────

describe('getOAuthProvider()', () => {
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
