import { describe, it, expect } from 'vitest';
import { isOAuthPlatform } from '@/lib/oauth/types';
import { getOAuthProvider } from '@/lib/oauth';

// ── isOAuthPlatform ─────────────────────────────────────────────────────────

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

  it('rejects "instagram" (not a supported OAuth platform)', () => {
    expect(isOAuthPlatform('instagram')).toBe(false);
  });

  it('rejects an empty string', () => {
    expect(isOAuthPlatform('')).toBe(false);
  });

  it('is case-sensitive: rejects "YouTube"', () => {
    expect(isOAuthPlatform('YouTube')).toBe(false);
  });

  it('is case-sensitive: rejects "TIKTOK"', () => {
    expect(isOAuthPlatform('TIKTOK')).toBe(false);
  });

  it('rejects "twitter"', () => {
    expect(isOAuthPlatform('twitter')).toBe(false);
  });

  it('rejects random string', () => {
    expect(isOAuthPlatform('notaplatform')).toBe(false);
  });
});

// ── getOAuthProvider ────────────────────────────────────────────────────────

describe('getOAuthProvider()', () => {
  const PLATFORMS = ['youtube', 'tiktok', 'facebook', 'canva'] as const;

  for (const platform of PLATFORMS) {
    describe(`platform: ${platform}`, () => {
      const provider = getOAuthProvider(platform);

      it('returns a provider object', () => {
        expect(provider).toBeDefined();
        expect(typeof provider).toBe('object');
      });

      it('exposes requiresPkce boolean', () => {
        expect(typeof provider.requiresPkce).toBe('boolean');
      });

      it('exposes authorizationUrl function', () => {
        expect(typeof provider.authorizationUrl).toBe('function');
      });

      it('exposes exchangeCode function', () => {
        expect(typeof provider.exchangeCode).toBe('function');
      });

      it('exposes refreshAccessToken function', () => {
        expect(typeof provider.refreshAccessToken).toBe('function');
      });
    });
  }

  it('youtube provider does NOT require PKCE', () => {
    expect(getOAuthProvider('youtube').requiresPkce).toBe(false);
  });

  it('tiktok provider does NOT require PKCE', () => {
    expect(getOAuthProvider('tiktok').requiresPkce).toBe(false);
  });

  it('facebook provider does NOT require PKCE', () => {
    expect(getOAuthProvider('facebook').requiresPkce).toBe(false);
  });

  it('canva provider REQUIRES PKCE', () => {
    expect(getOAuthProvider('canva').requiresPkce).toBe(true);
  });
});
