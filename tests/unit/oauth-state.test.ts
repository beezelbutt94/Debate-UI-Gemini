import { describe, it, expect } from 'vitest';
import { createHash } from 'crypto';
import {
  generateState,
  stateCookieName,
  generateCodeVerifier,
  codeChallengeFromVerifier,
  codeVerifierCookieName,
} from '@/lib/oauth/state';

// ─── generateState ────────────────────────────────────────────────────────────

describe('generateState', () => {
  it('returns a non-empty string', () => {
    expect(typeof generateState()).toBe('string');
    expect(generateState().length).toBeGreaterThan(0);
  });

  it('returns a base64url-safe string (no +, /, =)', () => {
    for (let i = 0; i < 20; i++) {
      const s = generateState();
      expect(s).toMatch(/^[A-Za-z0-9\-_]+$/);
    }
  });

  it('produces unique values across calls', () => {
    const values = new Set(Array.from({ length: 50 }, () => generateState()));
    expect(values.size).toBe(50);
  });

  it('generates strings of expected length (24 bytes → 32 base64url chars)', () => {
    // 24 random bytes → ceil(24/3)*4 = 32 base64 chars (no padding in base64url)
    const s = generateState();
    expect(s.length).toBe(32);
  });
});

// ─── stateCookieName ─────────────────────────────────────────────────────────

describe('stateCookieName', () => {
  it('returns expected cookie name for youtube', () => {
    expect(stateCookieName('youtube')).toBe('oauth_state_youtube');
  });

  it('returns expected cookie name for tiktok', () => {
    expect(stateCookieName('tiktok')).toBe('oauth_state_tiktok');
  });

  it('returns expected cookie name for facebook', () => {
    expect(stateCookieName('facebook')).toBe('oauth_state_facebook');
  });

  it('returns expected cookie name for canva', () => {
    expect(stateCookieName('canva')).toBe('oauth_state_canva');
  });

  it('incorporates the platform string verbatim', () => {
    expect(stateCookieName('my-custom-platform')).toBe('oauth_state_my-custom-platform');
  });
});

// ─── generateCodeVerifier ────────────────────────────────────────────────────

describe('generateCodeVerifier', () => {
  it('returns a non-empty string', () => {
    expect(typeof generateCodeVerifier()).toBe('string');
    expect(generateCodeVerifier().length).toBeGreaterThan(0);
  });

  it('returns a base64url-safe string', () => {
    for (let i = 0; i < 20; i++) {
      expect(generateCodeVerifier()).toMatch(/^[A-Za-z0-9\-_]+$/);
    }
  });

  it('produces unique values across calls', () => {
    const values = new Set(Array.from({ length: 50 }, () => generateCodeVerifier()));
    expect(values.size).toBe(50);
  });

  it('generates strings of expected length (32 bytes → 43 base64url chars)', () => {
    // 32 bytes → 43 chars in base64url (no padding)
    const v = generateCodeVerifier();
    expect(v.length).toBe(43);
  });
});

// ─── codeChallengeFromVerifier ────────────────────────────────────────────────

describe('codeChallengeFromVerifier', () => {
  it('returns a base64url string (no +, /, =)', () => {
    const verifier = generateCodeVerifier();
    const challenge = codeChallengeFromVerifier(verifier);
    expect(challenge).toMatch(/^[A-Za-z0-9\-_]+$/);
  });

  it('is deterministic for the same input', () => {
    const verifier = generateCodeVerifier();
    expect(codeChallengeFromVerifier(verifier)).toBe(codeChallengeFromVerifier(verifier));
  });

  it('produces different outputs for different inputs', () => {
    const a = codeChallengeFromVerifier('verifierA');
    const b = codeChallengeFromVerifier('verifierB');
    expect(a).not.toBe(b);
  });

  it('matches the expected SHA-256 base64url value', () => {
    const verifier = 'dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk';
    const expected = createHash('sha256').update(verifier).digest('base64url');
    expect(codeChallengeFromVerifier(verifier)).toBe(expected);
  });

  it('the PKCE round-trip produces a 43-char challenge for a 43-char verifier', () => {
    const verifier = generateCodeVerifier();
    // SHA-256 → 32 bytes → base64url → 43 chars
    expect(codeChallengeFromVerifier(verifier).length).toBe(43);
  });

  it('handles an empty string input gracefully (SHA-256 of empty)', () => {
    const expected = createHash('sha256').update('').digest('base64url');
    expect(codeChallengeFromVerifier('')).toBe(expected);
  });
});

// ─── codeVerifierCookieName ───────────────────────────────────────────────────

describe('codeVerifierCookieName', () => {
  it('returns expected cookie name for canva', () => {
    expect(codeVerifierCookieName('canva')).toBe('oauth_pkce_canva');
  });

  it('returns expected cookie name for youtube', () => {
    expect(codeVerifierCookieName('youtube')).toBe('oauth_pkce_youtube');
  });

  it('incorporates the platform string verbatim', () => {
    expect(codeVerifierCookieName('test-provider')).toBe('oauth_pkce_test-provider');
  });
});
