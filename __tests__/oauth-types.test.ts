import { describe, it, expect } from 'vitest';
import { isOAuthPlatform, getOAuthProvider } from '@/lib/oauth/index';

describe('isOAuthPlatform()', () => {
  it('accepts "youtube"', () => {
    expect(isOAuthPlatform('youtube')).toBe(true);
  });

  it('accepts "tiktok"', () => {
    expect(isOAuthPlatform('tiktok')).toBe(true);
  });

  it('accepts "facebook"', () => {
    expect(isOAuthPlatform('facebook')).toBe(true);
  });

  it('accepts "canva"', () => {
    expect(isOAuthPlatform('canva')).toBe(true);
  });

  it('rejects an unknown platform', () => {
    expect(isOAuthPlatform('instagram')).toBe(false);
  });

  it('rejects an empty string', () => {
    expect(isOAuthPlatform('')).toBe(false);
  });

  it('rejects a partially-matching string', () => {
    expect(isOAuthPlatform('you')).toBe(false);
  });

  it('rejects a value with uppercase', () => {
    expect(isOAuthPlatform('YouTube')).toBe(false);
  });

  it('rejects a numeric-like string', () => {
    expect(isOAuthPlatform('123')).toBe(false);
  });
});

describe('getOAuthProvider()', () => {
  const platforms = ['youtube', 'tiktok', 'facebook', 'canva'] as const;

  for (const platform of platforms) {
    it(`returns a provider for "${platform}"`, () => {
      const provider = getOAuthProvider(platform);
      expect(provider).toBeDefined();
      expect(typeof provider.authorizationUrl).toBe('function');
      expect(typeof provider.exchangeCode).toBe('function');
      expect(typeof provider.refreshAccessToken).toBe('function');
      expect(typeof provider.requiresPkce).toBe('boolean');
    });
  }

  it('canva provider requiresPkce is true', () => {
    expect(getOAuthProvider('canva').requiresPkce).toBe(true);
  });

  it('youtube provider requiresPkce is false', () => {
    expect(getOAuthProvider('youtube').requiresPkce).toBe(false);
  });

  it('tiktok provider requiresPkce is false', () => {
    expect(getOAuthProvider('tiktok').requiresPkce).toBe(false);
  });

  it('facebook provider requiresPkce is false', () => {
    expect(getOAuthProvider('facebook').requiresPkce).toBe(false);
  });
});
