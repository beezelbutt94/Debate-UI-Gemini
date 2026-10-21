import { describe, it, expect } from 'vitest';
import {
  generateState,
  stateCookieName,
  generateCodeVerifier,
  codeChallengeFromVerifier,
  codeVerifierCookieName,
} from '@/lib/oauth/state';
import { isOAuthPlatform } from '@/lib/oauth/types';

describe('generateState()', () => {
  it('returns a non-empty string', () => {
    expect(generateState().length).toBeGreaterThan(0);
  });

  it('returns a base64url-safe string (no +, /, or =)', () => {
    const state = generateState();
    expect(state).not.toMatch(/[+/=]/);
  });

  it('returns different values on successive calls', () => {
    const a = generateState();
    const b = generateState();
    expect(a).not.toBe(b);
  });

  it('returns a string of expected length (24 random bytes → 32 base64url chars)', () => {
    // randomBytes(24).toString('base64url') produces ceil(24*4/3) = 32 chars
    expect(generateState()).toHaveLength(32);
  });
});

describe('stateCookieName()', () => {
  it('returns correct name for youtube', () => {
    expect(stateCookieName('youtube')).toBe('oauth_state_youtube');
  });

  it('returns correct name for tiktok', () => {
    expect(stateCookieName('tiktok')).toBe('oauth_state_tiktok');
  });

  it('returns correct name for facebook', () => {
    expect(stateCookieName('facebook')).toBe('oauth_state_facebook');
  });

  it('returns correct name for canva', () => {
    expect(stateCookieName('canva')).toBe('oauth_state_canva');
  });

  it('uses the platform name verbatim in the cookie name', () => {
    expect(stateCookieName('custom_platform')).toBe('oauth_state_custom_platform');
  });
});

describe('generateCodeVerifier()', () => {
  it('returns a non-empty string', () => {
    expect(generateCodeVerifier().length).toBeGreaterThan(0);
  });

  it('returns a base64url-safe string (no +, /, or =)', () => {
    const verifier = generateCodeVerifier();
    expect(verifier).not.toMatch(/[+/=]/);
  });

  it('returns different values on successive calls', () => {
    const a = generateCodeVerifier();
    const b = generateCodeVerifier();
    expect(a).not.toBe(b);
  });

  it('returns a string of expected length (32 random bytes → 43 base64url chars)', () => {
    // randomBytes(32).toString('base64url'): ceil(32*4/3)=43 chars (no padding)
    expect(generateCodeVerifier()).toHaveLength(43);
  });
});

describe('codeChallengeFromVerifier()', () => {
  it('returns a base64url-safe string', () => {
    const challenge = codeChallengeFromVerifier('hello');
    expect(challenge).not.toMatch(/[+/=]/);
  });

  it('is deterministic for the same input', () => {
    const a = codeChallengeFromVerifier('same_verifier');
    const b = codeChallengeFromVerifier('same_verifier');
    expect(a).toBe(b);
  });

  it('produces different outputs for different inputs', () => {
    const a = codeChallengeFromVerifier('verifier_one');
    const b = codeChallengeFromVerifier('verifier_two');
    expect(a).not.toBe(b);
  });

  it('produces a SHA-256 hash of the expected base64url length (43 chars)', () => {
    // SHA-256 digest is 32 bytes → 43 base64url chars
    expect(codeChallengeFromVerifier('any_string')).toHaveLength(43);
  });

  it('matches RFC 7636 known vector: verifier "dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk"', () => {
    // From RFC 7636 Appendix B:
    // code_verifier = "dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk"
    // expected code_challenge = "E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM"
    const challenge = codeChallengeFromVerifier('dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk');
    expect(challenge).toBe('E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM');
  });

  it('produces a valid challenge from a freshly generated verifier', () => {
    const verifier = generateCodeVerifier();
    const challenge = codeChallengeFromVerifier(verifier);
    expect(challenge.length).toBe(43);
    expect(challenge).not.toMatch(/[+/=]/);
  });
});

describe('codeVerifierCookieName()', () => {
  it('returns correct name for canva', () => {
    expect(codeVerifierCookieName('canva')).toBe('oauth_pkce_canva');
  });

  it('returns correct name for youtube', () => {
    expect(codeVerifierCookieName('youtube')).toBe('oauth_pkce_youtube');
  });

  it('uses the platform name verbatim', () => {
    expect(codeVerifierCookieName('tiktok')).toBe('oauth_pkce_tiktok');
  });
});

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

  it('rejects "instagram"', () => {
    expect(isOAuthPlatform('instagram')).toBe(false);
  });

  it('rejects empty string', () => {
    expect(isOAuthPlatform('')).toBe(false);
  });

  it('rejects a random string', () => {
    expect(isOAuthPlatform('twitter')).toBe(false);
  });

  it('is case-sensitive (rejects "YouTube")', () => {
    expect(isOAuthPlatform('YouTube')).toBe(false);
  });

  it('rejects "TIKTOK"', () => {
    expect(isOAuthPlatform('TIKTOK')).toBe(false);
  });

  it('rejects whitespace-padded platform name', () => {
    expect(isOAuthPlatform(' youtube')).toBe(false);
  });
});
