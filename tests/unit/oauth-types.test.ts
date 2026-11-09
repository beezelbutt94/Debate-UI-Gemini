import { describe, it, expect } from 'vitest';
import { isOAuthPlatform } from '@/lib/oauth/types';
import { getOAuthProvider } from '@/lib/oauth';

// ─── isOAuthPlatform ──────────────────────────────────────────────────────────

describe('isOAuthPlatform', () => {
  it('returns true for "youtube"', () => {
    expect(isOAuthPlatform('youtube')).toBe(true);
  });

  it('returns true for "tiktok"', () => {
    expect(isOAuthPlatform('tiktok')).toBe(true);
  });

  it('returns true for "facebook"', () => {
    expect(isOAuthPlatform('facebook')).toBe(true);
  });

  it('returns true for "canva"', () => {
    expect(isOAuthPlatform('canva')).toBe(true);
  });

  it('returns false for "instagram"', () => {
    expect(isOAuthPlatform('instagram')).toBe(false);
  });

  it('returns false for "twitter"', () => {
    expect(isOAuthPlatform('twitter')).toBe(false);
  });

  it('returns false for empty string', () => {
    expect(isOAuthPlatform('')).toBe(false);
  });

  it('returns false for "YouTube" (case-sensitive)', () => {
    expect(isOAuthPlatform('YouTube')).toBe(false);
  });

  it('returns false for "TIKTOK" (case-sensitive)', () => {
    expect(isOAuthPlatform('TIKTOK')).toBe(false);
  });

  it('returns false for a random string', () => {
    expect(isOAuthPlatform('randomplatform')).toBe(false);
  });

  it('returns false for "facebook_reels"', () => {
    expect(isOAuthPlatform('facebook_reels')).toBe(false);
  });

  it('returns false for "youtube_shorts"', () => {
    expect(isOAuthPlatform('youtube_shorts')).toBe(false);
  });

  it('returns false for null-like string "null"', () => {
    expect(isOAuthPlatform('null')).toBe(false);
  });
});

// ─── getOAuthProvider ──────────────────────────────────────────────────────────

describe('getOAuthProvider', () => {
  it('returns a provider for youtube', () => {
    const p = getOAuthProvider('youtube');
    expect(p).toBeDefined();
    expect(typeof p.authorizationUrl).toBe('function');
    expect(typeof p.exchangeCode).toBe('function');
    expect(typeof p.refreshAccessToken).toBe('function');
  });

  it('returns a provider for tiktok', () => {
    const p = getOAuthProvider('tiktok');
    expect(p).toBeDefined();
    expect(typeof p.authorizationUrl).toBe('function');
  });

  it('returns a provider for facebook', () => {
    const p = getOAuthProvider('facebook');
    expect(p).toBeDefined();
    expect(typeof p.authorizationUrl).toBe('function');
  });

  it('returns a provider for canva', () => {
    const p = getOAuthProvider('canva');
    expect(p).toBeDefined();
    expect(typeof p.authorizationUrl).toBe('function');
  });

  it('youtube provider does not require PKCE', () => {
    expect(getOAuthProvider('youtube').requiresPkce).toBe(false);
  });

  it('tiktok provider does not require PKCE', () => {
    expect(getOAuthProvider('tiktok').requiresPkce).toBe(false);
  });

  it('facebook provider does not require PKCE', () => {
    expect(getOAuthProvider('facebook').requiresPkce).toBe(false);
  });

  it('canva provider requires PKCE', () => {
    expect(getOAuthProvider('canva').requiresPkce).toBe(true);
  });

  it('youtube authorizationUrl builds a valid google URL', () => {
    process.env.YOUTUBE_OAUTH_CLIENT_ID = 'test-client-id';
    const url = getOAuthProvider('youtube').authorizationUrl({
      state: 'test-state',
      redirectUri: 'https://example.com/callback',
    });
    expect(url).toContain('accounts.google.com');
    expect(url).toContain('client_id=test-client-id');
    expect(url).toContain('state=test-state');
    expect(url).toContain('redirect_uri=');
    expect(url).toContain('youtube.upload');
    expect(url).toContain('access_type=offline');
    expect(url).toContain('prompt=consent');
    delete process.env.YOUTUBE_OAUTH_CLIENT_ID;
  });

  it('tiktok authorizationUrl builds a valid tiktok URL', () => {
    process.env.TIKTOK_OAUTH_CLIENT_KEY = 'test-tiktok-key';
    const url = getOAuthProvider('tiktok').authorizationUrl({
      state: 'csrf-token',
      redirectUri: 'https://example.com/callback',
    });
    expect(url).toContain('tiktok.com');
    expect(url).toContain('client_key=test-tiktok-key');
    expect(url).toContain('state=csrf-token');
    expect(url).toContain('video.publish');
    delete process.env.TIKTOK_OAUTH_CLIENT_KEY;
  });

  it('facebook authorizationUrl builds a valid meta URL', () => {
    process.env.FACEBOOK_APP_ID = 'test-fb-app';
    const url = getOAuthProvider('facebook').authorizationUrl({
      state: 'csrf-state',
      redirectUri: 'https://example.com/callback',
    });
    expect(url).toContain('facebook.com');
    expect(url).toContain('client_id=test-fb-app');
    expect(url).toContain('state=csrf-state');
    expect(url).toContain('pages_show_list');
    delete process.env.FACEBOOK_APP_ID;
  });

  it('canva authorizationUrl builds a valid canva URL with PKCE', () => {
    process.env.CANVA_CLIENT_ID = 'test-canva-id';
    const url = getOAuthProvider('canva').authorizationUrl({
      state: 'csrf-state',
      redirectUri: 'https://example.com/callback',
      codeChallenge: 'challenge-value',
    });
    expect(url).toContain('canva.com');
    expect(url).toContain('client_id=test-canva-id');
    expect(url).toContain('code_challenge=challenge-value');
    expect(url).toContain('code_challenge_method=S256');
    delete process.env.CANVA_CLIENT_ID;
  });

  it('youtube authorizationUrl throws when YOUTUBE_OAUTH_CLIENT_ID not set', () => {
    delete process.env.YOUTUBE_OAUTH_CLIENT_ID;
    expect(() =>
      getOAuthProvider('youtube').authorizationUrl({
        state: 's',
        redirectUri: 'https://example.com/cb',
      })
    ).toThrow('YOUTUBE_OAUTH_CLIENT_ID');
  });

  it('tiktok authorizationUrl throws when TIKTOK_OAUTH_CLIENT_KEY not set', () => {
    delete process.env.TIKTOK_OAUTH_CLIENT_KEY;
    expect(() =>
      getOAuthProvider('tiktok').authorizationUrl({
        state: 's',
        redirectUri: 'https://example.com/cb',
      })
    ).toThrow('TIKTOK_OAUTH_CLIENT_KEY');
  });

  it('facebook authorizationUrl throws when FACEBOOK_APP_ID not set', () => {
    delete process.env.FACEBOOK_APP_ID;
    expect(() =>
      getOAuthProvider('facebook').authorizationUrl({
        state: 's',
        redirectUri: 'https://example.com/cb',
      })
    ).toThrow('FACEBOOK_APP_ID');
  });

  it('canva authorizationUrl throws when CANVA_CLIENT_ID not set', () => {
    delete process.env.CANVA_CLIENT_ID;
    expect(() =>
      getOAuthProvider('canva').authorizationUrl({
        state: 's',
        redirectUri: 'https://example.com/cb',
        codeChallenge: 'c',
      })
    ).toThrow('CANVA_CLIENT_ID');
  });
});
