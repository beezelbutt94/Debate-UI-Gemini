/**
 * Tests for the authorizationUrl() method of each OAuth provider.
 * These are pure URL-building functions (no network calls), so they're safe
 * to test with environment variables mocked via process.env.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { getOAuthProvider } from '@/lib/oauth';

const BASE_PARAMS = {
  state: 'test-state-value',
  redirectUri: 'https://example.com/callback',
};

function setEnv(vars: Record<string, string>) {
  for (const [k, v] of Object.entries(vars)) process.env[k] = v;
}

function clearEnv(keys: string[]) {
  for (const k of keys) delete process.env[k];
}

// ── YouTube ───────────────────────────────────────────────────────────────────

describe('youtubeProvider.authorizationUrl', () => {
  const ENV_KEY = 'YOUTUBE_OAUTH_CLIENT_ID';
  const CLIENT_ID = 'yt-client-123';

  beforeEach(() => setEnv({ [ENV_KEY]: CLIENT_ID }));
  afterEach(() => clearEnv([ENV_KEY]));

  it('returns a valid URL string', () => {
    const url = getOAuthProvider('youtube').authorizationUrl(BASE_PARAMS);
    expect(() => new URL(url)).not.toThrow();
  });

  it('targets the Google OAuth2 endpoint', () => {
    const url = new URL(getOAuthProvider('youtube').authorizationUrl(BASE_PARAMS));
    expect(url.origin).toBe('https://accounts.google.com');
    expect(url.pathname).toBe('/o/oauth2/v2/auth');
  });

  it('includes the client_id', () => {
    const url = new URL(getOAuthProvider('youtube').authorizationUrl(BASE_PARAMS));
    expect(url.searchParams.get('client_id')).toBe(CLIENT_ID);
  });

  it('includes the redirect_uri', () => {
    const url = new URL(getOAuthProvider('youtube').authorizationUrl(BASE_PARAMS));
    expect(url.searchParams.get('redirect_uri')).toBe(BASE_PARAMS.redirectUri);
  });

  it('includes state', () => {
    const url = new URL(getOAuthProvider('youtube').authorizationUrl(BASE_PARAMS));
    expect(url.searchParams.get('state')).toBe(BASE_PARAMS.state);
  });

  it('requests offline access (for refresh tokens)', () => {
    const url = new URL(getOAuthProvider('youtube').authorizationUrl(BASE_PARAMS));
    expect(url.searchParams.get('access_type')).toBe('offline');
  });

  it('uses prompt=consent to always return a refresh token', () => {
    const url = new URL(getOAuthProvider('youtube').authorizationUrl(BASE_PARAMS));
    expect(url.searchParams.get('prompt')).toBe('consent');
  });

  it('requests the youtube.upload scope', () => {
    const url = new URL(getOAuthProvider('youtube').authorizationUrl(BASE_PARAMS));
    expect(url.searchParams.get('scope')).toContain('youtube.upload');
  });

  it('uses response_type=code', () => {
    const url = new URL(getOAuthProvider('youtube').authorizationUrl(BASE_PARAMS));
    expect(url.searchParams.get('response_type')).toBe('code');
  });

  it('throws when YOUTUBE_OAUTH_CLIENT_ID is not set', () => {
    delete process.env[ENV_KEY];
    expect(() => getOAuthProvider('youtube').authorizationUrl(BASE_PARAMS)).toThrow();
  });
});

// ── TikTok ────────────────────────────────────────────────────────────────────

describe('tiktokProvider.authorizationUrl', () => {
  const ENV_KEY = 'TIKTOK_OAUTH_CLIENT_KEY';
  const CLIENT_KEY = 'tiktok-key-xyz';

  beforeEach(() => setEnv({ [ENV_KEY]: CLIENT_KEY }));
  afterEach(() => clearEnv([ENV_KEY]));

  it('returns a valid URL string', () => {
    const url = getOAuthProvider('tiktok').authorizationUrl(BASE_PARAMS);
    expect(() => new URL(url)).not.toThrow();
  });

  it('targets the TikTok authorize endpoint', () => {
    const url = new URL(getOAuthProvider('tiktok').authorizationUrl(BASE_PARAMS));
    expect(url.origin).toBe('https://www.tiktok.com');
    expect(url.pathname).toBe('/v2/auth/authorize/');
  });

  it('includes client_key', () => {
    const url = new URL(getOAuthProvider('tiktok').authorizationUrl(BASE_PARAMS));
    expect(url.searchParams.get('client_key')).toBe(CLIENT_KEY);
  });

  it('includes redirect_uri', () => {
    const url = new URL(getOAuthProvider('tiktok').authorizationUrl(BASE_PARAMS));
    expect(url.searchParams.get('redirect_uri')).toBe(BASE_PARAMS.redirectUri);
  });

  it('includes state', () => {
    const url = new URL(getOAuthProvider('tiktok').authorizationUrl(BASE_PARAMS));
    expect(url.searchParams.get('state')).toBe(BASE_PARAMS.state);
  });

  it('requests video.publish scope', () => {
    const url = new URL(getOAuthProvider('tiktok').authorizationUrl(BASE_PARAMS));
    expect(url.searchParams.get('scope')).toContain('video.publish');
  });

  it('uses response_type=code', () => {
    const url = new URL(getOAuthProvider('tiktok').authorizationUrl(BASE_PARAMS));
    expect(url.searchParams.get('response_type')).toBe('code');
  });

  it('throws when TIKTOK_OAUTH_CLIENT_KEY is not set', () => {
    delete process.env[ENV_KEY];
    expect(() => getOAuthProvider('tiktok').authorizationUrl(BASE_PARAMS)).toThrow();
  });
});

// ── Facebook ──────────────────────────────────────────────────────────────────

describe('facebookProvider.authorizationUrl', () => {
  const ENV_KEY = 'FACEBOOK_APP_ID';
  const APP_ID = 'fb-app-456';

  beforeEach(() => setEnv({ [ENV_KEY]: APP_ID }));
  afterEach(() => clearEnv([ENV_KEY]));

  it('returns a valid URL string', () => {
    const url = getOAuthProvider('facebook').authorizationUrl(BASE_PARAMS);
    expect(() => new URL(url)).not.toThrow();
  });

  it('targets the Facebook dialog/oauth endpoint', () => {
    const url = new URL(getOAuthProvider('facebook').authorizationUrl(BASE_PARAMS));
    expect(url.origin).toBe('https://www.facebook.com');
    expect(url.pathname).toContain('/dialog/oauth');
  });

  it('includes client_id', () => {
    const url = new URL(getOAuthProvider('facebook').authorizationUrl(BASE_PARAMS));
    expect(url.searchParams.get('client_id')).toBe(APP_ID);
  });

  it('includes redirect_uri', () => {
    const url = new URL(getOAuthProvider('facebook').authorizationUrl(BASE_PARAMS));
    expect(url.searchParams.get('redirect_uri')).toBe(BASE_PARAMS.redirectUri);
  });

  it('includes state', () => {
    const url = new URL(getOAuthProvider('facebook').authorizationUrl(BASE_PARAMS));
    expect(url.searchParams.get('state')).toBe(BASE_PARAMS.state);
  });

  it('requests pages scopes', () => {
    const url = new URL(getOAuthProvider('facebook').authorizationUrl(BASE_PARAMS));
    const scope = url.searchParams.get('scope') ?? '';
    expect(scope).toContain('pages_show_list');
    expect(scope).toContain('pages_manage_posts');
  });

  it('uses response_type=code', () => {
    const url = new URL(getOAuthProvider('facebook').authorizationUrl(BASE_PARAMS));
    expect(url.searchParams.get('response_type')).toBe('code');
  });

  it('throws when FACEBOOK_APP_ID is not set', () => {
    delete process.env[ENV_KEY];
    expect(() => getOAuthProvider('facebook').authorizationUrl(BASE_PARAMS)).toThrow();
  });
});

// ── Canva ─────────────────────────────────────────────────────────────────────

describe('canvaProvider.authorizationUrl', () => {
  const ENVS = { CANVA_CLIENT_ID: 'canva-client-789', CANVA_CLIENT_SECRET: 'canva-secret' };

  beforeEach(() => setEnv(ENVS));
  afterEach(() => clearEnv(Object.keys(ENVS)));

  const paramsWithPkce = {
    ...BASE_PARAMS,
    codeChallenge: 'abc123challenge',
  };

  it('returns a valid URL string', () => {
    const url = getOAuthProvider('canva').authorizationUrl(paramsWithPkce);
    expect(() => new URL(url)).not.toThrow();
  });

  it('targets the Canva authorize endpoint', () => {
    const url = new URL(getOAuthProvider('canva').authorizationUrl(paramsWithPkce));
    expect(url.origin).toBe('https://www.canva.com');
    expect(url.pathname).toBe('/api/oauth/authorize');
  });

  it('includes client_id', () => {
    const url = new URL(getOAuthProvider('canva').authorizationUrl(paramsWithPkce));
    expect(url.searchParams.get('client_id')).toBe(ENVS.CANVA_CLIENT_ID);
  });

  it('includes redirect_uri', () => {
    const url = new URL(getOAuthProvider('canva').authorizationUrl(paramsWithPkce));
    expect(url.searchParams.get('redirect_uri')).toBe(BASE_PARAMS.redirectUri);
  });

  it('includes state', () => {
    const url = new URL(getOAuthProvider('canva').authorizationUrl(paramsWithPkce));
    expect(url.searchParams.get('state')).toBe(BASE_PARAMS.state);
  });

  it('includes code_challenge', () => {
    const url = new URL(getOAuthProvider('canva').authorizationUrl(paramsWithPkce));
    expect(url.searchParams.get('code_challenge')).toBe(paramsWithPkce.codeChallenge);
  });

  it('uses S256 code_challenge_method', () => {
    const url = new URL(getOAuthProvider('canva').authorizationUrl(paramsWithPkce));
    expect(url.searchParams.get('code_challenge_method')).toBe('S256');
  });

  it('requests the expected scopes', () => {
    const url = new URL(getOAuthProvider('canva').authorizationUrl(paramsWithPkce));
    const scope = url.searchParams.get('scope') ?? '';
    expect(scope).toContain('design:content:write');
    expect(scope).toContain('profile:read');
  });

  it('uses response_type=code', () => {
    const url = new URL(getOAuthProvider('canva').authorizationUrl(paramsWithPkce));
    expect(url.searchParams.get('response_type')).toBe('code');
  });

  it('throws when CANVA_CLIENT_ID is not set', () => {
    delete process.env.CANVA_CLIENT_ID;
    expect(() => getOAuthProvider('canva').authorizationUrl(paramsWithPkce)).toThrow();
  });
});
