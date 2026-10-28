import { describe, it, expect } from 'vitest';
import {
  generateState,
  stateCookieName,
  generateCodeVerifier,
  codeChallengeFromVerifier,
  codeVerifierCookieName,
} from '@/lib/oauth/state';
import { createHash } from 'crypto';

// ---------------------------------------------------------------------------
// generateState
// ---------------------------------------------------------------------------
describe('generateState()', () => {
  it('returns a non-empty string', () => {
    expect(generateState().length).toBeGreaterThan(0);
  });

  it('returns a base64url string (no +, /, = chars)', () => {
    const state = generateState();
    expect(state).not.toContain('+');
    expect(state).not.toContain('/');
    expect(state).not.toContain('=');
  });

  it('returns different values on successive calls', () => {
    const states = new Set(Array.from({ length: 50 }, generateState));
    expect(states.size).toBe(50);
  });

  it('has the expected length for 24 random bytes in base64url (32 chars)', () => {
    // 24 bytes → 32 base64 chars (24 * 4/3 = 32, no padding in base64url)
    expect(generateState().length).toBe(32);
  });
});

// ---------------------------------------------------------------------------
// stateCookieName
// ---------------------------------------------------------------------------
describe('stateCookieName()', () => {
  it('returns the expected cookie name for youtube', () => {
    expect(stateCookieName('youtube')).toBe('oauth_state_youtube');
  });

  it('returns the expected cookie name for tiktok', () => {
    expect(stateCookieName('tiktok')).toBe('oauth_state_tiktok');
  });

  it('returns the expected cookie name for facebook', () => {
    expect(stateCookieName('facebook')).toBe('oauth_state_facebook');
  });

  it('returns the expected cookie name for canva', () => {
    expect(stateCookieName('canva')).toBe('oauth_state_canva');
  });

  it('starts with "oauth_state_" prefix', () => {
    expect(stateCookieName('any-platform')).toMatch(/^oauth_state_/);
  });

  it('appends the platform verbatim', () => {
    expect(stateCookieName('custom_platform')).toBe('oauth_state_custom_platform');
  });
});

// ---------------------------------------------------------------------------
// generateCodeVerifier
// ---------------------------------------------------------------------------
describe('generateCodeVerifier()', () => {
  it('returns a non-empty string', () => {
    expect(generateCodeVerifier().length).toBeGreaterThan(0);
  });

  it('returns a base64url string (no +, /, = chars)', () => {
    const verifier = generateCodeVerifier();
    expect(verifier).not.toContain('+');
    expect(verifier).not.toContain('/');
    expect(verifier).not.toContain('=');
  });

  it('returns different values on successive calls', () => {
    const verifiers = new Set(Array.from({ length: 50 }, generateCodeVerifier));
    expect(verifiers.size).toBe(50);
  });

  it('has the expected length for 32 random bytes in base64url (43 chars)', () => {
    // 32 bytes → ceil(32 * 4/3) = 43 base64url chars (no padding)
    expect(generateCodeVerifier().length).toBe(43);
  });
});

// ---------------------------------------------------------------------------
// codeChallengeFromVerifier
// ---------------------------------------------------------------------------
describe('codeChallengeFromVerifier()', () => {
  it('returns a non-empty string', () => {
    const verifier = generateCodeVerifier();
    expect(codeChallengeFromVerifier(verifier).length).toBeGreaterThan(0);
  });

  it('returns a base64url string (no +, /, = chars)', () => {
    const challenge = codeChallengeFromVerifier(generateCodeVerifier());
    expect(challenge).not.toContain('+');
    expect(challenge).not.toContain('/');
    expect(challenge).not.toContain('=');
  });

  it('produces the correct SHA-256 hash of the verifier', () => {
    const verifier = 'test_verifier_string_for_pkce';
    const expected = createHash('sha256').update(verifier).digest('base64url');
    expect(codeChallengeFromVerifier(verifier)).toBe(expected);
  });

  it('is deterministic — same verifier always produces same challenge', () => {
    const verifier = generateCodeVerifier();
    const c1 = codeChallengeFromVerifier(verifier);
    const c2 = codeChallengeFromVerifier(verifier);
    expect(c1).toBe(c2);
  });

  it('different verifiers produce different challenges', () => {
    const v1 = generateCodeVerifier();
    const v2 = generateCodeVerifier();
    expect(codeChallengeFromVerifier(v1)).not.toBe(codeChallengeFromVerifier(v2));
  });

  it('challenge length is 43 chars (SHA-256 = 32 bytes → 43 base64url chars)', () => {
    expect(codeChallengeFromVerifier(generateCodeVerifier()).length).toBe(43);
  });

  it('works with an empty string verifier', () => {
    const expected = createHash('sha256').update('').digest('base64url');
    expect(codeChallengeFromVerifier('')).toBe(expected);
  });

  it('works with a fixed known value (RFC 7636 appendix B)', () => {
    // From RFC 7636 appendix B — code_verifier: dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk
    // SHA-256 base64url: E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM
    const verifier = 'dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk';
    const expected = 'E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM';
    expect(codeChallengeFromVerifier(verifier)).toBe(expected);
  });
});

// ---------------------------------------------------------------------------
// codeVerifierCookieName
// ---------------------------------------------------------------------------
describe('codeVerifierCookieName()', () => {
  it('returns the expected cookie name for canva', () => {
    expect(codeVerifierCookieName('canva')).toBe('oauth_pkce_canva');
  });

  it('returns the expected cookie name for youtube', () => {
    expect(codeVerifierCookieName('youtube')).toBe('oauth_pkce_youtube');
  });

  it('starts with "oauth_pkce_" prefix', () => {
    expect(codeVerifierCookieName('any')).toMatch(/^oauth_pkce_/);
  });

  it('appends the platform verbatim', () => {
    expect(codeVerifierCookieName('my-platform')).toBe('oauth_pkce_my-platform');
  });
});
