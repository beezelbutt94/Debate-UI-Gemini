import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { youtubeProvider } from '@/lib/oauth/youtube';
import { tiktokProvider } from '@/lib/oauth/tiktok';
import { facebookProvider } from '@/lib/oauth/facebook';
import { canvaProvider } from '@/lib/oauth/canva';

// ---- YouTube ----
describe('youtubeProvider.authorizationUrl', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = {
      ...originalEnv,
      YOUTUBE_OAUTH_CLIENT_ID: 'yt-client-id',
      YOUTUBE_OAUTH_CLIENT_SECRET: 'yt-client-secret',
    };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  function buildParams() {
    return { state: 'test-state', redirectUri: 'https://example.com/callback' };
  }

  it('returns a URL string', () => {
    const url = youtubeProvider.authorizationUrl(buildParams());
    expect(typeof url).toBe('string');
    expect(() => new URL(url)).not.toThrow();
  });

  it('points to Google OAuth2 endpoint', () => {
    const url = youtubeProvider.authorizationUrl(buildParams());
    expect(url).toContain('accounts.google.com');
  });

  it('includes response_type=code', () => {
    const url = new URL(youtubeProvider.authorizationUrl(buildParams()));
    expect(url.searchParams.get('response_type')).toBe('code');
  });

  it('includes access_type=offline', () => {
    const url = new URL(youtubeProvider.authorizationUrl(buildParams()));
    expect(url.searchParams.get('access_type')).toBe('offline');
  });

  it('includes prompt=consent', () => {
    const url = new URL(youtubeProvider.authorizationUrl(buildParams()));
    expect(url.searchParams.get('prompt')).toBe('consent');
  });

  it('includes state param', () => {
    const url = new URL(youtubeProvider.authorizationUrl(buildParams()));
    expect(url.searchParams.get('state')).toBe('test-state');
  });

  it('includes redirect_uri', () => {
    const url = new URL(youtubeProvider.authorizationUrl(buildParams()));
    expect(url.searchParams.get('redirect_uri')).toBe('https://example.com/callback');
  });

  it('includes YouTube upload scope', () => {
    const url = new URL(youtubeProvider.authorizationUrl(buildParams()));
    expect(url.searchParams.get('scope')).toContain('youtube.upload');
  });

  it('throws when YOUTUBE_OAUTH_CLIENT_ID is missing', () => {
    delete process.env.YOUTUBE_OAUTH_CLIENT_ID;
    expect(() => youtubeProvider.authorizationUrl(buildParams())).toThrow();
  });
});

// ---- TikTok ----
describe('tiktokProvider.authorizationUrl', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = {
      ...originalEnv,
      TIKTOK_OAUTH_CLIENT_KEY: 'tt-client-key',
      TIKTOK_OAUTH_CLIENT_SECRET: 'tt-client-secret',
    };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  function buildParams() {
    return { state: 'tt-state', redirectUri: 'https://example.com/callback/tiktok' };
  }

  it('returns a valid URL', () => {
    const url = tiktokProvider.authorizationUrl(buildParams());
    expect(() => new URL(url)).not.toThrow();
  });

  it('points to tiktok.com authorization endpoint', () => {
    const url = tiktokProvider.authorizationUrl(buildParams());
    expect(url).toContain('tiktok.com');
  });

  it('includes response_type=code', () => {
    const url = new URL(tiktokProvider.authorizationUrl(buildParams()));
    expect(url.searchParams.get('response_type')).toBe('code');
  });

  it('includes state param', () => {
    const url = new URL(tiktokProvider.authorizationUrl(buildParams()));
    expect(url.searchParams.get('state')).toBe('tt-state');
  });

  it('includes video.publish scope', () => {
    const url = new URL(tiktokProvider.authorizationUrl(buildParams()));
    expect(url.searchParams.get('scope')).toContain('video.publish');
  });

  it('includes redirect_uri', () => {
    const url = new URL(tiktokProvider.authorizationUrl(buildParams()));
    expect(url.searchParams.get('redirect_uri')).toBe('https://example.com/callback/tiktok');
  });

  it('throws when TIKTOK_OAUTH_CLIENT_KEY is missing', () => {
    delete process.env.TIKTOK_OAUTH_CLIENT_KEY;
    expect(() => tiktokProvider.authorizationUrl(buildParams())).toThrow();
  });
});

// ---- Facebook ----
describe('facebookProvider.authorizationUrl', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = {
      ...originalEnv,
      FACEBOOK_APP_ID: 'fb-app-id',
      FACEBOOK_APP_SECRET: 'fb-app-secret',
    };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  function buildParams() {
    return { state: 'fb-state', redirectUri: 'https://example.com/callback/facebook' };
  }

  it('returns a valid URL', () => {
    const url = facebookProvider.authorizationUrl(buildParams());
    expect(() => new URL(url)).not.toThrow();
  });

  it('points to facebook.com OAuth dialog', () => {
    const url = facebookProvider.authorizationUrl(buildParams());
    expect(url).toContain('facebook.com');
  });

  it('includes response_type=code', () => {
    const url = new URL(facebookProvider.authorizationUrl(buildParams()));
    expect(url.searchParams.get('response_type')).toBe('code');
  });

  it('includes state param', () => {
    const url = new URL(facebookProvider.authorizationUrl(buildParams()));
    expect(url.searchParams.get('state')).toBe('fb-state');
  });

  it('includes pages_show_list in scope', () => {
    const url = new URL(facebookProvider.authorizationUrl(buildParams()));
    const scope = url.searchParams.get('scope') ?? '';
    expect(scope).toContain('pages_show_list');
  });

  it('includes pages_manage_posts in scope', () => {
    const url = new URL(facebookProvider.authorizationUrl(buildParams()));
    const scope = url.searchParams.get('scope') ?? '';
    expect(scope).toContain('pages_manage_posts');
  });

  it('includes redirect_uri', () => {
    const url = new URL(facebookProvider.authorizationUrl(buildParams()));
    expect(url.searchParams.get('redirect_uri')).toBe('https://example.com/callback/facebook');
  });

  it('throws when FACEBOOK_APP_ID is missing', () => {
    delete process.env.FACEBOOK_APP_ID;
    expect(() => facebookProvider.authorizationUrl(buildParams())).toThrow();
  });
});

// ---- Canva ----
describe('canvaProvider.authorizationUrl', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = {
      ...originalEnv,
      CANVA_CLIENT_ID: 'canva-client-id',
      CANVA_CLIENT_SECRET: 'canva-client-secret',
    };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  function buildParams() {
    return {
      state: 'canva-state',
      redirectUri: 'https://example.com/callback/canva',
      codeChallenge: 'E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM',
    };
  }

  it('returns a valid URL', () => {
    const url = canvaProvider.authorizationUrl(buildParams());
    expect(() => new URL(url)).not.toThrow();
  });

  it('points to canva.com authorize endpoint', () => {
    const url = canvaProvider.authorizationUrl(buildParams());
    expect(url).toContain('canva.com');
  });

  it('includes response_type=code', () => {
    const url = new URL(canvaProvider.authorizationUrl(buildParams()));
    expect(url.searchParams.get('response_type')).toBe('code');
  });

  it('includes state param', () => {
    const url = new URL(canvaProvider.authorizationUrl(buildParams()));
    expect(url.searchParams.get('state')).toBe('canva-state');
  });

  it('includes code_challenge', () => {
    const url = new URL(canvaProvider.authorizationUrl(buildParams()));
    expect(url.searchParams.get('code_challenge')).toBe('E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM');
  });

  it('uses S256 code_challenge_method', () => {
    const url = new URL(canvaProvider.authorizationUrl(buildParams()));
    expect(url.searchParams.get('code_challenge_method')).toBe('S256');
  });

  it('includes design:content:write scope', () => {
    const url = new URL(canvaProvider.authorizationUrl(buildParams()));
    expect(url.searchParams.get('scope')).toContain('design:content:write');
  });

  it('includes profile:read scope', () => {
    const url = new URL(canvaProvider.authorizationUrl(buildParams()));
    expect(url.searchParams.get('scope')).toContain('profile:read');
  });

  it('throws when CANVA_CLIENT_ID is missing', () => {
    delete process.env.CANVA_CLIENT_ID;
    expect(() => canvaProvider.authorizationUrl(buildParams())).toThrow();
  });
});
