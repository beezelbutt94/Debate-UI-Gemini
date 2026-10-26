import { describe, it, expect } from 'vitest';
import {
  generateState,
  stateCookieName,
  generateCodeVerifier,
  codeChallengeFromVerifier,
  codeVerifierCookieName,
} from '@/lib/oauth/state';

describe('generateState', () => {
  it('returns a string', () => {
    expect(typeof generateState()).toBe('string');
  });

  it('returns a non-empty string', () => {
    expect(generateState().length).toBeGreaterThan(0);
  });

  it('returns a base64url-safe string (no +, /, =)', () => {
    const state = generateState();
    expect(state).not.toContain('+');
    expect(state).not.toContain('/');
    expect(state).not.toContain('=');
  });

  it('generates unique values each call', () => {
    const set = new Set(Array.from({ length: 20 }, () => generateState()));
    expect(set.size).toBe(20);
  });

  it('generates 32-char base64url from 24 random bytes', () => {
    // 24 bytes → ceil(24 * 4/3) = 32 chars in base64url
    const state = generateState();
    expect(state.length).toBe(32);
  });
});

describe('generateCodeVerifier', () => {
  it('returns a string', () => {
    expect(typeof generateCodeVerifier()).toBe('string');
  });

  it('returns a non-empty string', () => {
    expect(generateCodeVerifier().length).toBeGreaterThan(0);
  });

  it('is base64url-safe (no +, /, =)', () => {
    const v = generateCodeVerifier();
    expect(v).not.toContain('+');
    expect(v).not.toContain('/');
    expect(v).not.toContain('=');
  });

  it('generates unique values each call', () => {
    const set = new Set(Array.from({ length: 20 }, () => generateCodeVerifier()));
    expect(set.size).toBe(20);
  });

  it('generates 43-char base64url from 32 random bytes', () => {
    // 32 bytes → ceil(32 * 4/3) = 43 chars (base64url without padding)
    const v = generateCodeVerifier();
    expect(v.length).toBe(43);
  });
});

describe('codeChallengeFromVerifier', () => {
  it('returns a string', () => {
    expect(typeof codeChallengeFromVerifier('some-verifier')).toBe('string');
  });

  it('returns a non-empty string', () => {
    expect(codeChallengeFromVerifier('abc').length).toBeGreaterThan(0);
  });

  it('is base64url-safe (no +, /, =)', () => {
    const challenge = codeChallengeFromVerifier('test-verifier-value');
    expect(challenge).not.toContain('+');
    expect(challenge).not.toContain('/');
    expect(challenge).not.toContain('=');
  });

  it('is deterministic for the same verifier', () => {
    const v = 'fixed-verifier-string';
    expect(codeChallengeFromVerifier(v)).toBe(codeChallengeFromVerifier(v));
  });

  it('produces different challenges for different verifiers', () => {
    expect(codeChallengeFromVerifier('verifier1')).not.toBe(codeChallengeFromVerifier('verifier2'));
  });

  it('returns a 43-character base64url string (SHA-256 output)', () => {
    // SHA-256 → 32 bytes → 43 base64url chars (without padding)
    const challenge = codeChallengeFromVerifier('any-verifier-here');
    expect(challenge.length).toBe(43);
  });

  it('matches known RFC 7636 test vector', () => {
    // From RFC 7636 Appendix B:
    // verifier = "dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk"
    // challenge = "E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM"
    const verifier = 'dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk';
    const expected = 'E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM';
    expect(codeChallengeFromVerifier(verifier)).toBe(expected);
  });
});

describe('stateCookieName', () => {
  it('returns a string with the platform embedded', () => {
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

  it('returns different names for different platforms', () => {
    expect(stateCookieName('youtube')).not.toBe(stateCookieName('tiktok'));
  });
});

describe('codeVerifierCookieName', () => {
  it('returns a string with the platform embedded', () => {
    expect(codeVerifierCookieName('canva')).toBe('oauth_pkce_canva');
  });

  it('works for youtube', () => {
    expect(codeVerifierCookieName('youtube')).toBe('oauth_pkce_youtube');
  });

  it('works for tiktok', () => {
    expect(codeVerifierCookieName('tiktok')).toBe('oauth_pkce_tiktok');
  });

  it('returns different names for different platforms', () => {
    expect(codeVerifierCookieName('canva')).not.toBe(codeVerifierCookieName('tiktok'));
  });

  it('is different from stateCookieName for same platform', () => {
    expect(codeVerifierCookieName('canva')).not.toBe(stateCookieName('canva'));
  });
});
