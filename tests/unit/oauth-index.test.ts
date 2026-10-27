import { describe, it, expect } from 'vitest';
import { getOAuthProvider } from '@/lib/oauth/index';

// getOAuthProvider is a pure lookup — no external calls happen on import.
// We only verify that the returned provider objects have the right shape,
// not that their methods work (those require network + real credentials).

describe('getOAuthProvider()', () => {
  const PLATFORMS = ['youtube', 'tiktok', 'facebook', 'canva'] as const;

  for (const platform of PLATFORMS) {
    it(`returns an OAuthProvider for "${platform}"`, () => {
      // Set any required env vars to a dummy value so requireEnv() doesn't
      // throw during the provider import itself. These providers only call
      // requireEnv() inside their methods, not at import time, so no value
      // is actually needed here.
      const provider = getOAuthProvider(platform);
      expect(provider).toBeDefined();
    });

    it(`"${platform}" provider has authorizationUrl method`, () => {
      const provider = getOAuthProvider(platform);
      expect(typeof provider.authorizationUrl).toBe('function');
    });

    it(`"${platform}" provider has exchangeCode method`, () => {
      const provider = getOAuthProvider(platform);
      expect(typeof provider.exchangeCode).toBe('function');
    });

    it(`"${platform}" provider has refreshAccessToken method`, () => {
      const provider = getOAuthProvider(platform);
      expect(typeof provider.refreshAccessToken).toBe('function');
    });

    it(`"${platform}" provider has requiresPkce boolean`, () => {
      const provider = getOAuthProvider(platform);
      expect(typeof provider.requiresPkce).toBe('boolean');
    });
  }

  it('canva requires PKCE', () => {
    expect(getOAuthProvider('canva').requiresPkce).toBe(true);
  });

  it('youtube does NOT require PKCE', () => {
    expect(getOAuthProvider('youtube').requiresPkce).toBe(false);
  });

  it('tiktok does NOT require PKCE', () => {
    expect(getOAuthProvider('tiktok').requiresPkce).toBe(false);
  });

  it('facebook does NOT require PKCE', () => {
    expect(getOAuthProvider('facebook').requiresPkce).toBe(false);
  });

  it('same call returns same provider reference (object identity)', () => {
    expect(getOAuthProvider('youtube')).toBe(getOAuthProvider('youtube'));
  });
});
