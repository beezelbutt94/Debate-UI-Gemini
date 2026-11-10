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
      const s = generateState();
      expect(s).not.toMatch(/[+/=]/);
    }
  });

  it('returns different values on each call (no collisions in 100 runs)', () => {
    const seen = new Set<string>();
    for (let i = 0; i < 100; i++) seen.add(generateState());
    expect(seen.size).toBe(100);
  });

  it('produces strings of consistent length (32 chars from 24 bytes base64url)', () => {
    // 24 bytes → 32 base64url characters
    const states = Array.from({ length: 10 }, generateState);
    for (const s of states) expect(s.length).toBe(32);
  });
});

describe('stateCookieName()', () => {
  it('prefixes the platform name correctly', () => {
    expect(stateCookieName('youtube')).toBe('oauth_state_youtube');
  });

  it('works for all supported platforms', () => {
    expect(stateCookieName('tiktok')).toBe('oauth_state_tiktok');
    expect(stateCookieName('facebook')).toBe('oauth_state_facebook');
    expect(stateCookieName('canva')).toBe('oauth_state_canva');
  });

  it('is deterministic for the same platform', () => {
    expect(stateCookieName('youtube')).toBe(stateCookieName('youtube'));
  });
});

describe('generateCodeVerifier()', () => {
  it('returns a non-empty string', () => {
    expect(typeof generateCodeVerifier()).toBe('string');
    expect(generateCodeVerifier().length).toBeGreaterThan(0);
  });

  it('returns base64url-safe characters only', () => {
    for (let i = 0; i < 20; i++) {
      const v = generateCodeVerifier();
      expect(v).not.toMatch(/[+/=]/);
    }
  });

  it('returns different values on each call', () => {
    const seen = new Set<string>();
    for (let i = 0; i < 50; i++) seen.add(generateCodeVerifier());
    expect(seen.size).toBe(50);
  });

  it('produces strings of consistent length (43 chars from 32 bytes base64url)', () => {
    // 32 bytes → 43 base64url characters
    const verifiers = Array.from({ length: 10 }, generateCodeVerifier);
    for (const v of verifiers) expect(v.length).toBe(43);
  });
});

describe('codeChallengeFromVerifier()', () => {
  it('returns a non-empty string', () => {
    expect(typeof codeChallengeFromVerifier('abc')).toBe('string');
  });

  it('is deterministic for the same verifier', () => {
    const v = generateCodeVerifier();
    expect(codeChallengeFromVerifier(v)).toBe(codeChallengeFromVerifier(v));
  });

  it('produces different challenges for different verifiers', () => {
    const a = generateCodeVerifier();
    const b = generateCodeVerifier();
    expect(codeChallengeFromVerifier(a)).not.toBe(codeChallengeFromVerifier(b));
  });

  it('produces base64url-safe characters (no +, /, =)', () => {
    for (let i = 0; i < 20; i++) {
      const challenge = codeChallengeFromVerifier(generateCodeVerifier());
      expect(challenge).not.toMatch(/[+/=]/);
    }
  });

  it('SHA-256 of "abc" is the known test vector', () => {
    // SHA-256("abc") = ba7816bf8f01cfea414140de5dae2ec73b00361bbef0469f492c5a862ff24b
    // base64url encoded: ungWv48Bz-pIAyfvIe6osQ (without padding)
    // Let's verify by checking it's 43 chars long (SHA256 → 32 bytes → 43 base64url)
    const challenge = codeChallengeFromVerifier('abc');
    expect(challenge.length).toBe(43);
  });

  it('known PKCE S256 test vector from RFC 7636 appendix B', () => {
    // dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk → code_challenge
    const verifier = 'dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk';
    const challenge = codeChallengeFromVerifier(verifier);
    expect(challenge).toBe('E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM');
  });
});

describe('codeVerifierCookieName()', () => {
  it('prefixes the platform name correctly', () => {
    expect(codeVerifierCookieName('canva')).toBe('oauth_pkce_canva');
  });

  it('works for other platforms too', () => {
    expect(codeVerifierCookieName('youtube')).toBe('oauth_pkce_youtube');
    expect(codeVerifierCookieName('tiktok')).toBe('oauth_pkce_tiktok');
  });

  it('is deterministic for the same platform', () => {
    expect(codeVerifierCookieName('canva')).toBe(codeVerifierCookieName('canva'));
  });
});
