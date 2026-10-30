import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { getOAuthProvider } from '@/lib/oauth';

// authorizationUrl() is a pure URL builder — the only side-effect is reading
// environment variables.  We inject minimal stubs and clean up after each test.

const ENV_STUBS = {
  YOUTUBE_OAUTH_CLIENT_ID: 'yt-client-id',
  YOUTUBE_OAUTH_CLIENT_SECRET: 'yt-client-secret',
  TIKTOK_OAUTH_CLIENT_KEY: 'tt-client-key',
  TIKTOK_OAUTH_CLIENT_SECRET: 'tt-client-secret',
  FACEBOOK_APP_ID: 'fb-app-id',
  FACEBOOK_APP_SECRET: 'fb-app-secret',
  CANVA_CLIENT_ID: 'cv-client-id',
  CANVA_CLIENT_SECRET: 'cv-client-secret',
};

function setEnv() {
  for (const [k, v] of Object.entries(ENV_STUBS)) process.env[k] = v;
}

function clearEnv() {
  for (const k of Object.keys(ENV_STUBS)) delete process.env[k];
}

beforeEach(setEnv);
afterEach(clearEnv);

// ─────────────────────────────────────────────────────────────
// YouTube
// ─────────────────────────────────────────────────────────────
describe('YouTube authorizationUrl()', () => {
  const provider = getOAuthProvider('youtube');
  const params = { state: 'state-abc', redirectUri: 'https://app.example.com/callback/youtube' };

  it('returns a valid URL', () => {
    expect(() => new URL(provider.authorizationUrl(params))).not.toThrow();
  });

  it('points to Google OAuth2 endpoint', () => {
    const url = new URL(provider.authorizationUrl(params));
    expect(url.origin).toBe('https://accounts.google.com');
    expect(url.pathname).toBe('/o/oauth2/v2/auth');
  });

  it('includes the client_id', () => {
    const url = new URL(provider.authorizationUrl(params));
    expect(url.searchParams.get('client_id')).toBe('yt-client-id');
  });

  it('includes the redirect_uri', () => {
    const url = new URL(provider.authorizationUrl(params));
    expect(url.searchParams.get('redirect_uri')).toBe(params.redirectUri);
  });

  it('includes the state', () => {
    const url = new URL(provider.authorizationUrl(params));
    expect(url.searchParams.get('state')).toBe('state-abc');
  });

  it('sets access_type=offline', () => {
    const url = new URL(provider.authorizationUrl(params));
    expect(url.searchParams.get('access_type')).toBe('offline');
  });

  it('sets prompt=consent', () => {
    const url = new URL(provider.authorizationUrl(params));
    expect(url.searchParams.get('prompt')).toBe('consent');
  });

  it('sets response_type=code', () => {
    const url = new URL(provider.authorizationUrl(params));
    expect(url.searchParams.get('response_type')).toBe('code');
  });

  it('includes the YouTube upload scope', () => {
    const url = new URL(provider.authorizationUrl(params));
    expect(url.searchParams.get('scope')).toContain('youtube.upload');
  });

  it('throws when YOUTUBE_OAUTH_CLIENT_ID is missing', () => {
    delete process.env.YOUTUBE_OAUTH_CLIENT_ID;
    expect(() => provider.authorizationUrl(params)).toThrow('YOUTUBE_OAUTH_CLIENT_ID');
  });
});

// ─────────────────────────────────────────────────────────────
// TikTok
// ─────────────────────────────────────────────────────────────
describe('TikTok authorizationUrl()', () => {
  const provider = getOAuthProvider('tiktok');
  const params = { state: 'state-tt', redirectUri: 'https://app.example.com/callback/tiktok' };

  it('returns a valid URL', () => {
    expect(() => new URL(provider.authorizationUrl(params))).not.toThrow();
  });

  it('points to TikTok v2 auth endpoint', () => {
    const url = new URL(provider.authorizationUrl(params));
    expect(url.host).toBe('www.tiktok.com');
    expect(url.pathname).toBe('/v2/auth/authorize/');
  });

  it('includes the client_key', () => {
    const url = new URL(provider.authorizationUrl(params));
    expect(url.searchParams.get('client_key')).toBe('tt-client-key');
  });

  it('includes the state', () => {
    const url = new URL(provider.authorizationUrl(params));
    expect(url.searchParams.get('state')).toBe('state-tt');
  });

  it('includes video.publish scope', () => {
    const url = new URL(provider.authorizationUrl(params));
    expect(url.searchParams.get('scope')).toContain('video.publish');
  });

  it('sets response_type=code', () => {
    const url = new URL(provider.authorizationUrl(params));
    expect(url.searchParams.get('response_type')).toBe('code');
  });

  it('includes redirect_uri', () => {
    const url = new URL(provider.authorizationUrl(params));
    expect(url.searchParams.get('redirect_uri')).toBe(params.redirectUri);
  });

  it('throws when TIKTOK_OAUTH_CLIENT_KEY is missing', () => {
    delete process.env.TIKTOK_OAUTH_CLIENT_KEY;
    expect(() => provider.authorizationUrl(params)).toThrow('TIKTOK_OAUTH_CLIENT_KEY');
  });
});

// ─────────────────────────────────────────────────────────────
// Facebook
// ─────────────────────────────────────────────────────────────
describe('Facebook authorizationUrl()', () => {
  const provider = getOAuthProvider('facebook');
  const params = { state: 'state-fb', redirectUri: 'https://app.example.com/callback/facebook' };

  it('returns a valid URL', () => {
    expect(() => new URL(provider.authorizationUrl(params))).not.toThrow();
  });

  it('points to facebook.com OAuth dialog', () => {
    const url = new URL(provider.authorizationUrl(params));
    expect(url.host).toBe('www.facebook.com');
    expect(url.pathname).toContain('/dialog/oauth');
  });

  it('includes the client_id', () => {
    const url = new URL(provider.authorizationUrl(params));
    expect(url.searchParams.get('client_id')).toBe('fb-app-id');
  });

  it('includes the state', () => {
    const url = new URL(provider.authorizationUrl(params));
    expect(url.searchParams.get('state')).toBe('state-fb');
  });

  it('includes page management scopes', () => {
    const url = new URL(provider.authorizationUrl(params));
    const scope = url.searchParams.get('scope') ?? '';
    expect(scope).toContain('pages_show_list');
    expect(scope).toContain('pages_manage_posts');
  });

  it('sets response_type=code', () => {
    const url = new URL(provider.authorizationUrl(params));
    expect(url.searchParams.get('response_type')).toBe('code');
  });

  it('throws when FACEBOOK_APP_ID is missing', () => {
    delete process.env.FACEBOOK_APP_ID;
    expect(() => provider.authorizationUrl(params)).toThrow('FACEBOOK_APP_ID');
  });
});

// ─────────────────────────────────────────────────────────────
// Canva
// ─────────────────────────────────────────────────────────────
describe('Canva authorizationUrl()', () => {
  const provider = getOAuthProvider('canva');
  const params = {
    state: 'state-cv',
    redirectUri: 'https://app.example.com/callback/canva',
    codeChallenge: 'E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM',
  };

  it('returns a valid URL', () => {
    expect(() => new URL(provider.authorizationUrl(params))).not.toThrow();
  });

  it('points to Canva OAuth endpoint', () => {
    const url = new URL(provider.authorizationUrl(params));
    expect(url.host).toBe('www.canva.com');
    expect(url.pathname).toBe('/api/oauth/authorize');
  });

  it('includes the client_id', () => {
    const url = new URL(provider.authorizationUrl(params));
    expect(url.searchParams.get('client_id')).toBe('cv-client-id');
  });

  it('includes the state', () => {
    const url = new URL(provider.authorizationUrl(params));
    expect(url.searchParams.get('state')).toBe('state-cv');
  });

  it('includes the code_challenge', () => {
    const url = new URL(provider.authorizationUrl(params));
    expect(url.searchParams.get('code_challenge')).toBe(params.codeChallenge);
  });

  it('sets code_challenge_method=S256', () => {
    const url = new URL(provider.authorizationUrl(params));
    expect(url.searchParams.get('code_challenge_method')).toBe('S256');
  });

  it('sets response_type=code', () => {
    const url = new URL(provider.authorizationUrl(params));
    expect(url.searchParams.get('response_type')).toBe('code');
  });

  it('includes design content scopes', () => {
    const url = new URL(provider.authorizationUrl(params));
    const scope = url.searchParams.get('scope') ?? '';
    expect(scope).toContain('design:content:write');
    expect(scope).toContain('profile:read');
  });

  it('throws when CANVA_CLIENT_ID is missing', () => {
    delete process.env.CANVA_CLIENT_ID;
    expect(() => provider.authorizationUrl(params)).toThrow('CANVA_CLIENT_ID');
  });
});
