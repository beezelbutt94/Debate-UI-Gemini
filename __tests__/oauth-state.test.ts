import { describe, it, expect } from 'vitest';
import { createHash } from 'crypto';
import {
  generateState,
  stateCookieName,
  generateCodeVerifier,
  codeChallengeFromVerifier,
  codeVerifierCookieName,
} from '@/lib/oauth/state';
import { isOAuthPlatform } from '@/lib/oauth/types';

// ---------------------------------------------------------------------------
// generateState
// ---------------------------------------------------------------------------

describe('generateState()', () => {
  it('returns a non-empty string', () => {
    expect(generateState()).toBeTruthy();
  });

  it('returns a base64url-safe string (no +, /, or = characters)', () => {
    const state = generateState();
    expect(state).not.toMatch(/[+/=]/);
  });

  it('returns a string of the expected length for 24 random bytes (32 base64url chars)', () => {
    const state = generateState();
    expect(state.length).toBe(32);
  });

  it('returns different values on successive calls (random)', () => {
    const states = Array.from({ length: 20 }, () => generateState());
    const unique = new Set(states);
    expect(unique.size).toBe(20);
  });
});

// ---------------------------------------------------------------------------
// stateCookieName
// ---------------------------------------------------------------------------

describe('stateCookieName()', () => {
  it('returns expected name for youtube', () => {
    expect(stateCookieName('youtube')).toBe('oauth_state_youtube');
  });

  it('returns expected name for tiktok', () => {
    expect(stateCookieName('tiktok')).toBe('oauth_state_tiktok');
  });

  it('returns expected name for facebook', () => {
    expect(stateCookieName('facebook')).toBe('oauth_state_facebook');
  });

  it('returns expected name for canva', () => {
    expect(stateCookieName('canva')).toBe('oauth_state_canva');
  });

  it('uses the platform slug verbatim (no case conversion)', () => {
    expect(stateCookieName('MyPlatform')).toBe('oauth_state_MyPlatform');
  });
});

// ---------------------------------------------------------------------------
// generateCodeVerifier
// ---------------------------------------------------------------------------

describe('generateCodeVerifier()', () => {
  it('returns a non-empty string', () => {
    expect(generateCodeVerifier()).toBeTruthy();
  });

  it('returns a base64url-safe string', () => {
    const verifier = generateCodeVerifier();
    expect(verifier).not.toMatch(/[+/=]/);
  });

  it('returns a string of the expected length for 32 random bytes (43 base64url chars)', () => {
    const verifier = generateCodeVerifier();
    expect(verifier.length).toBe(43);
  });

  it('returns different values on successive calls', () => {
    const verifiers = Array.from({ length: 20 }, () => generateCodeVerifier());
    const unique = new Set(verifiers);
    expect(unique.size).toBe(20);
  });
});

// ---------------------------------------------------------------------------
// codeChallengeFromVerifier
// ---------------------------------------------------------------------------

describe('codeChallengeFromVerifier()', () => {
  it('returns a non-empty string', () => {
    expect(codeChallengeFromVerifier('some-verifier')).toBeTruthy();
  });

  it('returns a base64url string (no +, /, or = characters)', () => {
    const challenge = codeChallengeFromVerifier(generateCodeVerifier());
    expect(challenge).not.toMatch(/[+/=]/);
  });

  it('is deterministic for a given verifier', () => {
    const v = 'test-verifier-12345';
    expect(codeChallengeFromVerifier(v)).toBe(codeChallengeFromVerifier(v));
  });

  it('matches the expected SHA-256 digest for a known verifier', () => {
    const verifier = 'abc123';
    const expected = createHash('sha256').update(verifier).digest('base64url');
    expect(codeChallengeFromVerifier(verifier)).toBe(expected);
  });

  it('produces different challenges for different verifiers', () => {
    const c1 = codeChallengeFromVerifier('verifier-a');
    const c2 = codeChallengeFromVerifier('verifier-b');
    expect(c1).not.toBe(c2);
  });

  it('generates a valid challenge from a real code verifier', () => {
    const verifier = generateCodeVerifier();
    const challenge = codeChallengeFromVerifier(verifier);
    // SHA-256 of 32-byte base64url input → 32-byte digest → 43 base64url chars
    expect(challenge.length).toBe(43);
  });
});

// ---------------------------------------------------------------------------
// codeVerifierCookieName
// ---------------------------------------------------------------------------

describe('codeVerifierCookieName()', () => {
  it('returns expected name for canva', () => {
    expect(codeVerifierCookieName('canva')).toBe('oauth_pkce_canva');
  });

  it('returns expected name for youtube', () => {
    expect(codeVerifierCookieName('youtube')).toBe('oauth_pkce_youtube');
  });

  it('returns expected name for tiktok', () => {
    expect(codeVerifierCookieName('tiktok')).toBe('oauth_pkce_tiktok');
  });

  it('returns expected name for facebook', () => {
    expect(codeVerifierCookieName('facebook')).toBe('oauth_pkce_facebook');
  });
});

// ---------------------------------------------------------------------------
// isOAuthPlatform (type guard)
// ---------------------------------------------------------------------------

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

  it('returns false for "instagram" (not an OAuth platform)', () => {
    expect(isOAuthPlatform('instagram')).toBe(false);
  });

  it('returns false for "twitter"', () => {
    expect(isOAuthPlatform('twitter')).toBe(false);
  });

  it('returns false for empty string', () => {
    expect(isOAuthPlatform('')).toBe(false);
  });

  it('is case-sensitive — "YouTube" returns false', () => {
    expect(isOAuthPlatform('YouTube')).toBe(false);
  });

  it('is case-sensitive — "TIKTOK" returns false', () => {
    expect(isOAuthPlatform('TIKTOK')).toBe(false);
  });

  it('returns false for a random string', () => {
    expect(isOAuthPlatform('random-platform-xyz')).toBe(false);
  });

  it('returns false for "tiktok " (trailing space)', () => {
    expect(isOAuthPlatform('tiktok ')).toBe(false);
  });
});
