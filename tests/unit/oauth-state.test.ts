import { describe, it, expect } from 'vitest';
import {
  generateState,
  stateCookieName,
  generateCodeVerifier,
  codeChallengeFromVerifier,
  codeVerifierCookieName,
} from '@/lib/oauth/state';
import { createHash } from 'crypto';

describe('generateState()', () => {
  it('returns a non-empty string', () => {
    expect(typeof generateState()).toBe('string');
    expect(generateState().length).toBeGreaterThan(0);
  });

  it('returns base64url-safe characters only', () => {
    const state = generateState();
    expect(state).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  it('produces unique values on each call', () => {
    const states = Array.from({ length: 50 }, () => generateState());
    const unique = new Set(states);
    expect(unique.size).toBe(50);
  });

  it('returns a string of sufficient length (≥ 20 chars from 24 random bytes)', () => {
    // 24 bytes base64url encoded = 32 chars
    expect(generateState().length).toBeGreaterThanOrEqual(20);
  });
});

describe('stateCookieName()', () => {
  it('prefixes with oauth_state_', () => {
    expect(stateCookieName('youtube')).toBe('oauth_state_youtube');
  });

  it('works for tiktok', () => {
    expect(stateCookieName('tiktok')).toBe('oauth_state_tiktok');
  });

  it('works for facebook', () => {
    expect(stateCookieName('facebook')).toBe('oauth_state_facebook');
  });

  it('works for canva', () => {
    expect(stateCookieName('canva')).toBe('oauth_state_canva');
  });

  it('preserves arbitrary platform strings', () => {
    expect(stateCookieName('custom-platform')).toBe('oauth_state_custom-platform');
  });
});

describe('generateCodeVerifier()', () => {
  it('returns a non-empty string', () => {
    expect(typeof generateCodeVerifier()).toBe('string');
    expect(generateCodeVerifier().length).toBeGreaterThan(0);
  });

  it('returns base64url-safe characters only', () => {
    const verifier = generateCodeVerifier();
    expect(verifier).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  it('produces unique values on each call', () => {
    const verifiers = Array.from({ length: 50 }, () => generateCodeVerifier());
    const unique = new Set(verifiers);
    expect(unique.size).toBe(50);
  });

  it('returns a string long enough for PKCE (RFC 7636 min 43 chars)', () => {
    // 32 bytes base64url = ~43 chars
    expect(generateCodeVerifier().length).toBeGreaterThanOrEqual(43);
  });
});

describe('codeChallengeFromVerifier()', () => {
  it('returns a non-empty string', () => {
    const verifier = generateCodeVerifier();
    expect(typeof codeChallengeFromVerifier(verifier)).toBe('string');
    expect(codeChallengeFromVerifier(verifier).length).toBeGreaterThan(0);
  });

  it('returns base64url-safe characters (S256 method)', () => {
    const verifier = generateCodeVerifier();
    const challenge = codeChallengeFromVerifier(verifier);
    expect(challenge).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  it('produces the correct SHA-256 base64url digest', () => {
    const verifier = 'test-verifier-string';
    const expected = createHash('sha256').update(verifier).digest('base64url');
    expect(codeChallengeFromVerifier(verifier)).toBe(expected);
  });

  it('is deterministic: same verifier → same challenge', () => {
    const verifier = generateCodeVerifier();
    expect(codeChallengeFromVerifier(verifier)).toBe(codeChallengeFromVerifier(verifier));
  });

  it('different verifiers produce different challenges', () => {
    const v1 = generateCodeVerifier();
    const v2 = generateCodeVerifier();
    expect(codeChallengeFromVerifier(v1)).not.toBe(codeChallengeFromVerifier(v2));
  });

  it('produces a 43-char base64url string from 32-byte SHA-256 (no padding)', () => {
    const challenge = codeChallengeFromVerifier('any-string');
    expect(challenge.length).toBe(43);
  });

  it('does not contain + or / (must be base64url, not standard base64)', () => {
    for (let i = 0; i < 20; i++) {
      const challenge = codeChallengeFromVerifier(generateCodeVerifier());
      expect(challenge).not.toMatch(/[+/=]/);
    }
  });
});

describe('codeVerifierCookieName()', () => {
  it('prefixes with oauth_pkce_', () => {
    expect(codeVerifierCookieName('canva')).toBe('oauth_pkce_canva');
  });

  it('works for youtube', () => {
    expect(codeVerifierCookieName('youtube')).toBe('oauth_pkce_youtube');
  });

  it('works for tiktok', () => {
    expect(codeVerifierCookieName('tiktok')).toBe('oauth_pkce_tiktok');
  });

  it('preserves arbitrary platform strings', () => {
    expect(codeVerifierCookieName('my-provider')).toBe('oauth_pkce_my-provider');
  });
});
