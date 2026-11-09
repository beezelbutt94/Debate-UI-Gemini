import { describe, it, expect } from 'vitest';
import { isOAuthPlatform, getOAuthProvider } from '@/lib/oauth';

describe('isOAuthPlatform()', () => {
  it('recognises youtube', () => {
    expect(isOAuthPlatform('youtube')).toBe(true);
  });

  it('recognises tiktok', () => {
    expect(isOAuthPlatform('tiktok')).toBe(true);
  });

  it('recognises facebook', () => {
    expect(isOAuthPlatform('facebook')).toBe(true);
  });

  it('recognises canva', () => {
    expect(isOAuthPlatform('canva')).toBe(true);
  });

  it('rejects instagram (account platform, not OAuth platform)', () => {
    expect(isOAuthPlatform('instagram')).toBe(false);
  });

  it('rejects twitter', () => {
    expect(isOAuthPlatform('twitter')).toBe(false);
  });

  it('rejects empty string', () => {
    expect(isOAuthPlatform('')).toBe(false);
  });

  it('rejects an arbitrary unknown string', () => {
    expect(isOAuthPlatform('snapchat')).toBe(false);
  });

  it('is case-sensitive (uppercased platforms are rejected)', () => {
    expect(isOAuthPlatform('YouTube')).toBe(false);
    expect(isOAuthPlatform('FACEBOOK')).toBe(false);
  });
});

describe('getOAuthProvider()', () => {
  const platforms = ['youtube', 'tiktok', 'facebook', 'canva'] as const;

  for (const platform of platforms) {
    it(`returns a provider object for ${platform}`, () => {
      const provider = getOAuthProvider(platform);
      expect(typeof provider).toBe('object');
      expect(provider).not.toBeNull();
    });

    it(`${platform} provider has an authorizationUrl function`, () => {
      const provider = getOAuthProvider(platform);
      expect(typeof provider.authorizationUrl).toBe('function');
    });

    it(`${platform} provider has an exchangeCode function`, () => {
      const provider = getOAuthProvider(platform);
      expect(typeof provider.exchangeCode).toBe('function');
    });

    it(`${platform} provider has a refreshAccessToken function`, () => {
      const provider = getOAuthProvider(platform);
      expect(typeof provider.refreshAccessToken).toBe('function');
    });

    it(`${platform} provider exposes a requiresPkce boolean`, () => {
      const provider = getOAuthProvider(platform);
      expect(typeof provider.requiresPkce).toBe('boolean');
    });
  }

  it('only canva requires PKCE', () => {
    expect(getOAuthProvider('canva').requiresPkce).toBe(true);
    expect(getOAuthProvider('youtube').requiresPkce).toBe(false);
    expect(getOAuthProvider('tiktok').requiresPkce).toBe(false);
    expect(getOAuthProvider('facebook').requiresPkce).toBe(false);
  });
});
