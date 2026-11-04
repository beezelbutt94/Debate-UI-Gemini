import { describe, it, expect } from 'vitest';
import { isOAuthPlatform, getOAuthProvider } from '@/lib/oauth';

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

  it('returns false for empty string', () => {
    expect(isOAuthPlatform('')).toBe(false);
  });

  it('returns false for "YouTube" (case-sensitive)', () => {
    expect(isOAuthPlatform('YouTube')).toBe(false);
  });

  it('returns false for "tik_tok"', () => {
    expect(isOAuthPlatform('tik_tok')).toBe(false);
  });

  it('returns false for "twitter"', () => {
    expect(isOAuthPlatform('twitter')).toBe(false);
  });

  it('returns false for a random string', () => {
    expect(isOAuthPlatform('random_platform_xyz')).toBe(false);
  });
});

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

  it('youtube does not require PKCE', () => {
    expect(getOAuthProvider('youtube').requiresPkce).toBe(false);
  });

  it('tiktok does not require PKCE', () => {
    expect(getOAuthProvider('tiktok').requiresPkce).toBe(false);
  });

  it('facebook does not require PKCE', () => {
    expect(getOAuthProvider('facebook').requiresPkce).toBe(false);
  });

  it('canva requires PKCE', () => {
    expect(getOAuthProvider('canva').requiresPkce).toBe(true);
  });
});
