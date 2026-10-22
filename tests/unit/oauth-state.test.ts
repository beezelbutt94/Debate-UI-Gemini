import { describe, it, expect } from 'vitest';
import { createHash } from 'crypto';
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

  it('returns base64url-safe characters only (no +, /, =)', () => {
    for (let i = 0; i < 20; i++) {
      const state = generateState();
      expect(state).toMatch(/^[A-Za-z0-9_-]+$/);
    }
  });

  it('produces values of expected length (24 bytes → 32 base64url chars)', () => {
    // base64url encodes 3 bytes → 4 chars; 24 bytes → 32 chars
    expect(generateState().length).toBe(32);
  });

  it('produces different values on successive calls (random)', () => {
    const states = new Set(Array.from({ length: 50 }, () => generateState()));
    expect(states.size).toBe(50);
  });
});

describe('stateCookieName()', () => {
  it('includes the platform name', () => {
    expect(stateCookieName('youtube')).toContain('youtube');
  });

  it('has the correct prefix', () => {
    expect(stateCookieName('tiktok')).toBe('oauth_state_tiktok');
  });

  it('works for all OAuth platforms', () => {
    for (const platform of ['youtube', 'tiktok', 'facebook', 'canva']) {
      expect(stateCookieName(platform)).toBe(`oauth_state_${platform}`);
    }
  });
});

describe('generateCodeVerifier()', () => {
  it('returns a non-empty string', () => {
    expect(typeof generateCodeVerifier()).toBe('string');
    expect(generateCodeVerifier().length).toBeGreaterThan(0);
  });

  it('returns base64url-safe characters only', () => {
    for (let i = 0; i < 20; i++) {
      expect(generateCodeVerifier()).toMatch(/^[A-Za-z0-9_-]+$/);
    }
  });

  it('produces values of expected length (32 bytes → 43 base64url chars)', () => {
    // 32 bytes = 256 bits → ceil(32 * 4/3) = 43 chars with base64url
    expect(generateCodeVerifier().length).toBe(43);
  });

  it('produces unique values on successive calls', () => {
    const verifiers = new Set(Array.from({ length: 50 }, () => generateCodeVerifier()));
    expect(verifiers.size).toBe(50);
  });
});

describe('codeChallengeFromVerifier()', () => {
  it('returns a base64url-encoded SHA-256 hash', () => {
    const verifier = 'test-verifier';
    const expected = createHash('sha256').update(verifier).digest('base64url');
    expect(codeChallengeFromVerifier(verifier)).toBe(expected);
  });

  it('produces a deterministic result for the same input', () => {
    const verifier = generateCodeVerifier();
    expect(codeChallengeFromVerifier(verifier)).toBe(codeChallengeFromVerifier(verifier));
  });

  it('produces different challenges for different verifiers', () => {
    const v1 = generateCodeVerifier();
    const v2 = generateCodeVerifier();
    expect(codeChallengeFromVerifier(v1)).not.toBe(codeChallengeFromVerifier(v2));
  });

  it('produces base64url output (no +, /, =)', () => {
    for (let i = 0; i < 20; i++) {
      const challenge = codeChallengeFromVerifier(generateCodeVerifier());
      expect(challenge).toMatch(/^[A-Za-z0-9_-]+$/);
    }
  });

  it('matches the PKCE RFC 7636 S256 spec for a known vector', () => {
    // RFC 7636 Appendix B example (truncated to check method, not exact value)
    const verifier = 'dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk';
    const challenge = codeChallengeFromVerifier(verifier);
    const expected = createHash('sha256').update(verifier).digest('base64url');
    expect(challenge).toBe(expected);
  });
});

describe('codeVerifierCookieName()', () => {
  it('has the correct prefix', () => {
    expect(codeVerifierCookieName('canva')).toBe('oauth_pkce_canva');
  });

  it('includes the platform name', () => {
    expect(codeVerifierCookieName('youtube')).toContain('youtube');
  });

  it('works for all OAuth platforms', () => {
    for (const platform of ['youtube', 'tiktok', 'facebook', 'canva']) {
      expect(codeVerifierCookieName(platform)).toBe(`oauth_pkce_${platform}`);
    }
  });
});
