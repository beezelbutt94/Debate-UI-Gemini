import { describe, it, expect } from 'vitest';
import {
  generateState,
  stateCookieName,
  generateCodeVerifier,
  codeChallengeFromVerifier,
  codeVerifierCookieName,
} from '@/lib/oauth/state';
import { isOAuthPlatform } from '@/lib/oauth/types';
import { getOAuthProvider } from '@/lib/oauth';
import { createHash } from 'crypto';

// ── generateState ─────────────────────────────────────────────────────────────

describe('generateState', () => {
  it('returns a non-empty string', () => {
    expect(generateState().length).toBeGreaterThan(0);
  });

  it('produces URL-safe base64 characters only', () => {
    for (let i = 0; i < 20; i++) {
      expect(generateState()).toMatch(/^[A-Za-z0-9_-]+$/);
    }
  });

  it('produces unique values each call', () => {
    const states = new Set(Array.from({ length: 100 }, generateState));
    expect(states.size).toBe(100);
  });

  it('length is consistent (24 random bytes → 32-char base64url)', () => {
    for (let i = 0; i < 10; i++) {
      expect(generateState().length).toBe(32);
    }
  });
});

// ── stateCookieName ───────────────────────────────────────────────────────────

describe('stateCookieName', () => {
  it('returns correctly formatted name for youtube', () => {
    expect(stateCookieName('youtube')).toBe('oauth_state_youtube');
  });

  it('returns correctly formatted name for tiktok', () => {
    expect(stateCookieName('tiktok')).toBe('oauth_state_tiktok');
  });

  it('returns correctly formatted name for facebook', () => {
    expect(stateCookieName('facebook')).toBe('oauth_state_facebook');
  });

  it('returns correctly formatted name for canva', () => {
    expect(stateCookieName('canva')).toBe('oauth_state_canva');
  });

  it('always has oauth_state_ prefix', () => {
    expect(stateCookieName('newplatform')).toMatch(/^oauth_state_/);
  });
});

// ── generateCodeVerifier ──────────────────────────────────────────────────────

describe('generateCodeVerifier', () => {
  it('returns a non-empty URL-safe base64 string', () => {
    for (let i = 0; i < 10; i++) {
      expect(generateCodeVerifier()).toMatch(/^[A-Za-z0-9_-]+$/);
    }
  });

  it('produces unique values each call', () => {
    const verifiers = new Set(Array.from({ length: 50 }, generateCodeVerifier));
    expect(verifiers.size).toBe(50);
  });

  it('length matches 32 random bytes encoded as base64url (43 chars)', () => {
    for (let i = 0; i < 10; i++) {
      expect(generateCodeVerifier().length).toBe(43);
    }
  });
});

// ── codeChallengeFromVerifier ─────────────────────────────────────────────────

describe('codeChallengeFromVerifier', () => {
  it('returns a non-empty string', () => {
    expect(codeChallengeFromVerifier('abc').length).toBeGreaterThan(0);
  });

  it('matches SHA-256 base64url of the verifier', () => {
    const verifier = 'test_verifier_string_12345';
    const expected = createHash('sha256').update(verifier).digest('base64url');
    expect(codeChallengeFromVerifier(verifier)).toBe(expected);
  });

  it('is deterministic for the same input', () => {
    const v = generateCodeVerifier();
    expect(codeChallengeFromVerifier(v)).toBe(codeChallengeFromVerifier(v));
  });

  it('differs for different inputs', () => {
    expect(codeChallengeFromVerifier('aaa')).not.toBe(codeChallengeFromVerifier('bbb'));
  });

  it('is URL-safe base64 (no +, / or = padding)', () => {
    for (let i = 0; i < 20; i++) {
      const challenge = codeChallengeFromVerifier(generateCodeVerifier());
      expect(challenge).toMatch(/^[A-Za-z0-9_-]+$/);
    }
  });

  it('round-trips: challenge from verifier matches independent SHA-256 computation', () => {
    const verifier = generateCodeVerifier();
    const challenge = codeChallengeFromVerifier(verifier);
    const independent = createHash('sha256').update(verifier).digest('base64url');
    expect(challenge).toBe(independent);
  });
});

// ── codeVerifierCookieName ────────────────────────────────────────────────────

describe('codeVerifierCookieName', () => {
  it('returns correctly formatted name for canva', () => {
    expect(codeVerifierCookieName('canva')).toBe('oauth_pkce_canva');
  });

  it('always has oauth_pkce_ prefix', () => {
    expect(codeVerifierCookieName('youtube')).toMatch(/^oauth_pkce_/);
  });

  it('includes the platform name', () => {
    expect(codeVerifierCookieName('tiktok')).toBe('oauth_pkce_tiktok');
  });
});

// ── isOAuthPlatform ───────────────────────────────────────────────────────────

describe('isOAuthPlatform', () => {
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

  it('returns false for instagram', () => {
    expect(isOAuthPlatform('instagram')).toBe(false);
  });

  it('returns false for twitter', () => {
    expect(isOAuthPlatform('twitter')).toBe(false);
  });

  it('returns false for empty string', () => {
    expect(isOAuthPlatform('')).toBe(false);
  });

  it('returns false for uppercase variant', () => {
    expect(isOAuthPlatform('YouTube')).toBe(false);
  });

  it('returns false for arbitrary string', () => {
    expect(isOAuthPlatform('someplatform')).toBe(false);
  });
});

// ── getOAuthProvider ──────────────────────────────────────────────────────────

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

  it('youtube provider does not require PKCE', () => {
    expect(getOAuthProvider('youtube').requiresPkce).toBe(false);
  });

  it('tiktok provider does not require PKCE', () => {
    expect(getOAuthProvider('tiktok').requiresPkce).toBe(false);
  });

  it('canva provider requires PKCE', () => {
    expect(getOAuthProvider('canva').requiresPkce).toBe(true);
  });

  it('facebook provider does not require PKCE', () => {
    expect(getOAuthProvider('facebook').requiresPkce).toBe(false);
  });
});
