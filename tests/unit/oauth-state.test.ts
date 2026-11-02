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
    expect(typeof generateState()).toBe('string');
    expect(generateState().length).toBeGreaterThan(0);
  });

  it('is URL-safe base64 (no +, /, = chars)', () => {
    for (let i = 0; i < 20; i++) {
      const s = generateState();
      expect(s).not.toMatch(/[+/=]/);
    }
  });

  it('is at least 20 characters (24 bytes → 32 base64url chars)', () => {
    expect(generateState().length).toBeGreaterThanOrEqual(20);
  });

  it('produces unique values on each call', () => {
    const states = new Set(Array.from({ length: 50 }, generateState));
    expect(states.size).toBe(50);
  });
});

// ---------------------------------------------------------------------------
// stateCookieName
// ---------------------------------------------------------------------------
describe('stateCookieName()', () => {
  it('returns oauth_state_{platform}', () => {
    expect(stateCookieName('youtube')).toBe('oauth_state_youtube');
    expect(stateCookieName('tiktok')).toBe('oauth_state_tiktok');
    expect(stateCookieName('facebook')).toBe('oauth_state_facebook');
    expect(stateCookieName('canva')).toBe('oauth_state_canva');
  });

  it('handles arbitrary platform strings', () => {
    expect(stateCookieName('myplatform')).toBe('oauth_state_myplatform');
  });

  it('preserves casing', () => {
    expect(stateCookieName('MyPlatform')).toBe('oauth_state_MyPlatform');
  });
});

// ---------------------------------------------------------------------------
// generateCodeVerifier
// ---------------------------------------------------------------------------
describe('generateCodeVerifier()', () => {
  it('returns a non-empty string', () => {
    expect(typeof generateCodeVerifier()).toBe('string');
    expect(generateCodeVerifier().length).toBeGreaterThan(0);
  });

  it('is URL-safe base64 (no +, /, = chars)', () => {
    for (let i = 0; i < 20; i++) {
      expect(generateCodeVerifier()).not.toMatch(/[+/=]/);
    }
  });

  it('is at least 40 characters (32 bytes → 43 base64url chars)', () => {
    expect(generateCodeVerifier().length).toBeGreaterThanOrEqual(40);
  });

  it('produces unique values on each call', () => {
    const verifiers = new Set(Array.from({ length: 50 }, generateCodeVerifier));
    expect(verifiers.size).toBe(50);
  });
});

// ---------------------------------------------------------------------------
// codeChallengeFromVerifier
// ---------------------------------------------------------------------------
describe('codeChallengeFromVerifier()', () => {
  it('returns a non-empty string', () => {
    const verifier = generateCodeVerifier();
    expect(typeof codeChallengeFromVerifier(verifier)).toBe('string');
    expect(codeChallengeFromVerifier(verifier).length).toBeGreaterThan(0);
  });

  it('is deterministic for the same verifier', () => {
    const verifier = 'static-test-verifier';
    expect(codeChallengeFromVerifier(verifier)).toBe(codeChallengeFromVerifier(verifier));
  });

  it('produces different challenges for different verifiers', () => {
    const a = codeChallengeFromVerifier('verifier-a');
    const b = codeChallengeFromVerifier('verifier-b');
    expect(a).not.toBe(b);
  });

  it('matches the expected SHA-256 base64url of the verifier (RFC 7636)', () => {
    const verifier = 'dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk';
    const expected = createHash('sha256').update(verifier).digest('base64url');
    expect(codeChallengeFromVerifier(verifier)).toBe(expected);
  });

  it('is URL-safe base64 (no +, /, = chars)', () => {
    for (let i = 0; i < 20; i++) {
      const v = generateCodeVerifier();
      expect(codeChallengeFromVerifier(v)).not.toMatch(/[+/=]/);
    }
  });

  it('has expected length of 43 chars for SHA-256 output', () => {
    const v = generateCodeVerifier();
    expect(codeChallengeFromVerifier(v).length).toBe(43);
  });

  it('handles empty string input without throwing', () => {
    expect(() => codeChallengeFromVerifier('')).not.toThrow();
    expect(codeChallengeFromVerifier('').length).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// codeVerifierCookieName
// ---------------------------------------------------------------------------
describe('codeVerifierCookieName()', () => {
  it('returns oauth_pkce_{platform}', () => {
    expect(codeVerifierCookieName('canva')).toBe('oauth_pkce_canva');
    expect(codeVerifierCookieName('youtube')).toBe('oauth_pkce_youtube');
    expect(codeVerifierCookieName('tiktok')).toBe('oauth_pkce_tiktok');
    expect(codeVerifierCookieName('facebook')).toBe('oauth_pkce_facebook');
  });

  it('handles arbitrary platform strings', () => {
    expect(codeVerifierCookieName('test')).toBe('oauth_pkce_test');
  });
});
