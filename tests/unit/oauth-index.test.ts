import { describe, it, expect, beforeEach } from 'vitest';
import { getOAuthProvider } from '@/lib/oauth';
import type { OAuthPlatform } from '@/lib/oauth/types';

// These tests verify that the provider registry is wired up correctly and that
// each provider exposes the expected contract (requiresPkce, authorizationUrl,
// exchangeCode, refreshAccessToken). The actual OAuth round-trips (exchangeCode,
// refreshAccessToken) hit live APIs and are not exercised here.

describe('getOAuthProvider()', () => {
  const platforms: OAuthPlatform[] = ['youtube', 'tiktok', 'facebook', 'canva'];

  it('returns a provider object for every supported platform', () => {
    for (const platform of platforms) {
      const provider = getOAuthProvider(platform);
      expect(provider).toBeDefined();
    }
  });

  it('each provider has a boolean requiresPkce field', () => {
    for (const platform of platforms) {
      const provider = getOAuthProvider(platform);
      expect(typeof provider.requiresPkce).toBe('boolean');
    }
  });

  it('each provider has an authorizationUrl function', () => {
    for (const platform of platforms) {
      const provider = getOAuthProvider(platform);
      expect(typeof provider.authorizationUrl).toBe('function');
    }
  });

  it('each provider has an exchangeCode function', () => {
    for (const platform of platforms) {
      const provider = getOAuthProvider(platform);
      expect(typeof provider.exchangeCode).toBe('function');
    }
  });

  it('each provider has a refreshAccessToken function', () => {
    for (const platform of platforms) {
      const provider = getOAuthProvider(platform);
      expect(typeof provider.refreshAccessToken).toBe('function');
    }
  });

  it('only canva requires PKCE', () => {
    expect(getOAuthProvider('canva').requiresPkce).toBe(true);
    expect(getOAuthProvider('youtube').requiresPkce).toBe(false);
    expect(getOAuthProvider('tiktok').requiresPkce).toBe(false);
    expect(getOAuthProvider('facebook').requiresPkce).toBe(false);
  });

  // ── authorizationUrl shape tests (require env vars; set minimal stubs) ──────

  describe('authorizationUrl()', () => {
    beforeEach(() => {
      process.env.YOUTUBE_OAUTH_CLIENT_ID = 'yt-client-id';
      process.env.TIKTOK_OAUTH_CLIENT_KEY = 'tt-client-key';
      process.env.FACEBOOK_APP_ID = 'fb-app-id';
      process.env.CANVA_CLIENT_ID = 'canva-client-id';
      process.env.CANVA_CLIENT_SECRET = 'canva-client-secret';
    });

    it('youtube authorizationUrl contains redirect_uri, state, and scope', () => {
      const url = getOAuthProvider('youtube').authorizationUrl({
        state: 'test-state',
        redirectUri: 'https://app.example.com/callback',
      });
      expect(url).toContain('redirect_uri=');
      expect(url).toContain('state=test-state');
      expect(url).toContain('scope=');
      expect(url).toContain('response_type=code');
      expect(url).toContain('access_type=offline');
    });

    it('youtube authorizationUrl points to Google accounts endpoint', () => {
      const url = getOAuthProvider('youtube').authorizationUrl({
        state: 'abc',
        redirectUri: 'https://app.example.com/callback',
      });
      expect(url).toContain('accounts.google.com');
    });

    it('tiktok authorizationUrl contains client_key, scope, state', () => {
      const url = getOAuthProvider('tiktok').authorizationUrl({
        state: 'tiktok-state',
        redirectUri: 'https://app.example.com/callback',
      });
      expect(url).toContain('tiktok.com');
      expect(url).toContain('state=tiktok-state');
      expect(url).toContain('scope=');
    });

    it('facebook authorizationUrl contains client_id, scope, state', () => {
      const url = getOAuthProvider('facebook').authorizationUrl({
        state: 'fb-state',
        redirectUri: 'https://app.example.com/callback',
      });
      expect(url).toContain('facebook.com');
      expect(url).toContain('state=fb-state');
      expect(url).toContain('scope=');
    });

    it('canva authorizationUrl contains code_challenge and code_challenge_method=S256', () => {
      const url = getOAuthProvider('canva').authorizationUrl({
        state: 'canva-state',
        redirectUri: 'https://app.example.com/callback',
        codeChallenge: 'test-challenge-value',
      });
      expect(url).toContain('canva.com');
      expect(url).toContain('code_challenge=test-challenge-value');
      expect(url).toContain('code_challenge_method=S256');
    });

    it('authorizationUrl returns a valid URL for every provider', () => {
      const params = { state: 's', redirectUri: 'https://example.com/cb', codeChallenge: 'ch' };
      for (const platform of platforms) {
        const url = getOAuthProvider(platform).authorizationUrl(params);
        expect(() => new URL(url)).not.toThrow();
      }
    });
  });
});
