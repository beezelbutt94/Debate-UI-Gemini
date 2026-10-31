import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { getOAuthProvider } from '@/lib/oauth';

// authorizationUrl() is pure URL construction — testable without real env
// vars by mocking process.env. exchangeCode() and refreshAccessToken() make
// network calls, so those are integration concerns excluded here.

const FAKE_ENV: Record<string, string> = {
  YOUTUBE_OAUTH_CLIENT_ID: 'yt-client-id',
  YOUTUBE_OAUTH_CLIENT_SECRET: 'yt-secret',
  TIKTOK_OAUTH_CLIENT_KEY: 'tt-client-key',
  TIKTOK_OAUTH_CLIENT_SECRET: 'tt-secret',
  FACEBOOK_APP_ID: 'fb-app-id',
  FACEBOOK_APP_SECRET: 'fb-secret',
  CANVA_CLIENT_ID: 'canva-id',
  CANVA_CLIENT_SECRET: 'canva-secret',
};

let origEnv: Record<string, string | undefined>;
beforeEach(() => {
  origEnv = {};
  for (const key of Object.keys(FAKE_ENV)) {
    origEnv[key] = process.env[key];
    process.env[key] = FAKE_ENV[key];
  }
});
afterEach(() => {
  for (const [key, val] of Object.entries(origEnv)) {
    if (val === undefined) delete process.env[key];
    else process.env[key] = val;
  }
});

// ── YouTube ─────────────────────────────────────────────────────────────────
describe('youtubeProvider', () => {
  const provider = getOAuthProvider('youtube');
  const PARAMS = { state: 'test-state', redirectUri: 'https://example.com/callback' };

  it('requiresPkce is false', () => {
    expect(provider.requiresPkce).toBe(false);
  });

  it('authorizationUrl returns a valid URL', () => {
    const url = new URL(provider.authorizationUrl(PARAMS));
    expect(url.hostname).toBe('accounts.google.com');
  });

  it('includes response_type=code', () => {
    const url = new URL(provider.authorizationUrl(PARAMS));
    expect(url.searchParams.get('response_type')).toBe('code');
  });

  it('includes access_type=offline', () => {
    const url = new URL(provider.authorizationUrl(PARAMS));
    expect(url.searchParams.get('access_type')).toBe('offline');
  });

  it('includes prompt=consent', () => {
    const url = new URL(provider.authorizationUrl(PARAMS));
    expect(url.searchParams.get('prompt')).toBe('consent');
  });

  it('includes the correct state', () => {
    const url = new URL(provider.authorizationUrl(PARAMS));
    expect(url.searchParams.get('state')).toBe('test-state');
  });

  it('includes the redirect_uri', () => {
    const url = new URL(provider.authorizationUrl(PARAMS));
    expect(url.searchParams.get('redirect_uri')).toBe('https://example.com/callback');
  });

  it('includes the client_id from env', () => {
    const url = new URL(provider.authorizationUrl(PARAMS));
    expect(url.searchParams.get('client_id')).toBe('yt-client-id');
  });

  it('includes youtube.upload scope', () => {
    const url = new URL(provider.authorizationUrl(PARAMS));
    expect(url.searchParams.get('scope')).toContain('youtube.upload');
  });

  it('throws when YOUTUBE_OAUTH_CLIENT_ID is missing', () => {
    delete process.env.YOUTUBE_OAUTH_CLIENT_ID;
    expect(() => provider.authorizationUrl(PARAMS)).toThrow('YOUTUBE_OAUTH_CLIENT_ID');
  });
});

// ── TikTok ──────────────────────────────────────────────────────────────────
describe('tiktokProvider', () => {
  const provider = getOAuthProvider('tiktok');
  const PARAMS = { state: 'tt-state', redirectUri: 'https://example.com/tt/callback' };

  it('requiresPkce is false', () => {
    expect(provider.requiresPkce).toBe(false);
  });

  it('authorizationUrl returns a valid URL pointing to tiktok.com', () => {
    const url = new URL(provider.authorizationUrl(PARAMS));
    expect(url.hostname).toBe('www.tiktok.com');
  });

  it('includes response_type=code', () => {
    const url = new URL(provider.authorizationUrl(PARAMS));
    expect(url.searchParams.get('response_type')).toBe('code');
  });

  it('includes scope=video.publish', () => {
    const url = new URL(provider.authorizationUrl(PARAMS));
    expect(url.searchParams.get('scope')).toBe('video.publish');
  });

  it('includes the correct state', () => {
    const url = new URL(provider.authorizationUrl(PARAMS));
    expect(url.searchParams.get('state')).toBe('tt-state');
  });

  it('includes client_key from env', () => {
    const url = new URL(provider.authorizationUrl(PARAMS));
    expect(url.searchParams.get('client_key')).toBe('tt-client-key');
  });

  it('includes the redirect_uri', () => {
    const url = new URL(provider.authorizationUrl(PARAMS));
    expect(url.searchParams.get('redirect_uri')).toBe('https://example.com/tt/callback');
  });

  it('throws when TIKTOK_OAUTH_CLIENT_KEY is missing', () => {
    delete process.env.TIKTOK_OAUTH_CLIENT_KEY;
    expect(() => provider.authorizationUrl(PARAMS)).toThrow('TIKTOK_OAUTH_CLIENT_KEY');
  });
});

// ── Facebook ────────────────────────────────────────────────────────────────
describe('facebookProvider', () => {
  const provider = getOAuthProvider('facebook');
  const PARAMS = { state: 'fb-state', redirectUri: 'https://example.com/fb/callback' };

  it('requiresPkce is false', () => {
    expect(provider.requiresPkce).toBe(false);
  });

  it('authorizationUrl returns a valid URL pointing to facebook.com', () => {
    const url = new URL(provider.authorizationUrl(PARAMS));
    expect(url.hostname).toBe('www.facebook.com');
  });

  it('includes response_type=code', () => {
    const url = new URL(provider.authorizationUrl(PARAMS));
    expect(url.searchParams.get('response_type')).toBe('code');
  });

  it('includes the state', () => {
    const url = new URL(provider.authorizationUrl(PARAMS));
    expect(url.searchParams.get('state')).toBe('fb-state');
  });

  it('includes the redirect_uri', () => {
    const url = new URL(provider.authorizationUrl(PARAMS));
    expect(url.searchParams.get('redirect_uri')).toBe('https://example.com/fb/callback');
  });

  it('includes pages scope', () => {
    const url = new URL(provider.authorizationUrl(PARAMS));
    const scope = url.searchParams.get('scope') ?? '';
    expect(scope).toContain('pages_manage_posts');
  });

  it('includes client_id from env', () => {
    const url = new URL(provider.authorizationUrl(PARAMS));
    expect(url.searchParams.get('client_id')).toBe('fb-app-id');
  });

  it('throws when FACEBOOK_APP_ID is missing', () => {
    delete process.env.FACEBOOK_APP_ID;
    expect(() => provider.authorizationUrl(PARAMS)).toThrow('FACEBOOK_APP_ID');
  });
});

// ── Canva ────────────────────────────────────────────────────────────────────
describe('canvaProvider', () => {
  const provider = getOAuthProvider('canva');
  const PARAMS = {
    state: 'canva-state',
    redirectUri: 'https://example.com/canva/callback',
    codeChallenge: 'test-challenge',
  };

  it('requiresPkce is true', () => {
    expect(provider.requiresPkce).toBe(true);
  });

  it('authorizationUrl returns a valid URL pointing to canva.com', () => {
    const url = new URL(provider.authorizationUrl(PARAMS));
    expect(url.hostname).toBe('www.canva.com');
  });

  it('includes response_type=code', () => {
    const url = new URL(provider.authorizationUrl(PARAMS));
    expect(url.searchParams.get('response_type')).toBe('code');
  });

  it('includes the state', () => {
    const url = new URL(provider.authorizationUrl(PARAMS));
    expect(url.searchParams.get('state')).toBe('canva-state');
  });

  it('includes code_challenge', () => {
    const url = new URL(provider.authorizationUrl(PARAMS));
    expect(url.searchParams.get('code_challenge')).toBe('test-challenge');
  });

  it('includes code_challenge_method=S256', () => {
    const url = new URL(provider.authorizationUrl(PARAMS));
    expect(url.searchParams.get('code_challenge_method')).toBe('S256');
  });

  it('includes scope with design:content:write', () => {
    const url = new URL(provider.authorizationUrl(PARAMS));
    expect(url.searchParams.get('scope')).toContain('design:content:write');
  });

  it('includes scope with profile:read', () => {
    const url = new URL(provider.authorizationUrl(PARAMS));
    expect(url.searchParams.get('scope')).toContain('profile:read');
  });

  it('includes client_id from env', () => {
    const url = new URL(provider.authorizationUrl(PARAMS));
    expect(url.searchParams.get('client_id')).toBe('canva-id');
  });

  it('throws when CANVA_CLIENT_ID is missing', () => {
    delete process.env.CANVA_CLIENT_ID;
    expect(() => provider.authorizationUrl(PARAMS)).toThrow('CANVA_CLIENT_ID');
  });
});
