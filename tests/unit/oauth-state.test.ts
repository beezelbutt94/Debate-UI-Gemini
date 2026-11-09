import { describe, it, expect } from 'vitest';
import {
  generateState,
  stateCookieName,
  generateCodeVerifier,
  codeChallengeFromVerifier,
  codeVerifierCookieName,
} from '@/lib/oauth/state';
import { createHash } from 'crypto';

describe('generateState', () => {
  it('returns a non-empty string', () => {
    expect(generateState()).toBeTruthy();
    expect(typeof generateState()).toBe('string');
  });

  it('produces a URL-safe base64 string (no +, /, or = characters)', () => {
    for (let i = 0; i < 20; i++) {
      const state = generateState();
      expect(state).not.toMatch(/[+/=]/);
    }
  });

  it('generates unique values on each call', () => {
    const states = new Set(Array.from({ length: 50 }, () => generateState()));
    // All 50 should be unique given 192-bit randomness
    expect(states.size).toBe(50);
  });

  it('has sufficient length for CSRF protection (≥32 chars)', () => {
    // 24 random bytes → 32 base64url chars
    const state = generateState();
    expect(state.length).toBeGreaterThanOrEqual(32);
  });
});

describe('stateCookieName', () => {
  it('returns expected format for youtube', () => {
    expect(stateCookieName('youtube')).toBe('oauth_state_youtube');
  });

  it('returns expected format for tiktok', () => {
    expect(stateCookieName('tiktok')).toBe('oauth_state_tiktok');
  });

  it('returns expected format for facebook', () => {
    expect(stateCookieName('facebook')).toBe('oauth_state_facebook');
  });

  it('returns expected format for canva', () => {
    expect(stateCookieName('canva')).toBe('oauth_state_canva');
  });

  it('handles arbitrary platform string', () => {
    expect(stateCookieName('newplatform')).toBe('oauth_state_newplatform');
  });

  it('is deterministic — same input always gives same output', () => {
    expect(stateCookieName('youtube')).toBe(stateCookieName('youtube'));
  });
});

describe('generateCodeVerifier', () => {
  it('returns a non-empty string', () => {
    expect(generateCodeVerifier()).toBeTruthy();
    expect(typeof generateCodeVerifier()).toBe('string');
  });

  it('produces a URL-safe base64 string (no +, /, or = characters)', () => {
    for (let i = 0; i < 20; i++) {
      const verifier = generateCodeVerifier();
      expect(verifier).not.toMatch(/[+/=]/);
    }
  });

  it('generates unique values on each call', () => {
    const verifiers = new Set(Array.from({ length: 50 }, () => generateCodeVerifier()));
    expect(verifiers.size).toBe(50);
  });

  it('meets RFC 7636 minimum length requirement (≥43 chars)', () => {
    // 32 bytes → 43 base64url chars
    const verifier = generateCodeVerifier();
    expect(verifier.length).toBeGreaterThanOrEqual(43);
  });

  it('meets RFC 7636 maximum length requirement (≤128 chars)', () => {
    const verifier = generateCodeVerifier();
    expect(verifier.length).toBeLessThanOrEqual(128);
  });
});

describe('codeChallengeFromVerifier', () => {
  it('returns a non-empty string', () => {
    expect(codeChallengeFromVerifier('someVerifier')).toBeTruthy();
  });

  it('produces the correct SHA-256 base64url challenge', () => {
    const verifier = 'dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk';
    const expected = createHash('sha256').update(verifier).digest('base64url');
    expect(codeChallengeFromVerifier(verifier)).toBe(expected);
  });

  it('is deterministic — same verifier always gives same challenge', () => {
    const verifier = generateCodeVerifier();
    expect(codeChallengeFromVerifier(verifier)).toBe(codeChallengeFromVerifier(verifier));
  });

  it('produces URL-safe base64 (no +, /, or = characters)', () => {
    for (let i = 0; i < 20; i++) {
      const challenge = codeChallengeFromVerifier(generateCodeVerifier());
      expect(challenge).not.toMatch(/[+/=]/);
    }
  });

  it('different verifiers produce different challenges', () => {
    const v1 = generateCodeVerifier();
    const v2 = generateCodeVerifier();
    expect(codeChallengeFromVerifier(v1)).not.toBe(codeChallengeFromVerifier(v2));
  });

  it('round-trip: challenge from real verifier can be verified independently', () => {
    const verifier = generateCodeVerifier();
    const challenge = codeChallengeFromVerifier(verifier);
    const independentChallenge = createHash('sha256').update(verifier).digest('base64url');
    expect(challenge).toBe(independentChallenge);
  });

  it('handles empty string input', () => {
    const expected = createHash('sha256').update('').digest('base64url');
    expect(codeChallengeFromVerifier('')).toBe(expected);
  });
});

describe('codeVerifierCookieName', () => {
  it('returns expected format for canva', () => {
    expect(codeVerifierCookieName('canva')).toBe('oauth_pkce_canva');
  });

  it('returns expected format for youtube', () => {
    expect(codeVerifierCookieName('youtube')).toBe('oauth_pkce_youtube');
  });

  it('returns expected format for tiktok', () => {
    expect(codeVerifierCookieName('tiktok')).toBe('oauth_pkce_tiktok');
  });

  it('is deterministic', () => {
    expect(codeVerifierCookieName('canva')).toBe(codeVerifierCookieName('canva'));
  });

  it('handles arbitrary platform string', () => {
    expect(codeVerifierCookieName('future-platform')).toBe('oauth_pkce_future-platform');
  });
});
