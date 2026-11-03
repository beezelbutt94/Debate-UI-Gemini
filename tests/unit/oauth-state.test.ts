import { describe, it, expect } from 'vitest';
import {
  generateState,
  stateCookieName,
  generateCodeVerifier,
  codeChallengeFromVerifier,
  codeVerifierCookieName,
} from '@/lib/oauth/state';

describe('generateState()', () => {
  it('returns a non-empty string', () => {
    expect(typeof generateState()).toBe('string');
    expect(generateState().length).toBeGreaterThan(0);
  });

  it('returns a base64url-safe string (no +, /, or = chars)', () => {
    for (let i = 0; i < 20; i++) {
      const state = generateState();
      expect(state).not.toMatch(/[+/=]/);
    }
  });

  it('produces unique values across calls', () => {
    const states = new Set(Array.from({ length: 50 }, () => generateState()));
    // All 50 should be unique
    expect(states.size).toBe(50);
  });

  it('has sufficient length for CSRF protection (>= 20 chars)', () => {
    const state = generateState();
    // 24 bytes base64url = 32 chars
    expect(state.length).toBeGreaterThanOrEqual(20);
  });

  it('only contains base64url characters', () => {
    for (let i = 0; i < 10; i++) {
      const state = generateState();
      expect(state).toMatch(/^[A-Za-z0-9_-]+$/);
    }
  });
});

describe('stateCookieName()', () => {
  it('returns correct cookie name for youtube', () => {
    expect(stateCookieName('youtube')).toBe('oauth_state_youtube');
  });

  it('returns correct cookie name for tiktok', () => {
    expect(stateCookieName('tiktok')).toBe('oauth_state_tiktok');
  });

  it('returns correct cookie name for facebook', () => {
    expect(stateCookieName('facebook')).toBe('oauth_state_facebook');
  });

  it('returns correct cookie name for canva', () => {
    expect(stateCookieName('canva')).toBe('oauth_state_canva');
  });

  it('prefixes with oauth_state_', () => {
    expect(stateCookieName('anyplatform')).toBe('oauth_state_anyplatform');
  });

  it('embeds the platform name as-is (lowercase)', () => {
    const name = stateCookieName('myplatform');
    expect(name).toContain('myplatform');
  });
});

describe('generateCodeVerifier()', () => {
  it('returns a non-empty string', () => {
    expect(typeof generateCodeVerifier()).toBe('string');
    expect(generateCodeVerifier().length).toBeGreaterThan(0);
  });

  it('is base64url-safe (no +, /, or = chars)', () => {
    for (let i = 0; i < 20; i++) {
      const verifier = generateCodeVerifier();
      expect(verifier).not.toMatch(/[+/=]/);
    }
  });

  it('produces unique values across calls', () => {
    const verifiers = new Set(Array.from({ length: 50 }, () => generateCodeVerifier()));
    expect(verifiers.size).toBe(50);
  });

  it('has sufficient entropy for PKCE (>= 43 chars per RFC 7636)', () => {
    // 32 random bytes in base64url = 43 chars minimum
    const verifier = generateCodeVerifier();
    expect(verifier.length).toBeGreaterThanOrEqual(43);
  });

  it('only contains base64url characters', () => {
    for (let i = 0; i < 10; i++) {
      const verifier = generateCodeVerifier();
      expect(verifier).toMatch(/^[A-Za-z0-9_-]+$/);
    }
  });
});

describe('codeChallengeFromVerifier()', () => {
  it('returns a non-empty string', () => {
    const verifier = generateCodeVerifier();
    expect(typeof codeChallengeFromVerifier(verifier)).toBe('string');
    expect(codeChallengeFromVerifier(verifier).length).toBeGreaterThan(0);
  });

  it('is base64url-safe (no +, /, or = chars)', () => {
    const verifier = generateCodeVerifier();
    const challenge = codeChallengeFromVerifier(verifier);
    expect(challenge).not.toMatch(/[+/=]/);
  });

  it('is deterministic for the same verifier', () => {
    const verifier = 'static-test-verifier-for-determinism-check-xyz123';
    const c1 = codeChallengeFromVerifier(verifier);
    const c2 = codeChallengeFromVerifier(verifier);
    expect(c1).toBe(c2);
  });

  it('produces different challenges for different verifiers', () => {
    const v1 = generateCodeVerifier();
    const v2 = generateCodeVerifier();
    expect(codeChallengeFromVerifier(v1)).not.toBe(codeChallengeFromVerifier(v2));
  });

  it('matches expected SHA-256 base64url for known input', () => {
    // RFC 7636 example: verifier = "dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk"
    // challenge = "E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM"
    const verifier = 'dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk';
    const expected = 'E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM';
    expect(codeChallengeFromVerifier(verifier)).toBe(expected);
  });

  it('challenge length is 43 characters (SHA-256 base64url without padding)', () => {
    const verifier = generateCodeVerifier();
    const challenge = codeChallengeFromVerifier(verifier);
    expect(challenge.length).toBe(43);
  });

  it('only contains base64url characters', () => {
    const verifier = generateCodeVerifier();
    const challenge = codeChallengeFromVerifier(verifier);
    expect(challenge).toMatch(/^[A-Za-z0-9_-]+$/);
  });
});

describe('codeVerifierCookieName()', () => {
  it('returns correct cookie name for canva', () => {
    expect(codeVerifierCookieName('canva')).toBe('oauth_pkce_canva');
  });

  it('prefixes with oauth_pkce_', () => {
    expect(codeVerifierCookieName('anyplatform')).toBe('oauth_pkce_anyplatform');
  });

  it('embeds the platform name', () => {
    const name = codeVerifierCookieName('testplatform');
    expect(name).toContain('testplatform');
  });

  it('different platforms produce different cookie names', () => {
    expect(codeVerifierCookieName('youtube')).not.toBe(codeVerifierCookieName('tiktok'));
  });
});
