import { describe, it, expect } from 'vitest';
import { isOAuthPlatform, getOAuthProvider } from '@/lib/oauth';

describe('isOAuthPlatform()', () => {
  it('returns true for youtube', () => {
    expect(isOAuthPlatform('youtube')).toBe(true);
  });

  it('returns true for tiktok', () => {
    expect(isOAuthPlatform('tiktok')).toBe(true);
  });

  it('returns true for facebook', () => {
    expect(isOAuthPlatform('facebook')).toBe(true);
  });

  it('returns true for canva', () => {
    expect(isOAuthPlatform('canva')).toBe(true);
  });

  it('returns false for an unknown string', () => {
    expect(isOAuthPlatform('instagram')).toBe(false);
  });

  it('returns false for empty string', () => {
    expect(isOAuthPlatform('')).toBe(false);
  });

  it('returns false for a partially matching string', () => {
    expect(isOAuthPlatform('you')).toBe(false);
  });

  it('returns false for uppercase variants', () => {
    expect(isOAuthPlatform('YouTube')).toBe(false);
    expect(isOAuthPlatform('TIKTOK')).toBe(false);
  });

  it('returns false for random strings', () => {
    expect(isOAuthPlatform('twitter')).toBe(false);
    expect(isOAuthPlatform('linkedin')).toBe(false);
  });
});

describe('getOAuthProvider()', () => {
  it('returns a provider with the correct shape for youtube', () => {
    const p = getOAuthProvider('youtube');
    expect(typeof p.authorizationUrl).toBe('function');
    expect(typeof p.exchangeCode).toBe('function');
    expect(typeof p.refreshAccessToken).toBe('function');
    expect(typeof p.requiresPkce).toBe('boolean');
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

  it('canva provider DOES require PKCE', () => {
    expect(getOAuthProvider('canva').requiresPkce).toBe(true);
  });

  it('returns the same provider object on repeated calls (referential stability)', () => {
    expect(getOAuthProvider('youtube')).toBe(getOAuthProvider('youtube'));
  });
});
