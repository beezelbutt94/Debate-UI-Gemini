import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { getOAuthProvider } from '@/lib/oauth';
import type { OAuthPlatform } from '@/lib/oauth/types';

const PLATFORMS: OAuthPlatform[] = ['youtube', 'tiktok', 'facebook', 'canva'];

describe('getOAuthProvider()', () => {
  it.each(PLATFORMS)('returns a provider for "%s"', (platform) => {
    const provider = getOAuthProvider(platform);
    expect(provider).toBeDefined();
  });

  it.each(PLATFORMS)('%s provider has an authorizationUrl function', (platform) => {
    const provider = getOAuthProvider(platform);
    expect(typeof provider.authorizationUrl).toBe('function');
  });

  it.each(PLATFORMS)('%s provider has an exchangeCode function', (platform) => {
    const provider = getOAuthProvider(platform);
    expect(typeof provider.exchangeCode).toBe('function');
  });

  it.each(PLATFORMS)('%s provider has a refreshAccessToken function', (platform) => {
    const provider = getOAuthProvider(platform);
    expect(typeof provider.refreshAccessToken).toBe('function');
  });

  it.each(PLATFORMS)('%s provider has requiresPkce boolean', (platform) => {
    const provider = getOAuthProvider(platform);
    expect(typeof provider.requiresPkce).toBe('boolean');
  });

  it('only canva requires PKCE', () => {
    expect(getOAuthProvider('canva').requiresPkce).toBe(true);
    expect(getOAuthProvider('youtube').requiresPkce).toBe(false);
    expect(getOAuthProvider('tiktok').requiresPkce).toBe(false);
    expect(getOAuthProvider('facebook').requiresPkce).toBe(false);
  });

  it('returns different provider objects for different platforms', () => {
    const y = getOAuthProvider('youtube');
    const t = getOAuthProvider('tiktok');
    expect(y).not.toBe(t);
  });

  it('returns the same object on repeated calls for the same platform', () => {
    const a = getOAuthProvider('youtube');
    const b = getOAuthProvider('youtube');
    expect(a).toBe(b);
  });
});

// ─── youtube authorizationUrl (no network, just URL construction) ─────────────

describe('youtubeProvider.authorizationUrl()', () => {
  beforeAll(() => {
    process.env.YOUTUBE_OAUTH_CLIENT_ID = 'test-client-id';
  });

  afterAll(() => {
    delete process.env.YOUTUBE_OAUTH_CLIENT_ID;
  });

  it('builds a valid Google OAuth URL', () => {
    const provider = getOAuthProvider('youtube');
    const url = provider.authorizationUrl({ state: 'abc', redirectUri: 'https://app.example.com/callback' });
    expect(() => new URL(url)).not.toThrow();
    expect(url).toContain('accounts.google.com');
  });

  it('includes state parameter', () => {
    const provider = getOAuthProvider('youtube');
    const url = provider.authorizationUrl({ state: 'my-state', redirectUri: 'https://app.example.com/callback' });
    const parsed = new URL(url);
    expect(parsed.searchParams.get('state')).toBe('my-state');
  });

  it('includes redirect_uri', () => {
    const provider = getOAuthProvider('youtube');
    const redirectUri = 'https://app.example.com/callback';
    const url = provider.authorizationUrl({ state: 'x', redirectUri });
    const parsed = new URL(url);
    expect(parsed.searchParams.get('redirect_uri')).toBe(redirectUri);
  });

  it('sets access_type=offline', () => {
    const provider = getOAuthProvider('youtube');
    const url = provider.authorizationUrl({ state: 'x', redirectUri: 'https://app.example.com/c' });
    expect(new URL(url).searchParams.get('access_type')).toBe('offline');
  });

  it('sets prompt=consent', () => {
    const provider = getOAuthProvider('youtube');
    const url = provider.authorizationUrl({ state: 'x', redirectUri: 'https://app.example.com/c' });
    expect(new URL(url).searchParams.get('prompt')).toBe('consent');
  });
});

// ─── tiktok authorizationUrl ──────────────────────────────────────────────────

describe('tiktokProvider.authorizationUrl()', () => {
  beforeAll(() => {
    process.env.TIKTOK_OAUTH_CLIENT_KEY = 'test-tiktok-key';
  });
  afterAll(() => {
    delete process.env.TIKTOK_OAUTH_CLIENT_KEY;
  });

  it('builds a valid TikTok authorize URL', () => {
    const provider = getOAuthProvider('tiktok');
    const url = provider.authorizationUrl({ state: 'st', redirectUri: 'https://app.example.com/cb' });
    expect(() => new URL(url)).not.toThrow();
    expect(url).toContain('tiktok.com');
  });

  it('includes state', () => {
    const provider = getOAuthProvider('tiktok');
    const url = provider.authorizationUrl({ state: 'my-state', redirectUri: 'https://x.com/cb' });
    expect(new URL(url).searchParams.get('state')).toBe('my-state');
  });

  it('includes video.publish in scope', () => {
    const provider = getOAuthProvider('tiktok');
    const url = provider.authorizationUrl({ state: 'x', redirectUri: 'https://x.com/cb' });
    expect(new URL(url).searchParams.get('scope')).toContain('video.publish');
  });
});

// ─── facebook authorizationUrl ────────────────────────────────────────────────

describe('facebookProvider.authorizationUrl()', () => {
  beforeAll(() => {
    process.env.FACEBOOK_APP_ID = 'test-fb-id';
  });
  afterAll(() => {
    delete process.env.FACEBOOK_APP_ID;
  });

  it('builds a valid Facebook OAuth URL', () => {
    const provider = getOAuthProvider('facebook');
    const url = provider.authorizationUrl({ state: 's', redirectUri: 'https://app.example.com/cb' });
    expect(() => new URL(url)).not.toThrow();
    expect(url).toContain('facebook.com');
  });

  it('includes state', () => {
    const provider = getOAuthProvider('facebook');
    const url = provider.authorizationUrl({ state: 'fb-state', redirectUri: 'https://x.com/cb' });
    expect(new URL(url).searchParams.get('state')).toBe('fb-state');
  });

  it('scope includes pages_manage_posts', () => {
    const provider = getOAuthProvider('facebook');
    const url = provider.authorizationUrl({ state: 'x', redirectUri: 'https://x.com/cb' });
    expect(new URL(url).searchParams.get('scope')).toContain('pages_manage_posts');
  });
});

// ─── canva authorizationUrl ───────────────────────────────────────────────────

describe('canvaProvider.authorizationUrl()', () => {
  beforeAll(() => {
    process.env.CANVA_CLIENT_ID = 'test-canva-id';
  });
  afterAll(() => {
    delete process.env.CANVA_CLIENT_ID;
  });

  it('builds a valid Canva OAuth URL', () => {
    const provider = getOAuthProvider('canva');
    const url = provider.authorizationUrl({ state: 's', redirectUri: 'https://app.example.com/cb', codeChallenge: 'mychallenge' });
    expect(() => new URL(url)).not.toThrow();
    expect(url).toContain('canva.com');
  });

  it('includes the code_challenge', () => {
    const provider = getOAuthProvider('canva');
    const url = provider.authorizationUrl({ state: 'x', redirectUri: 'https://x.com/cb', codeChallenge: 'mychallenge123' });
    expect(new URL(url).searchParams.get('code_challenge')).toBe('mychallenge123');
  });

  it('uses code_challenge_method=S256', () => {
    const provider = getOAuthProvider('canva');
    const url = provider.authorizationUrl({ state: 'x', redirectUri: 'https://x.com/cb', codeChallenge: 'c' });
    expect(new URL(url).searchParams.get('code_challenge_method')).toBe('S256');
  });

  it('includes state', () => {
    const provider = getOAuthProvider('canva');
    const url = provider.authorizationUrl({ state: 'canva-state', redirectUri: 'https://x.com/cb', codeChallenge: 'c' });
    expect(new URL(url).searchParams.get('state')).toBe('canva-state');
  });
});
