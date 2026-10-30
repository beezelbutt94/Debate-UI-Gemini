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
    expect(typeof generateState()).toBe('string');
    expect(generateState().length).toBeGreaterThan(0);
  });

  it('returns a base64url-safe string (no +, /, = chars)', () => {
    for (let i = 0; i < 20; i++) {
      const s = generateState();
      expect(s).toMatch(/^[A-Za-z0-9_-]+$/);
    }
  });

  it('produces unique values on every call', () => {
    const values = new Set(Array.from({ length: 50 }, () => generateState()));
    expect(values.size).toBe(50);
  });

  it('has sufficient entropy (at least 24 chars from 24 random bytes)', () => {
    // 24 bytes → 32 base64url chars
    expect(generateState().length).toBeGreaterThanOrEqual(24);
  });
});

describe('stateCookieName()', () => {
  it('produces a predictable cookie name for tiktok', () => {
    expect(stateCookieName('tiktok')).toBe('oauth_state_tiktok');
  });

  it('produces a predictable cookie name for youtube', () => {
    expect(stateCookieName('youtube')).toBe('oauth_state_youtube');
  });

  it('includes the platform in the name', () => {
    expect(stateCookieName('facebook')).toContain('facebook');
    expect(stateCookieName('canva')).toContain('canva');
  });

  it('always starts with oauth_state_', () => {
    expect(stateCookieName('anything')).toMatch(/^oauth_state_/);
  });
});

describe('generateCodeVerifier()', () => {
  it('returns a non-empty string', () => {
    expect(typeof generateCodeVerifier()).toBe('string');
    expect(generateCodeVerifier().length).toBeGreaterThan(0);
  });

  it('returns a base64url-safe string', () => {
    for (let i = 0; i < 20; i++) {
      expect(generateCodeVerifier()).toMatch(/^[A-Za-z0-9_-]+$/);
    }
  });

  it('produces unique values on every call', () => {
    const values = new Set(Array.from({ length: 50 }, () => generateCodeVerifier()));
    expect(values.size).toBe(50);
  });

  it('has sufficient length (32 bytes → 43+ base64url chars)', () => {
    expect(generateCodeVerifier().length).toBeGreaterThanOrEqual(43);
  });
});

describe('codeChallengeFromVerifier()', () => {
  it('produces a base64url-safe string', () => {
    const verifier = generateCodeVerifier();
    const challenge = codeChallengeFromVerifier(verifier);
    expect(challenge).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  it('matches the expected SHA-256 derivation (RFC 7636)', () => {
    const verifier = 'dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk';
    const expected = createHash('sha256').update(verifier).digest('base64url');
    expect(codeChallengeFromVerifier(verifier)).toBe(expected);
  });

  it('is deterministic for the same verifier', () => {
    const verifier = generateCodeVerifier();
    expect(codeChallengeFromVerifier(verifier)).toBe(codeChallengeFromVerifier(verifier));
  });

  it('produces a different challenge for different verifiers', () => {
    const a = generateCodeVerifier();
    const b = generateCodeVerifier();
    expect(codeChallengeFromVerifier(a)).not.toBe(codeChallengeFromVerifier(b));
  });

  it('round-trips: verifier → challenge verifiable by SHA-256', () => {
    const verifier = 'hello-world-pkce-verifier-test-string-here';
    const challenge = codeChallengeFromVerifier(verifier);
    const recomputed = createHash('sha256').update(verifier).digest('base64url');
    expect(challenge).toBe(recomputed);
  });
});

describe('codeVerifierCookieName()', () => {
  it('produces expected name for canva', () => {
    expect(codeVerifierCookieName('canva')).toBe('oauth_pkce_canva');
  });

  it('always starts with oauth_pkce_', () => {
    expect(codeVerifierCookieName('platform')).toMatch(/^oauth_pkce_/);
  });

  it('includes the platform name', () => {
    expect(codeVerifierCookieName('tiktok')).toContain('tiktok');
  });
});
