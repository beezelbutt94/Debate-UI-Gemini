import { describe, it, expect, vi, beforeEach } from 'vitest';
import { isOAuthPlatform } from '@/lib/oauth/types';
import { getOAuthProvider } from '@/lib/oauth';

// ── isOAuthPlatform ───────────────────────────────────────────────────────────

describe('isOAuthPlatform()', () => {
  it('returns true for "youtube"', () => expect(isOAuthPlatform('youtube')).toBe(true));
  it('returns true for "tiktok"', () => expect(isOAuthPlatform('tiktok')).toBe(true));
  it('returns true for "facebook"', () => expect(isOAuthPlatform('facebook')).toBe(true));
  it('returns true for "canva"', () => expect(isOAuthPlatform('canva')).toBe(true));
  it('returns false for "instagram"', () => expect(isOAuthPlatform('instagram')).toBe(false));
  it('returns false for empty string', () => expect(isOAuthPlatform('')).toBe(false));
  it('returns false for "YOUTUBE" (case-sensitive)', () => expect(isOAuthPlatform('YOUTUBE')).toBe(false));
  it('returns false for "google"', () => expect(isOAuthPlatform('google')).toBe(false));
  it('returns false for arbitrary string', () => expect(isOAuthPlatform('twitter')).toBe(false));
});

// ── getOAuthProvider ─────────────────────────────────────────────────────────

describe('getOAuthProvider()', () => {
  it('returns a provider object for youtube', () => {
    const p = getOAuthProvider('youtube');
    expect(p).toBeDefined();
    expect(typeof p.authorizationUrl).toBe('function');
  });

  it('returns a provider object for tiktok', () => {
    const p = getOAuthProvider('tiktok');
    expect(p).toBeDefined();
    expect(typeof p.authorizationUrl).toBe('function');
  });

  it('returns a provider object for facebook', () => {
    const p = getOAuthProvider('facebook');
    expect(p).toBeDefined();
    expect(typeof p.authorizationUrl).toBe('function');
  });

  it('returns a provider object for canva', () => {
    const p = getOAuthProvider('canva');
    expect(p).toBeDefined();
    expect(typeof p.authorizationUrl).toBe('function');
  });
});

// ── authorizationUrl() for each provider (pure URL-building, no HTTP) ────────

describe('YouTube provider.authorizationUrl()', () => {
  beforeEach(() => {
    process.env.YOUTUBE_OAUTH_CLIENT_ID = 'test-yt-client-id';
    process.env.YOUTUBE_OAUTH_CLIENT_SECRET = 'test-yt-secret';
  });

  it('returns a valid URL string', () => {
    const p = getOAuthProvider('youtube');
    const url = p.authorizationUrl({ state: 'st', redirectUri: 'https://app.example.com/callback' });
    expect(() => new URL(url)).not.toThrow();
  });

  it('uses accounts.google.com', () => {
    const p = getOAuthProvider('youtube');
    const url = p.authorizationUrl({ state: 'st', redirectUri: 'https://app.example.com/callback' });
    expect(new URL(url).hostname).toBe('accounts.google.com');
  });

  it('includes the client_id', () => {
    const p = getOAuthProvider('youtube');
    const url = new URL(p.authorizationUrl({ state: 'st', redirectUri: 'https://app.example.com/callback' }));
    expect(url.searchParams.get('client_id')).toBe('test-yt-client-id');
  });

  it('sets response_type=code', () => {
    const p = getOAuthProvider('youtube');
    const url = new URL(p.authorizationUrl({ state: 'st', redirectUri: 'https://app.example.com/callback' }));
    expect(url.searchParams.get('response_type')).toBe('code');
  });

  it('sets access_type=offline for refresh token', () => {
    const p = getOAuthProvider('youtube');
    const url = new URL(p.authorizationUrl({ state: 'st', redirectUri: 'https://app.example.com/callback' }));
    expect(url.searchParams.get('access_type')).toBe('offline');
  });

  it('sets prompt=consent', () => {
    const p = getOAuthProvider('youtube');
    const url = new URL(p.authorizationUrl({ state: 'st', redirectUri: 'https://app.example.com/callback' }));
    expect(url.searchParams.get('prompt')).toBe('consent');
  });

  it('includes the state parameter', () => {
    const p = getOAuthProvider('youtube');
    const url = new URL(p.authorizationUrl({ state: 'my-state-value', redirectUri: 'https://app.example.com/callback' }));
    expect(url.searchParams.get('state')).toBe('my-state-value');
  });

  it('includes the redirect_uri', () => {
    const p = getOAuthProvider('youtube');
    const url = new URL(p.authorizationUrl({ state: 'st', redirectUri: 'https://app.example.com/callback' }));
    expect(url.searchParams.get('redirect_uri')).toBe('https://app.example.com/callback');
  });

  it('does not require PKCE', () => {
    expect(getOAuthProvider('youtube').requiresPkce).toBe(false);
  });

  it('throws when YOUTUBE_OAUTH_CLIENT_ID is missing', () => {
    delete process.env.YOUTUBE_OAUTH_CLIENT_ID;
    const p = getOAuthProvider('youtube');
    expect(() => p.authorizationUrl({ state: 'st', redirectUri: 'https://app.example.com/callback' })).toThrow(
      /YOUTUBE_OAUTH_CLIENT_ID/
    );
  });
});

describe('TikTok provider.authorizationUrl()', () => {
  beforeEach(() => {
    process.env.TIKTOK_OAUTH_CLIENT_KEY = 'test-tt-client-key';
  });

  it('returns a valid URL string', () => {
    const p = getOAuthProvider('tiktok');
    const url = p.authorizationUrl({ state: 'st', redirectUri: 'https://app.example.com/callback' });
    expect(() => new URL(url)).not.toThrow();
  });

  it('uses tiktok.com authorization host', () => {
    const p = getOAuthProvider('tiktok');
    const url = new URL(p.authorizationUrl({ state: 'st', redirectUri: 'https://app.example.com/callback' }));
    expect(url.hostname).toContain('tiktok.com');
  });

  it('includes client_key', () => {
    const p = getOAuthProvider('tiktok');
    const url = new URL(p.authorizationUrl({ state: 'st', redirectUri: 'https://app.example.com/callback' }));
    expect(url.searchParams.get('client_key')).toBe('test-tt-client-key');
  });

  it('requests video.publish scope', () => {
    const p = getOAuthProvider('tiktok');
    const url = new URL(p.authorizationUrl({ state: 'st', redirectUri: 'https://app.example.com/callback' }));
    expect(url.searchParams.get('scope')).toContain('video.publish');
  });

  it('sets response_type=code', () => {
    const p = getOAuthProvider('tiktok');
    const url = new URL(p.authorizationUrl({ state: 'st', redirectUri: 'https://app.example.com/callback' }));
    expect(url.searchParams.get('response_type')).toBe('code');
  });

  it('includes the state parameter', () => {
    const p = getOAuthProvider('tiktok');
    const url = new URL(p.authorizationUrl({ state: 'unique-nonce', redirectUri: 'https://app.example.com/callback' }));
    expect(url.searchParams.get('state')).toBe('unique-nonce');
  });

  it('does not require PKCE', () => {
    expect(getOAuthProvider('tiktok').requiresPkce).toBe(false);
  });

  it('throws when TIKTOK_OAUTH_CLIENT_KEY is missing', () => {
    delete process.env.TIKTOK_OAUTH_CLIENT_KEY;
    const p = getOAuthProvider('tiktok');
    expect(() => p.authorizationUrl({ state: 'st', redirectUri: 'https://app.example.com/callback' })).toThrow(
      /TIKTOK_OAUTH_CLIENT_KEY/
    );
  });
});

describe('Facebook provider.authorizationUrl()', () => {
  beforeEach(() => {
    process.env.FACEBOOK_APP_ID = 'test-fb-app-id';
  });

  it('returns a valid URL string', () => {
    const p = getOAuthProvider('facebook');
    const url = p.authorizationUrl({ state: 'st', redirectUri: 'https://app.example.com/callback' });
    expect(() => new URL(url)).not.toThrow();
  });

  it('uses facebook.com dialog/oauth', () => {
    const p = getOAuthProvider('facebook');
    const url = new URL(p.authorizationUrl({ state: 'st', redirectUri: 'https://app.example.com/callback' }));
    expect(url.hostname).toContain('facebook.com');
    expect(url.pathname).toContain('dialog/oauth');
  });

  it('includes client_id', () => {
    const p = getOAuthProvider('facebook');
    const url = new URL(p.authorizationUrl({ state: 'st', redirectUri: 'https://app.example.com/callback' }));
    expect(url.searchParams.get('client_id')).toBe('test-fb-app-id');
  });

  it('requests page management scopes', () => {
    const p = getOAuthProvider('facebook');
    const url = new URL(p.authorizationUrl({ state: 'st', redirectUri: 'https://app.example.com/callback' }));
    const scope = url.searchParams.get('scope') ?? '';
    expect(scope).toContain('pages_show_list');
    expect(scope).toContain('pages_manage_posts');
  });

  it('sets response_type=code', () => {
    const p = getOAuthProvider('facebook');
    const url = new URL(p.authorizationUrl({ state: 'st', redirectUri: 'https://app.example.com/callback' }));
    expect(url.searchParams.get('response_type')).toBe('code');
  });

  it('includes the state', () => {
    const p = getOAuthProvider('facebook');
    const url = new URL(p.authorizationUrl({ state: 'fb-nonce', redirectUri: 'https://app.example.com/callback' }));
    expect(url.searchParams.get('state')).toBe('fb-nonce');
  });

  it('does not require PKCE', () => {
    expect(getOAuthProvider('facebook').requiresPkce).toBe(false);
  });

  it('throws when FACEBOOK_APP_ID is missing', () => {
    delete process.env.FACEBOOK_APP_ID;
    const p = getOAuthProvider('facebook');
    expect(() => p.authorizationUrl({ state: 'st', redirectUri: 'https://app.example.com/callback' })).toThrow(
      /FACEBOOK_APP_ID/
    );
  });
});

describe('Canva provider.authorizationUrl()', () => {
  beforeEach(() => {
    process.env.CANVA_CLIENT_ID = 'test-canva-client-id';
  });

  it('returns a valid URL string', () => {
    const p = getOAuthProvider('canva');
    const url = p.authorizationUrl({ state: 'st', redirectUri: 'https://app.example.com/callback', codeChallenge: 'challenge' });
    expect(() => new URL(url)).not.toThrow();
  });

  it('uses canva.com authorize endpoint', () => {
    const p = getOAuthProvider('canva');
    const url = new URL(p.authorizationUrl({ state: 'st', redirectUri: 'https://app.example.com/callback', codeChallenge: 'challenge' }));
    expect(url.hostname).toContain('canva.com');
    expect(url.pathname).toContain('authorize');
  });

  it('includes client_id', () => {
    const p = getOAuthProvider('canva');
    const url = new URL(p.authorizationUrl({ state: 'st', redirectUri: 'https://app.example.com/callback', codeChallenge: 'ch' }));
    expect(url.searchParams.get('client_id')).toBe('test-canva-client-id');
  });

  it('sets code_challenge_method=S256', () => {
    const p = getOAuthProvider('canva');
    const url = new URL(p.authorizationUrl({ state: 'st', redirectUri: 'https://app.example.com/callback', codeChallenge: 'ch' }));
    expect(url.searchParams.get('code_challenge_method')).toBe('S256');
  });

  it('includes the code_challenge', () => {
    const p = getOAuthProvider('canva');
    const url = new URL(p.authorizationUrl({ state: 'st', redirectUri: 'https://app.example.com/callback', codeChallenge: 'my-challenge' }));
    expect(url.searchParams.get('code_challenge')).toBe('my-challenge');
  });

  it('includes the state', () => {
    const p = getOAuthProvider('canva');
    const url = new URL(p.authorizationUrl({ state: 'canva-nonce', redirectUri: 'https://app.example.com/callback', codeChallenge: 'ch' }));
    expect(url.searchParams.get('state')).toBe('canva-nonce');
  });

  it('requires PKCE', () => {
    expect(getOAuthProvider('canva').requiresPkce).toBe(true);
  });

  it('requests required scopes', () => {
    const p = getOAuthProvider('canva');
    const url = new URL(p.authorizationUrl({ state: 'st', redirectUri: 'https://app.example.com/callback', codeChallenge: 'ch' }));
    const scope = url.searchParams.get('scope') ?? '';
    expect(scope).toContain('design:content:write');
    expect(scope).toContain('profile:read');
  });

  it('throws when CANVA_CLIENT_ID is missing', () => {
    delete process.env.CANVA_CLIENT_ID;
    const p = getOAuthProvider('canva');
    expect(() => p.authorizationUrl({ state: 'st', redirectUri: 'https://app.example.com/callback', codeChallenge: 'ch' })).toThrow(
      /CANVA_CLIENT_ID/
    );
  });
});
