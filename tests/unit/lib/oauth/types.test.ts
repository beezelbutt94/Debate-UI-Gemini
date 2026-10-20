import { describe, it, expect } from 'vitest';
import { isOAuthPlatform, getOAuthProvider } from '@/lib/oauth';

// ── isOAuthPlatform ───────────────────────────────────────────────────────────

describe('isOAuthPlatform()', () => {
  it('accepts "youtube"', () => expect(isOAuthPlatform('youtube')).toBe(true));
  it('accepts "tiktok"', () => expect(isOAuthPlatform('tiktok')).toBe(true));
  it('accepts "facebook"', () => expect(isOAuthPlatform('facebook')).toBe(true));
  it('accepts "canva"', () => expect(isOAuthPlatform('canva')).toBe(true));

  it('rejects an unknown platform string', () => {
    expect(isOAuthPlatform('twitter')).toBe(false);
  });

  it('rejects an empty string', () => {
    expect(isOAuthPlatform('')).toBe(false);
  });

  it('rejects mixed case', () => {
    expect(isOAuthPlatform('YouTube')).toBe(false);
    expect(isOAuthPlatform('TIKTOK')).toBe(false);
  });

  it('rejects a partial match', () => {
    expect(isOAuthPlatform('you')).toBe(false);
  });

  it('rejects instagram (not yet a connectable OAuth platform)', () => {
    expect(isOAuthPlatform('instagram')).toBe(false);
  });
});

// ── getOAuthProvider ──────────────────────────────────────────────────────────

describe('getOAuthProvider()', () => {
  it('returns a provider with authorizationUrl, exchangeCode, refreshAccessToken', () => {
    for (const platform of ['youtube', 'tiktok', 'facebook', 'canva'] as const) {
      const p = getOAuthProvider(platform);
      expect(typeof p.authorizationUrl).toBe('function');
      expect(typeof p.exchangeCode).toBe('function');
      expect(typeof p.refreshAccessToken).toBe('function');
      expect(typeof p.requiresPkce).toBe('boolean');
    }
  });

  it('only canva requires PKCE', () => {
    expect(getOAuthProvider('canva').requiresPkce).toBe(true);
    expect(getOAuthProvider('youtube').requiresPkce).toBe(false);
    expect(getOAuthProvider('tiktok').requiresPkce).toBe(false);
    expect(getOAuthProvider('facebook').requiresPkce).toBe(false);
  });

  it('youtube authorizationUrl contains accounts.google.com', () => {
    process.env.YOUTUBE_OAUTH_CLIENT_ID = 'test_client_id';
    const url = getOAuthProvider('youtube').authorizationUrl({
      state: 'mystate',
      redirectUri: 'https://example.com/callback',
    });
    expect(url).toContain('accounts.google.com');
    expect(url).toContain('state=mystate');
    expect(url).toContain('access_type=offline');
    expect(url).toContain('prompt=consent');
  });

  it('tiktok authorizationUrl contains tiktok.com/v2/auth/authorize', () => {
    process.env.TIKTOK_OAUTH_CLIENT_KEY = 'test_key';
    const url = getOAuthProvider('tiktok').authorizationUrl({
      state: 'tikstate',
      redirectUri: 'https://example.com/callback',
    });
    expect(url).toContain('tiktok.com/v2/auth/authorize');
    expect(url).toContain('state=tikstate');
    expect(url).toContain('scope=video.publish');
  });

  it('facebook authorizationUrl contains facebook.com/dialog/oauth', () => {
    process.env.FACEBOOK_APP_ID = 'test_fb_id';
    const url = getOAuthProvider('facebook').authorizationUrl({
      state: 'fbstate',
      redirectUri: 'https://example.com/callback',
    });
    expect(url).toContain('facebook.com');
    expect(url).toContain('dialog/oauth');
    expect(url).toContain('state=fbstate');
  });

  it('canva authorizationUrl contains canva.com/api/oauth/authorize and code_challenge', () => {
    process.env.CANVA_CLIENT_ID = 'test_canva_id';
    const url = getOAuthProvider('canva').authorizationUrl({
      state: 'canvastate',
      redirectUri: 'https://example.com/callback',
      codeChallenge: 'mychallenge',
    });
    expect(url).toContain('canva.com/api/oauth/authorize');
    expect(url).toContain('code_challenge=mychallenge');
    expect(url).toContain('code_challenge_method=S256');
    expect(url).toContain('state=canvastate');
  });
});
