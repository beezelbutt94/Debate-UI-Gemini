import { describe, it, expect } from 'vitest';
import {
  generateState,
  stateCookieName,
  generateCodeVerifier,
  codeChallengeFromVerifier,
  codeVerifierCookieName,
} from '@/lib/oauth/state';

// base64url alphabet: A-Z a-z 0-9 - _  (no + / =)
const BASE64URL_RE = /^[A-Za-z0-9_-]+$/;

describe('generateState()', () => {
  it('returns a non-empty string', () => {
    expect(generateState()).toBeTruthy();
  });

  it('returns a base64url-safe string (no +, /, or = chars)', () => {
    expect(generateState()).toMatch(BASE64URL_RE);
  });

  it('returns a string of the expected minimum length (24 bytes → 32 base64url chars)', () => {
    // randomBytes(24).toString('base64url') → Math.ceil(24 * 4/3) = 32 chars
    expect(generateState().length).toBeGreaterThanOrEqual(32);
  });

  it('returns different values on successive calls (randomness)', () => {
    const values = new Set(Array.from({ length: 10 }, () => generateState()));
    expect(values.size).toBe(10);
  });
});

describe('stateCookieName()', () => {
  it('returns the correct cookie name for youtube', () => {
    expect(stateCookieName('youtube')).toBe('oauth_state_youtube');
  });

  it('returns the correct cookie name for tiktok', () => {
    expect(stateCookieName('tiktok')).toBe('oauth_state_tiktok');
  });

  it('returns the correct cookie name for facebook', () => {
    expect(stateCookieName('facebook')).toBe('oauth_state_facebook');
  });

  it('returns the correct cookie name for canva', () => {
    expect(stateCookieName('canva')).toBe('oauth_state_canva');
  });

  it('includes the platform name in the cookie name', () => {
    const platform = 'my_custom_platform';
    expect(stateCookieName(platform)).toContain(platform);
  });
});

describe('generateCodeVerifier()', () => {
  it('returns a non-empty string', () => {
    expect(generateCodeVerifier()).toBeTruthy();
  });

  it('returns a base64url-safe string', () => {
    expect(generateCodeVerifier()).toMatch(BASE64URL_RE);
  });

  it('returns a string of the expected minimum length (32 bytes → ~43 base64url chars)', () => {
    // randomBytes(32).toString('base64url') → Math.ceil(32 * 4/3) = 43 chars
    expect(generateCodeVerifier().length).toBeGreaterThanOrEqual(43);
  });

  it('returns different values on successive calls', () => {
    const values = new Set(Array.from({ length: 10 }, () => generateCodeVerifier()));
    expect(values.size).toBe(10);
  });
});

describe('codeChallengeFromVerifier()', () => {
  it('returns a base64url-safe string', () => {
    expect(codeChallengeFromVerifier('some-verifier')).toMatch(BASE64URL_RE);
  });

  it('is deterministic for the same input', () => {
    const verifier = 'fixed-verifier-string';
    expect(codeChallengeFromVerifier(verifier)).toBe(codeChallengeFromVerifier(verifier));
  });

  it('produces different challenges for different verifiers', () => {
    expect(codeChallengeFromVerifier('verifier-a')).not.toBe(codeChallengeFromVerifier('verifier-b'));
  });

  it('produces a SHA-256 hash of expected length (43 chars base64url)', () => {
    // SHA-256 = 32 bytes → 43 base64url chars
    expect(codeChallengeFromVerifier('any-verifier').length).toBe(43);
  });

  it('matches RFC 7636 S256 challenge for a known verifier', () => {
    // Computed independently: SHA-256('dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk') → known value
    // Use a real test vector from RFC 7636 Appendix B:
    // verifier: dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk
    // challenge: E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM
    const verifier = 'dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk';
    const expectedChallenge = 'E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM';
    expect(codeChallengeFromVerifier(verifier)).toBe(expectedChallenge);
  });
});

describe('codeVerifierCookieName()', () => {
  it('returns the correct cookie name for canva', () => {
    expect(codeVerifierCookieName('canva')).toBe('oauth_pkce_canva');
  });

  it('returns the correct cookie name for youtube', () => {
    expect(codeVerifierCookieName('youtube')).toBe('oauth_pkce_youtube');
  });

  it('includes the platform name in the result', () => {
    const platform = 'any_platform';
    expect(codeVerifierCookieName(platform)).toContain(platform);
  });

  it('uses "oauth_pkce_" prefix', () => {
    expect(codeVerifierCookieName('test')).toBe('oauth_pkce_test');
  });
});
