import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { youtubeProvider } from '@/lib/oauth/youtube';
import { tiktokProvider } from '@/lib/oauth/tiktok';
import { facebookProvider } from '@/lib/oauth/facebook';
import { canvaProvider } from '@/lib/oauth/canva';

// Set all required env vars before tests that call authorizationUrl
const ENV = {
  YOUTUBE_OAUTH_CLIENT_ID: 'yt-client-id',
  YOUTUBE_OAUTH_CLIENT_SECRET: 'yt-secret',
  TIKTOK_OAUTH_CLIENT_KEY: 'tt-key',
  TIKTOK_OAUTH_CLIENT_SECRET: 'tt-secret',
  FACEBOOK_APP_ID: 'fb-app-id',
  FACEBOOK_APP_SECRET: 'fb-secret',
  CANVA_CLIENT_ID: 'canva-id',
  CANVA_CLIENT_SECRET: 'canva-secret',
};

beforeEach(() => {
  for (const [key, val] of Object.entries(ENV)) {
    process.env[key] = val;
  }
});

afterEach(() => {
  for (const key of Object.keys(ENV)) {
    delete process.env[key];
  }
  vi.restoreAllMocks();
});

// ─── YouTube provider ─────────────────────────────────────────────────────────

describe('youtubeProvider.authorizationUrl', () => {
  const params = { state: 'csrf-abc', redirectUri: 'https://app.example.com/callback' };

  it('returns a valid URL string', () => {
    expect(() => new URL(youtubeProvider.authorizationUrl(params))).not.toThrow();
  });

  it('targets the Google OAuth2 authorize endpoint', () => {
    const url = new URL(youtubeProvider.authorizationUrl(params));
    expect(url.hostname).toBe('accounts.google.com');
    expect(url.pathname).toBe('/o/oauth2/v2/auth');
  });

  it('sets client_id from env', () => {
    const url = new URL(youtubeProvider.authorizationUrl(params));
    expect(url.searchParams.get('client_id')).toBe('yt-client-id');
  });

  it('sets state parameter', () => {
    const url = new URL(youtubeProvider.authorizationUrl(params));
    expect(url.searchParams.get('state')).toBe('csrf-abc');
  });

  it('sets redirect_uri parameter', () => {
    const url = new URL(youtubeProvider.authorizationUrl(params));
    expect(url.searchParams.get('redirect_uri')).toBe('https://app.example.com/callback');
  });

  it('requests offline access (for refresh token)', () => {
    const url = new URL(youtubeProvider.authorizationUrl(params));
    expect(url.searchParams.get('access_type')).toBe('offline');
  });

  it('forces consent prompt (to always get refresh token)', () => {
    const url = new URL(youtubeProvider.authorizationUrl(params));
    expect(url.searchParams.get('prompt')).toBe('consent');
  });

  it('includes the YouTube upload scope', () => {
    const url = new URL(youtubeProvider.authorizationUrl(params));
    expect(url.searchParams.get('scope')).toContain('youtube.upload');
  });

  it('sets response_type to code', () => {
    const url = new URL(youtubeProvider.authorizationUrl(params));
    expect(url.searchParams.get('response_type')).toBe('code');
  });

  it('throws when YOUTUBE_OAUTH_CLIENT_ID is missing', () => {
    delete process.env.YOUTUBE_OAUTH_CLIENT_ID;
    expect(() => youtubeProvider.authorizationUrl(params)).toThrow('YOUTUBE_OAUTH_CLIENT_ID');
  });
});

// ─── TikTok provider ──────────────────────────────────────────────────────────

describe('tiktokProvider.authorizationUrl', () => {
  const params = { state: 'csrf-tt', redirectUri: 'https://app.example.com/tt-callback' };

  it('returns a valid URL', () => {
    expect(() => new URL(tiktokProvider.authorizationUrl(params))).not.toThrow();
  });

  it('targets the TikTok v2 authorize endpoint', () => {
    const url = new URL(tiktokProvider.authorizationUrl(params));
    expect(url.hostname).toBe('www.tiktok.com');
    expect(url.pathname).toContain('/v2/auth/authorize');
  });

  it('sets client_key from env', () => {
    const url = new URL(tiktokProvider.authorizationUrl(params));
    expect(url.searchParams.get('client_key')).toBe('tt-key');
  });

  it('sets state parameter', () => {
    const url = new URL(tiktokProvider.authorizationUrl(params));
    expect(url.searchParams.get('state')).toBe('csrf-tt');
  });

  it('requests video.publish scope', () => {
    const url = new URL(tiktokProvider.authorizationUrl(params));
    expect(url.searchParams.get('scope')).toContain('video.publish');
  });

  it('sets response_type to code', () => {
    const url = new URL(tiktokProvider.authorizationUrl(params));
    expect(url.searchParams.get('response_type')).toBe('code');
  });

  it('throws when TIKTOK_OAUTH_CLIENT_KEY is missing', () => {
    delete process.env.TIKTOK_OAUTH_CLIENT_KEY;
    expect(() => tiktokProvider.authorizationUrl(params)).toThrow('TIKTOK_OAUTH_CLIENT_KEY');
  });
});

// ─── Facebook provider ────────────────────────────────────────────────────────

describe('facebookProvider.authorizationUrl', () => {
  const params = { state: 'csrf-fb', redirectUri: 'https://app.example.com/fb-callback' };

  it('returns a valid URL', () => {
    expect(() => new URL(facebookProvider.authorizationUrl(params))).not.toThrow();
  });

  it('targets the Facebook OAuth dialog endpoint', () => {
    const url = new URL(facebookProvider.authorizationUrl(params));
    expect(url.hostname).toBe('www.facebook.com');
    expect(url.pathname).toContain('dialog/oauth');
  });

  it('sets client_id from env', () => {
    const url = new URL(facebookProvider.authorizationUrl(params));
    expect(url.searchParams.get('client_id')).toBe('fb-app-id');
  });

  it('sets state parameter', () => {
    const url = new URL(facebookProvider.authorizationUrl(params));
    expect(url.searchParams.get('state')).toBe('csrf-fb');
  });

  it('requests page-related scopes', () => {
    const url = new URL(facebookProvider.authorizationUrl(params));
    const scope = url.searchParams.get('scope') ?? '';
    expect(scope).toContain('pages_show_list');
    expect(scope).toContain('pages_manage_posts');
  });

  it('throws when FACEBOOK_APP_ID is missing', () => {
    delete process.env.FACEBOOK_APP_ID;
    expect(() => facebookProvider.authorizationUrl(params)).toThrow('FACEBOOK_APP_ID');
  });
});

// ─── Canva provider ───────────────────────────────────────────────────────────

describe('canvaProvider.authorizationUrl', () => {
  const params = {
    state: 'csrf-canva',
    redirectUri: 'https://app.example.com/canva-callback',
    codeChallenge: 'challenge-abc',
  };

  it('returns a valid URL', () => {
    expect(() => new URL(canvaProvider.authorizationUrl(params))).not.toThrow();
  });

  it('targets the Canva OAuth authorize endpoint', () => {
    const url = new URL(canvaProvider.authorizationUrl(params));
    expect(url.hostname).toBe('www.canva.com');
    expect(url.pathname).toContain('oauth/authorize');
  });

  it('sets client_id from env', () => {
    const url = new URL(canvaProvider.authorizationUrl(params));
    expect(url.searchParams.get('client_id')).toBe('canva-id');
  });

  it('sets state parameter', () => {
    const url = new URL(canvaProvider.authorizationUrl(params));
    expect(url.searchParams.get('state')).toBe('csrf-canva');
  });

  it('sets code_challenge', () => {
    const url = new URL(canvaProvider.authorizationUrl(params));
    expect(url.searchParams.get('code_challenge')).toBe('challenge-abc');
  });

  it('sets code_challenge_method to S256', () => {
    const url = new URL(canvaProvider.authorizationUrl(params));
    expect(url.searchParams.get('code_challenge_method')).toBe('S256');
  });

  it('requests design and profile scopes', () => {
    const url = new URL(canvaProvider.authorizationUrl(params));
    const scope = url.searchParams.get('scope') ?? '';
    expect(scope).toContain('design:content:write');
    expect(scope).toContain('profile:read');
  });

  it('requiresPkce is true', () => {
    expect(canvaProvider.requiresPkce).toBe(true);
  });

  it('throws when CANVA_CLIENT_ID is missing', () => {
    delete process.env.CANVA_CLIENT_ID;
    expect(() => canvaProvider.authorizationUrl(params)).toThrow('CANVA_CLIENT_ID');
  });
});
