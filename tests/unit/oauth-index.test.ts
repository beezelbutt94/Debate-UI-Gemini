import { describe, it, expect } from 'vitest';
import { getOAuthProvider } from '@/lib/oauth/index';

describe('getOAuthProvider()', () => {
  it('returns an object for "youtube"', () => {
    expect(getOAuthProvider('youtube')).toBeDefined();
  });

  it('returns an object for "tiktok"', () => {
    expect(getOAuthProvider('tiktok')).toBeDefined();
  });

  it('returns an object for "facebook"', () => {
    expect(getOAuthProvider('facebook')).toBeDefined();
  });

  it('returns an object for "canva"', () => {
    expect(getOAuthProvider('canva')).toBeDefined();
  });

  it('returns a provider with an authorizationUrl function', () => {
    expect(typeof getOAuthProvider('youtube').authorizationUrl).toBe('function');
  });

  it('returns a provider with an exchangeCode function', () => {
    expect(typeof getOAuthProvider('tiktok').exchangeCode).toBe('function');
  });

  it('returns a provider with a refreshAccessToken function', () => {
    expect(typeof getOAuthProvider('facebook').refreshAccessToken).toBe('function');
  });

  it('youtube provider does NOT require PKCE', () => {
    expect(getOAuthProvider('youtube').requiresPkce).toBe(false);
  });

  it('tiktok provider does NOT require PKCE', () => {
    expect(getOAuthProvider('tiktok').requiresPkce).toBe(false);
  });

  it('facebook provider does NOT require PKCE', () => {
    expect(getOAuthProvider('facebook').requiresPkce).toBe(false);
  });

  it('canva provider DOES require PKCE', () => {
    expect(getOAuthProvider('canva').requiresPkce).toBe(true);
  });

  it('returns the same instance on repeated calls (providers are singletons)', () => {
    expect(getOAuthProvider('youtube')).toBe(getOAuthProvider('youtube'));
  });
});

// ─── Provider authorizationUrl shape tests ────────────────────────────────────
// These only need the env vars present — we stub them so the functions run
// without throwing "not configured".

const params = { state: 'test-state', redirectUri: 'https://app.example.com/callback' };

describe('youtubeProvider.authorizationUrl()', () => {
  it('builds a valid URL with the expected host', () => {
    process.env.YOUTUBE_OAUTH_CLIENT_ID = 'fake-yt-client-id';
    const url = new URL(getOAuthProvider('youtube').authorizationUrl(params));
    expect(url.hostname).toBe('accounts.google.com');
    delete process.env.YOUTUBE_OAUTH_CLIENT_ID;
  });

  it('sets response_type=code', () => {
    process.env.YOUTUBE_OAUTH_CLIENT_ID = 'fake-yt-client-id';
    const url = new URL(getOAuthProvider('youtube').authorizationUrl(params));
    expect(url.searchParams.get('response_type')).toBe('code');
    delete process.env.YOUTUBE_OAUTH_CLIENT_ID;
  });

  it('sets access_type=offline to get a refresh token', () => {
    process.env.YOUTUBE_OAUTH_CLIENT_ID = 'fake-yt-client-id';
    const url = new URL(getOAuthProvider('youtube').authorizationUrl(params));
    expect(url.searchParams.get('access_type')).toBe('offline');
    delete process.env.YOUTUBE_OAUTH_CLIENT_ID;
  });

  it('includes the state parameter', () => {
    process.env.YOUTUBE_OAUTH_CLIENT_ID = 'fake-yt-client-id';
    const url = new URL(getOAuthProvider('youtube').authorizationUrl(params));
    expect(url.searchParams.get('state')).toBe('test-state');
    delete process.env.YOUTUBE_OAUTH_CLIENT_ID;
  });

  it('includes the redirect_uri', () => {
    process.env.YOUTUBE_OAUTH_CLIENT_ID = 'fake-yt-client-id';
    const url = new URL(getOAuthProvider('youtube').authorizationUrl(params));
    expect(url.searchParams.get('redirect_uri')).toBe('https://app.example.com/callback');
    delete process.env.YOUTUBE_OAUTH_CLIENT_ID;
  });

  it('throws when YOUTUBE_OAUTH_CLIENT_ID is missing', () => {
    delete process.env.YOUTUBE_OAUTH_CLIENT_ID;
    expect(() => getOAuthProvider('youtube').authorizationUrl(params)).toThrow('YOUTUBE_OAUTH_CLIENT_ID');
  });
});

describe('tiktokProvider.authorizationUrl()', () => {
  it('builds a URL pointing to tiktok.com', () => {
    process.env.TIKTOK_OAUTH_CLIENT_KEY = 'fake-tiktok-key';
    const url = new URL(getOAuthProvider('tiktok').authorizationUrl(params));
    expect(url.hostname).toBe('www.tiktok.com');
    delete process.env.TIKTOK_OAUTH_CLIENT_KEY;
  });

  it('sets response_type=code', () => {
    process.env.TIKTOK_OAUTH_CLIENT_KEY = 'fake-tiktok-key';
    const url = new URL(getOAuthProvider('tiktok').authorizationUrl(params));
    expect(url.searchParams.get('response_type')).toBe('code');
    delete process.env.TIKTOK_OAUTH_CLIENT_KEY;
  });

  it('includes the state parameter', () => {
    process.env.TIKTOK_OAUTH_CLIENT_KEY = 'fake-tiktok-key';
    const url = new URL(getOAuthProvider('tiktok').authorizationUrl(params));
    expect(url.searchParams.get('state')).toBe('test-state');
    delete process.env.TIKTOK_OAUTH_CLIENT_KEY;
  });

  it('throws when TIKTOK_OAUTH_CLIENT_KEY is missing', () => {
    delete process.env.TIKTOK_OAUTH_CLIENT_KEY;
    expect(() => getOAuthProvider('tiktok').authorizationUrl(params)).toThrow('TIKTOK_OAUTH_CLIENT_KEY');
  });
});

describe('facebookProvider.authorizationUrl()', () => {
  it('builds a URL pointing to facebook.com', () => {
    process.env.FACEBOOK_APP_ID = 'fake-fb-app-id';
    const url = new URL(getOAuthProvider('facebook').authorizationUrl(params));
    expect(url.hostname).toBe('www.facebook.com');
    delete process.env.FACEBOOK_APP_ID;
  });

  it('includes the state parameter', () => {
    process.env.FACEBOOK_APP_ID = 'fake-fb-app-id';
    const url = new URL(getOAuthProvider('facebook').authorizationUrl(params));
    expect(url.searchParams.get('state')).toBe('test-state');
    delete process.env.FACEBOOK_APP_ID;
  });

  it('requests page-level scopes', () => {
    process.env.FACEBOOK_APP_ID = 'fake-fb-app-id';
    const url = new URL(getOAuthProvider('facebook').authorizationUrl(params));
    const scope = url.searchParams.get('scope') ?? '';
    expect(scope).toContain('pages_manage_posts');
    delete process.env.FACEBOOK_APP_ID;
  });

  it('throws when FACEBOOK_APP_ID is missing', () => {
    delete process.env.FACEBOOK_APP_ID;
    expect(() => getOAuthProvider('facebook').authorizationUrl(params)).toThrow('FACEBOOK_APP_ID');
  });
});

describe('canvaProvider.authorizationUrl()', () => {
  it('builds a URL pointing to canva.com', () => {
    process.env.CANVA_CLIENT_ID = 'fake-canva-id';
    const url = new URL(getOAuthProvider('canva').authorizationUrl({ ...params, codeChallenge: 'challenge123' }));
    expect(url.hostname).toBe('www.canva.com');
    delete process.env.CANVA_CLIENT_ID;
  });

  it('sets code_challenge_method=S256', () => {
    process.env.CANVA_CLIENT_ID = 'fake-canva-id';
    const url = new URL(getOAuthProvider('canva').authorizationUrl({ ...params, codeChallenge: 'challenge123' }));
    expect(url.searchParams.get('code_challenge_method')).toBe('S256');
    delete process.env.CANVA_CLIENT_ID;
  });

  it('passes code_challenge through', () => {
    process.env.CANVA_CLIENT_ID = 'fake-canva-id';
    const url = new URL(getOAuthProvider('canva').authorizationUrl({ ...params, codeChallenge: 'challenge123' }));
    expect(url.searchParams.get('code_challenge')).toBe('challenge123');
    delete process.env.CANVA_CLIENT_ID;
  });

  it('throws when CANVA_CLIENT_ID is missing', () => {
    delete process.env.CANVA_CLIENT_ID;
    expect(() => getOAuthProvider('canva').authorizationUrl({ ...params, codeChallenge: 'c' })).toThrow('CANVA_CLIENT_ID');
  });
});
