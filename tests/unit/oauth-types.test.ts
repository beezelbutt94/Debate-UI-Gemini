import { describe, it, expect } from 'vitest';
import { isOAuthPlatform, getOAuthProvider } from '@/lib/oauth/index';

describe('isOAuthPlatform()', () => {
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

  it('returns false for an unknown platform string', () => {
    expect(isOAuthPlatform('instagram')).toBe(false);
  });

  it('returns false for an empty string', () => {
    expect(isOAuthPlatform('')).toBe(false);
  });

  it('returns false for a capitalized version', () => {
    expect(isOAuthPlatform('YouTube')).toBe(false);
  });

  it('returns false for a partial match', () => {
    expect(isOAuthPlatform('you')).toBe(false);
  });

  it('returns false for "twitter"', () => {
    expect(isOAuthPlatform('twitter')).toBe(false);
  });

  it('returns false for a numeric string', () => {
    expect(isOAuthPlatform('123')).toBe(false);
  });

  it('is exhaustive — covers all 4 valid platforms', () => {
    const valid = ['youtube', 'tiktok', 'facebook', 'canva'];
    for (const p of valid) {
      expect(isOAuthPlatform(p)).toBe(true);
    }
  });
});

describe('getOAuthProvider()', () => {
  const platforms = ['youtube', 'tiktok', 'facebook', 'canva'] as const;

  for (const platform of platforms) {
    it(`returns a provider object for "${platform}"`, () => {
      const provider = getOAuthProvider(platform);
      expect(provider).toBeTruthy();
    });

    it(`"${platform}" provider has a boolean requiresPkce field`, () => {
      const provider = getOAuthProvider(platform);
      expect(typeof provider.requiresPkce).toBe('boolean');
    });

    it(`"${platform}" provider has an authorizationUrl function`, () => {
      const provider = getOAuthProvider(platform);
      expect(typeof provider.authorizationUrl).toBe('function');
    });

    it(`"${platform}" provider has an exchangeCode function`, () => {
      const provider = getOAuthProvider(platform);
      expect(typeof provider.exchangeCode).toBe('function');
    });

    it(`"${platform}" provider has a refreshAccessToken function`, () => {
      const provider = getOAuthProvider(platform);
      expect(typeof provider.refreshAccessToken).toBe('function');
    });
  }

  it('only canva requires PKCE', () => {
    expect(getOAuthProvider('canva').requiresPkce).toBe(true);
    expect(getOAuthProvider('youtube').requiresPkce).toBe(false);
    expect(getOAuthProvider('tiktok').requiresPkce).toBe(false);
    expect(getOAuthProvider('facebook').requiresPkce).toBe(false);
  });

  it('returns the same provider object on repeated calls (referential identity)', () => {
    expect(getOAuthProvider('youtube')).toBe(getOAuthProvider('youtube'));
  });
});
