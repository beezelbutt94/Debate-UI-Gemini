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
    for (let i = 0; i < 20; i++) {
      const state = generateState();
      expect(state).toMatch(/^[A-Za-z0-9_-]+$/);
    }
  });

  it('produces unique values each call', () => {
    const values = new Set(Array.from({ length: 50 }, () => generateState()));
    expect(values.size).toBe(50);
  });

  it('has expected byte length (24 random bytes → 32 base64url chars)', () => {
    // 24 bytes → base64url length = ceil(24/3)*4 = 32 chars
    expect(generateState().length).toBe(32);
  });
});

describe('stateCookieName()', () => {
  it('formats the cookie name with platform', () => {
    expect(stateCookieName('youtube')).toBe('oauth_state_youtube');
  });

  it('formats for tiktok', () => {
    expect(stateCookieName('tiktok')).toBe('oauth_state_tiktok');
  });

  it('formats for facebook', () => {
    expect(stateCookieName('facebook')).toBe('oauth_state_facebook');
  });

  it('formats for canva', () => {
    expect(stateCookieName('canva')).toBe('oauth_state_canva');
  });

  it('handles arbitrary platform strings', () => {
    expect(stateCookieName('custom_platform')).toBe('oauth_state_custom_platform');
  });
});

describe('generateCodeVerifier()', () => {
  it('returns a base64url-safe string', () => {
    for (let i = 0; i < 20; i++) {
      expect(generateCodeVerifier()).toMatch(/^[A-Za-z0-9_-]+$/);
    }
  });

  it('produces unique values each call', () => {
    const values = new Set(Array.from({ length: 50 }, () => generateCodeVerifier()));
    expect(values.size).toBe(50);
  });

  it('has expected byte length (32 random bytes → ~43 base64url chars)', () => {
    // 32 bytes → base64url without padding = 43 chars
    expect(generateCodeVerifier().length).toBe(43);
  });
});

describe('codeChallengeFromVerifier()', () => {
  it('returns a base64url-safe string', () => {
    const challenge = codeChallengeFromVerifier('test-verifier');
    expect(challenge).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  it('is deterministic for the same input', () => {
    const v = 'my-code-verifier-abc123';
    expect(codeChallengeFromVerifier(v)).toBe(codeChallengeFromVerifier(v));
  });

  it('matches the SHA-256 base64url spec (RFC 7636)', () => {
    const verifier = 'dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk';
    const expected = createHash('sha256').update(verifier).digest('base64url');
    expect(codeChallengeFromVerifier(verifier)).toBe(expected);
  });

  it('produces different challenges for different verifiers', () => {
    const a = codeChallengeFromVerifier('verifier-one');
    const b = codeChallengeFromVerifier('verifier-two');
    expect(a).not.toBe(b);
  });

  it('has expected length (SHA-256 output → 43 base64url chars without padding)', () => {
    expect(codeChallengeFromVerifier('any-verifier').length).toBe(43);
  });

  it('round-trips: challenge derived from generated verifier is valid base64url', () => {
    const verifier = generateCodeVerifier();
    const challenge = codeChallengeFromVerifier(verifier);
    expect(challenge).toMatch(/^[A-Za-z0-9_-]+$/);
  });
});

describe('codeVerifierCookieName()', () => {
  it('formats the cookie name with platform', () => {
    expect(codeVerifierCookieName('canva')).toBe('oauth_pkce_canva');
  });

  it('formats for youtube', () => {
    expect(codeVerifierCookieName('youtube')).toBe('oauth_pkce_youtube');
  });

  it('handles arbitrary strings', () => {
    expect(codeVerifierCookieName('test_provider')).toBe('oauth_pkce_test_provider');
  });
});
