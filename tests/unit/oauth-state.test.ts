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
    expect(generateState()).toBeTruthy();
  });

  it('returns a base64url-encoded string (no +, /, = chars)', () => {
    const state = generateState();
    expect(state).not.toMatch(/[+/=]/);
  });

  it('returns a string of expected length for 24 random bytes (32 base64url chars)', () => {
    const state = generateState();
    // 24 bytes → ceil(24 * 4/3) = 32 chars in base64url without padding
    expect(state.length).toBe(32);
  });

  it('generates unique values on each call', () => {
    const states = new Set(Array.from({ length: 100 }, generateState));
    expect(states.size).toBe(100);
  });

  it('only contains base64url-safe characters', () => {
    for (let i = 0; i < 50; i++) {
      expect(generateState()).toMatch(/^[A-Za-z0-9_-]+$/);
    }
  });
});

describe('stateCookieName()', () => {
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

  it('always starts with "oauth_state_"', () => {
    expect(stateCookieName('anything')).toMatch(/^oauth_state_/);
  });

  it('appends the platform name literally', () => {
    expect(stateCookieName('my-platform')).toBe('oauth_state_my-platform');
  });
});

describe('generateCodeVerifier()', () => {
  it('returns a non-empty string', () => {
    expect(generateCodeVerifier()).toBeTruthy();
  });

  it('returns a base64url-encoded string with no padding chars', () => {
    const verifier = generateCodeVerifier();
    expect(verifier).not.toMatch(/[+/=]/);
  });

  it('returns expected length for 32 random bytes (43 base64url chars)', () => {
    const verifier = generateCodeVerifier();
    // 32 bytes → ceil(32 * 4/3) = 43 chars in base64url without padding
    expect(verifier.length).toBe(43);
  });

  it('generates unique values on each call', () => {
    const verifiers = new Set(Array.from({ length: 100 }, generateCodeVerifier));
    expect(verifiers.size).toBe(100);
  });

  it('only contains base64url-safe characters', () => {
    for (let i = 0; i < 50; i++) {
      expect(generateCodeVerifier()).toMatch(/^[A-Za-z0-9_-]+$/);
    }
  });
});

describe('codeChallengeFromVerifier()', () => {
  it('returns a non-empty string', () => {
    expect(codeChallengeFromVerifier('test-verifier')).toBeTruthy();
  });

  it('produces the correct SHA-256 base64url digest', () => {
    const verifier = 'dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk';
    const expected = createHash('sha256').update(verifier).digest('base64url');
    expect(codeChallengeFromVerifier(verifier)).toBe(expected);
  });

  it('produces a 43-char string for any input (SHA-256 is 32 bytes → 43 base64url chars)', () => {
    expect(codeChallengeFromVerifier('hello')).toHaveLength(43);
    expect(codeChallengeFromVerifier('a')).toHaveLength(43);
    expect(codeChallengeFromVerifier(generateCodeVerifier())).toHaveLength(43);
  });

  it('is deterministic — same verifier always yields same challenge', () => {
    const verifier = 'constant-verifier';
    const c1 = codeChallengeFromVerifier(verifier);
    const c2 = codeChallengeFromVerifier(verifier);
    expect(c1).toBe(c2);
  });

  it('produces different challenges for different verifiers', () => {
    const c1 = codeChallengeFromVerifier('verifier-A');
    const c2 = codeChallengeFromVerifier('verifier-B');
    expect(c1).not.toBe(c2);
  });

  it('output contains only base64url-safe characters (no +, /, =)', () => {
    for (let i = 0; i < 20; i++) {
      const challenge = codeChallengeFromVerifier(generateCodeVerifier());
      expect(challenge).toMatch(/^[A-Za-z0-9_-]+$/);
    }
  });

  it('satisfies PKCE S256 spec: BASE64URL(SHA256(ASCII(code_verifier)))', () => {
    // RFC 7636 §4.2 known vector
    const verifier = 'dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk';
    const challenge = codeChallengeFromVerifier(verifier);
    // verify the challenge can be independently reproduced
    const manual = createHash('sha256').update(verifier, 'ascii').digest('base64url');
    expect(challenge).toBe(manual);
  });
});

describe('codeVerifierCookieName()', () => {
  it('returns expected format for canva', () => {
    expect(codeVerifierCookieName('canva')).toBe('oauth_pkce_canva');
  });

  it('returns expected format for youtube', () => {
    expect(codeVerifierCookieName('youtube')).toBe('oauth_pkce_youtube');
  });

  it('always starts with "oauth_pkce_"', () => {
    expect(codeVerifierCookieName('anything')).toMatch(/^oauth_pkce_/);
  });

  it('appends the platform name literally', () => {
    expect(codeVerifierCookieName('my-platform')).toBe('oauth_pkce_my-platform');
  });
});
