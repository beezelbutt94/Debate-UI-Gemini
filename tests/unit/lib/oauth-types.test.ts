import { describe, it, expect } from 'vitest';
import { isOAuthPlatform, getOAuthProvider } from '@/lib/oauth/index';

// ──────────────────────────────────────────────────────────
// isOAuthPlatform()
// ──────────────────────────────────────────────────────────
describe('isOAuthPlatform()', () => {
  it('accepts youtube', () => expect(isOAuthPlatform('youtube')).toBe(true));
  it('accepts tiktok', () => expect(isOAuthPlatform('tiktok')).toBe(true));
  it('accepts facebook', () => expect(isOAuthPlatform('facebook')).toBe(true));
  it('accepts canva', () => expect(isOAuthPlatform('canva')).toBe(true));

  it('rejects instagram', () => expect(isOAuthPlatform('instagram')).toBe(false));
  it('rejects empty string', () => expect(isOAuthPlatform('')).toBe(false));
  it('rejects random string', () => expect(isOAuthPlatform('twitter')).toBe(false));
  it('is case-sensitive (YouTube with capital Y)', () => {
    expect(isOAuthPlatform('YouTube')).toBe(false);
  });
  it('rejects TikTok with mixed case', () => {
    expect(isOAuthPlatform('TikTok')).toBe(false);
  });
});

// ──────────────────────────────────────────────────────────
// getOAuthProvider() — structural checks, no env vars needed
// ──────────────────────────────────────────────────────────
describe('getOAuthProvider()', () => {
  it('returns an object with required methods for youtube', () => {
    const p = getOAuthProvider('youtube');
    expect(typeof p.authorizationUrl).toBe('function');
    expect(typeof p.exchangeCode).toBe('function');
    expect(typeof p.refreshAccessToken).toBe('function');
    expect(typeof p.requiresPkce).toBe('boolean');
  });

  it('returns an object with required methods for tiktok', () => {
    const p = getOAuthProvider('tiktok');
    expect(typeof p.authorizationUrl).toBe('function');
    expect(typeof p.exchangeCode).toBe('function');
    expect(typeof p.refreshAccessToken).toBe('function');
  });

  it('returns an object with required methods for facebook', () => {
    const p = getOAuthProvider('facebook');
    expect(typeof p.authorizationUrl).toBe('function');
  });

  it('returns an object with required methods for canva', () => {
    const p = getOAuthProvider('canva');
    expect(typeof p.authorizationUrl).toBe('function');
    expect(p.requiresPkce).toBe(true);
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
});
