import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { youtubeProvider } from '@/lib/oauth/youtube';
import { tiktokProvider } from '@/lib/oauth/tiktok';
import { facebookProvider } from '@/lib/oauth/facebook';
import { canvaProvider } from '@/lib/oauth/canva';
import { codeChallengeFromVerifier, generateCodeVerifier } from '@/lib/oauth/state';

// ── helpers ───────────────────────────────────────────────────────────────────

/** Temporarily sets env vars and restores them after the test. */
function stubEnvVars(vars: Record<string, string>) {
  const original: Record<string, string | undefined> = {};
  beforeEach(() => {
    for (const [k, v] of Object.entries(vars)) {
      original[k] = process.env[k];
      process.env[k] = v;
    }
  });
  afterEach(() => {
    for (const k of Object.keys(vars)) {
      if (original[k] === undefined) {
        delete process.env[k];
      } else {
        process.env[k] = original[k];
      }
    }
  });
}

const REDIRECT_URI = 'https://app.example.com/oauth/callback';
const STATE = 'test_state_abc123';

// ── YouTube ───────────────────────────────────────────────────────────────────

describe('youtubeProvider.authorizationUrl', () => {
  stubEnvVars({ YOUTUBE_OAUTH_CLIENT_ID: 'yt-client-id' });

  it('returns a URL string', () => {
    const url = youtubeProvider.authorizationUrl({ state: STATE, redirectUri: REDIRECT_URI });
    expect(() => new URL(url)).not.toThrow();
  });

  it('points to Google OAuth2 authorization endpoint', () => {
    const url = youtubeProvider.authorizationUrl({ state: STATE, redirectUri: REDIRECT_URI });
    expect(url).toContain('accounts.google.com/o/oauth2/v2/auth');
  });

  it('includes the client_id from env', () => {
    const url = youtubeProvider.authorizationUrl({ state: STATE, redirectUri: REDIRECT_URI });
    const params = new URL(url).searchParams;
    expect(params.get('client_id')).toBe('yt-client-id');
  });

  it('sets response_type=code', () => {
    const url = youtubeProvider.authorizationUrl({ state: STATE, redirectUri: REDIRECT_URI });
    expect(new URL(url).searchParams.get('response_type')).toBe('code');
  });

  it('sets access_type=offline to request a refresh token', () => {
    const url = youtubeProvider.authorizationUrl({ state: STATE, redirectUri: REDIRECT_URI });
    expect(new URL(url).searchParams.get('access_type')).toBe('offline');
  });

  it('sets prompt=consent so refresh token is always returned', () => {
    const url = youtubeProvider.authorizationUrl({ state: STATE, redirectUri: REDIRECT_URI });
    expect(new URL(url).searchParams.get('prompt')).toBe('consent');
  });

  it('passes the provided state', () => {
    const url = youtubeProvider.authorizationUrl({ state: STATE, redirectUri: REDIRECT_URI });
    expect(new URL(url).searchParams.get('state')).toBe(STATE);
  });

  it('passes the provided redirect_uri', () => {
    const url = youtubeProvider.authorizationUrl({ state: STATE, redirectUri: REDIRECT_URI });
    expect(new URL(url).searchParams.get('redirect_uri')).toBe(REDIRECT_URI);
  });

  it('includes the YouTube upload scope', () => {
    const url = youtubeProvider.authorizationUrl({ state: STATE, redirectUri: REDIRECT_URI });
    expect(new URL(url).searchParams.get('scope')).toContain('youtube.upload');
  });

  it('does not require PKCE', () => {
    expect(youtubeProvider.requiresPkce).toBe(false);
  });

  it('different states produce different URLs', () => {
    const u1 = youtubeProvider.authorizationUrl({ state: 'state1', redirectUri: REDIRECT_URI });
    const u2 = youtubeProvider.authorizationUrl({ state: 'state2', redirectUri: REDIRECT_URI });
    expect(u1).not.toBe(u2);
  });

  it('different redirect URIs produce different URLs', () => {
    const u1 = youtubeProvider.authorizationUrl({ state: STATE, redirectUri: 'https://a.example.com/cb' });
    const u2 = youtubeProvider.authorizationUrl({ state: STATE, redirectUri: 'https://b.example.com/cb' });
    expect(u1).not.toBe(u2);
  });
});

describe('youtubeProvider.authorizationUrl – missing env var', () => {
  beforeEach(() => { delete process.env.YOUTUBE_OAUTH_CLIENT_ID; });

  it('throws when YOUTUBE_OAUTH_CLIENT_ID is not set', () => {
    expect(() => youtubeProvider.authorizationUrl({ state: STATE, redirectUri: REDIRECT_URI })).toThrow(
      /YOUTUBE_OAUTH_CLIENT_ID/
    );
  });
});

// ── TikTok ────────────────────────────────────────────────────────────────────

describe('tiktokProvider.authorizationUrl', () => {
  stubEnvVars({ TIKTOK_OAUTH_CLIENT_KEY: 'tt-client-key' });

  it('returns a valid URL string', () => {
    const url = tiktokProvider.authorizationUrl({ state: STATE, redirectUri: REDIRECT_URI });
    expect(() => new URL(url)).not.toThrow();
  });

  it('points to TikTok authorization endpoint', () => {
    const url = tiktokProvider.authorizationUrl({ state: STATE, redirectUri: REDIRECT_URI });
    expect(url).toContain('tiktok.com');
  });

  it('uses v2 auth endpoint', () => {
    const url = tiktokProvider.authorizationUrl({ state: STATE, redirectUri: REDIRECT_URI });
    expect(url).toContain('/v2/auth/authorize/');
  });

  it('includes the client_key from env', () => {
    const url = tiktokProvider.authorizationUrl({ state: STATE, redirectUri: REDIRECT_URI });
    expect(new URL(url).searchParams.get('client_key')).toBe('tt-client-key');
  });

  it('sets scope=video.publish', () => {
    const url = tiktokProvider.authorizationUrl({ state: STATE, redirectUri: REDIRECT_URI });
    expect(new URL(url).searchParams.get('scope')).toBe('video.publish');
  });

  it('sets response_type=code', () => {
    const url = tiktokProvider.authorizationUrl({ state: STATE, redirectUri: REDIRECT_URI });
    expect(new URL(url).searchParams.get('response_type')).toBe('code');
  });

  it('passes the provided state', () => {
    const url = tiktokProvider.authorizationUrl({ state: STATE, redirectUri: REDIRECT_URI });
    expect(new URL(url).searchParams.get('state')).toBe(STATE);
  });

  it('passes the provided redirect_uri', () => {
    const url = tiktokProvider.authorizationUrl({ state: STATE, redirectUri: REDIRECT_URI });
    expect(new URL(url).searchParams.get('redirect_uri')).toBe(REDIRECT_URI);
  });

  it('does not require PKCE', () => {
    expect(tiktokProvider.requiresPkce).toBe(false);
  });
});

describe('tiktokProvider.authorizationUrl – missing env var', () => {
  beforeEach(() => { delete process.env.TIKTOK_OAUTH_CLIENT_KEY; });

  it('throws when TIKTOK_OAUTH_CLIENT_KEY is not set', () => {
    expect(() => tiktokProvider.authorizationUrl({ state: STATE, redirectUri: REDIRECT_URI })).toThrow(
      /TIKTOK_OAUTH_CLIENT_KEY/
    );
  });
});

// ── Facebook ──────────────────────────────────────────────────────────────────

describe('facebookProvider.authorizationUrl', () => {
  stubEnvVars({ FACEBOOK_APP_ID: 'fb-app-id' });

  it('returns a valid URL string', () => {
    const url = facebookProvider.authorizationUrl({ state: STATE, redirectUri: REDIRECT_URI });
    expect(() => new URL(url)).not.toThrow();
  });

  it('points to Facebook OAuth dialog', () => {
    const url = facebookProvider.authorizationUrl({ state: STATE, redirectUri: REDIRECT_URI });
    expect(url).toContain('facebook.com');
    expect(url).toContain('dialog/oauth');
  });

  it('uses Graph API version v21.0', () => {
    const url = facebookProvider.authorizationUrl({ state: STATE, redirectUri: REDIRECT_URI });
    expect(url).toContain('v21.0');
  });

  it('includes the client_id from env', () => {
    const url = facebookProvider.authorizationUrl({ state: STATE, redirectUri: REDIRECT_URI });
    expect(new URL(url).searchParams.get('client_id')).toBe('fb-app-id');
  });

  it('sets response_type=code', () => {
    const url = facebookProvider.authorizationUrl({ state: STATE, redirectUri: REDIRECT_URI });
    expect(new URL(url).searchParams.get('response_type')).toBe('code');
  });

  it('passes the provided state', () => {
    const url = facebookProvider.authorizationUrl({ state: STATE, redirectUri: REDIRECT_URI });
    expect(new URL(url).searchParams.get('state')).toBe(STATE);
  });

  it('passes the provided redirect_uri', () => {
    const url = facebookProvider.authorizationUrl({ state: STATE, redirectUri: REDIRECT_URI });
    expect(new URL(url).searchParams.get('redirect_uri')).toBe(REDIRECT_URI);
  });

  it('requests pages_show_list scope', () => {
    const url = facebookProvider.authorizationUrl({ state: STATE, redirectUri: REDIRECT_URI });
    expect(new URL(url).searchParams.get('scope')).toContain('pages_show_list');
  });

  it('requests pages_read_engagement scope', () => {
    const url = facebookProvider.authorizationUrl({ state: STATE, redirectUri: REDIRECT_URI });
    expect(new URL(url).searchParams.get('scope')).toContain('pages_read_engagement');
  });

  it('requests pages_manage_posts scope', () => {
    const url = facebookProvider.authorizationUrl({ state: STATE, redirectUri: REDIRECT_URI });
    expect(new URL(url).searchParams.get('scope')).toContain('pages_manage_posts');
  });

  it('does not require PKCE', () => {
    expect(facebookProvider.requiresPkce).toBe(false);
  });
});

describe('facebookProvider.authorizationUrl – missing env var', () => {
  beforeEach(() => { delete process.env.FACEBOOK_APP_ID; });

  it('throws when FACEBOOK_APP_ID is not set', () => {
    expect(() => facebookProvider.authorizationUrl({ state: STATE, redirectUri: REDIRECT_URI })).toThrow(
      /FACEBOOK_APP_ID/
    );
  });
});

// ── Canva ─────────────────────────────────────────────────────────────────────

describe('canvaProvider.authorizationUrl', () => {
  stubEnvVars({ CANVA_CLIENT_ID: 'canva-client-id', CANVA_CLIENT_SECRET: 'canva-secret' });

  const verifier = generateCodeVerifier();
  const challenge = codeChallengeFromVerifier(verifier);
  const params = { state: STATE, redirectUri: REDIRECT_URI, codeChallenge: challenge };

  it('returns a valid URL string', () => {
    const url = canvaProvider.authorizationUrl(params);
    expect(() => new URL(url)).not.toThrow();
  });

  it('points to Canva authorization endpoint', () => {
    const url = canvaProvider.authorizationUrl(params);
    expect(url).toContain('canva.com');
    expect(url).toContain('oauth/authorize');
  });

  it('includes the client_id from env', () => {
    const url = canvaProvider.authorizationUrl(params);
    expect(new URL(url).searchParams.get('client_id')).toBe('canva-client-id');
  });

  it('sets response_type=code', () => {
    const url = canvaProvider.authorizationUrl(params);
    expect(new URL(url).searchParams.get('response_type')).toBe('code');
  });

  it('passes the provided state', () => {
    const url = canvaProvider.authorizationUrl(params);
    expect(new URL(url).searchParams.get('state')).toBe(STATE);
  });

  it('passes the provided redirect_uri', () => {
    const url = canvaProvider.authorizationUrl(params);
    expect(new URL(url).searchParams.get('redirect_uri')).toBe(REDIRECT_URI);
  });

  it('sets code_challenge_method=S256', () => {
    const url = canvaProvider.authorizationUrl(params);
    expect(new URL(url).searchParams.get('code_challenge_method')).toBe('S256');
  });

  it('passes the provided code_challenge', () => {
    const url = canvaProvider.authorizationUrl(params);
    expect(new URL(url).searchParams.get('code_challenge')).toBe(challenge);
  });

  it('requests design:content:write scope', () => {
    const url = canvaProvider.authorizationUrl(params);
    expect(new URL(url).searchParams.get('scope')).toContain('design:content:write');
  });

  it('requests profile:read scope', () => {
    const url = canvaProvider.authorizationUrl(params);
    expect(new URL(url).searchParams.get('scope')).toContain('profile:read');
  });

  it('requires PKCE', () => {
    expect(canvaProvider.requiresPkce).toBe(true);
  });

  it('different code challenges produce different URLs', () => {
    const v2 = generateCodeVerifier();
    const c2 = codeChallengeFromVerifier(v2);
    const u1 = canvaProvider.authorizationUrl({ ...params, codeChallenge: challenge });
    const u2 = canvaProvider.authorizationUrl({ ...params, codeChallenge: c2 });
    expect(u1).not.toBe(u2);
  });
});

describe('canvaProvider.authorizationUrl – missing env var', () => {
  beforeEach(() => { delete process.env.CANVA_CLIENT_ID; });

  it('throws when CANVA_CLIENT_ID is not set', () => {
    expect(() =>
      canvaProvider.authorizationUrl({ state: STATE, redirectUri: REDIRECT_URI, codeChallenge: 'x' })
    ).toThrow(/CANVA_CLIENT_ID/);
  });
});
