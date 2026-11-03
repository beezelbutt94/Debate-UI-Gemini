import { describe, it, expect } from 'vitest';
import {
  generateState,
  stateCookieName,
  generateCodeVerifier,
  codeChallengeFromVerifier,
  codeVerifierCookieName,
} from '@/lib/oauth/state';
import { createHash } from 'crypto';

// ─── generateState ────────────────────────────────────────────────────────────

describe('generateState()', () => {
  it('returns a non-empty string', () => {
    expect(typeof generateState()).toBe('string');
    expect(generateState().length).toBeGreaterThan(0);
  });

  it('returns a URL-safe base64 string (no +, /, = chars)', () => {
    for (let i = 0; i < 20; i++) {
      const state = generateState();
      expect(state).not.toMatch(/[+/=]/);
    }
  });

  it('is at least 32 characters (24 random bytes → 32 base64url chars)', () => {
    expect(generateState().length).toBeGreaterThanOrEqual(32);
  });

  it('returns different values on each call', () => {
    const a = generateState();
    const b = generateState();
    expect(a).not.toBe(b);
  });
});

// ─── stateCookieName ──────────────────────────────────────────────────────────

describe('stateCookieName()', () => {
  it('includes the platform name', () => {
    expect(stateCookieName('youtube')).toContain('youtube');
  });

  it('follows the expected naming convention', () => {
    expect(stateCookieName('tiktok')).toBe('oauth_state_tiktok');
  });

  it('works for all supported platforms', () => {
    for (const p of ['youtube', 'tiktok', 'facebook', 'canva']) {
      expect(stateCookieName(p)).toBe(`oauth_state_${p}`);
    }
  });
});

// ─── generateCodeVerifier ─────────────────────────────────────────────────────

describe('generateCodeVerifier()', () => {
  it('returns a non-empty string', () => {
    expect(generateCodeVerifier().length).toBeGreaterThan(0);
  });

  it('is URL-safe base64 (no +, /, = chars)', () => {
    for (let i = 0; i < 20; i++) {
      expect(generateCodeVerifier()).not.toMatch(/[+/=]/);
    }
  });

  it('is at least 43 characters (32 bytes → 43 base64url chars)', () => {
    expect(generateCodeVerifier().length).toBeGreaterThanOrEqual(43);
  });

  it('returns different values on each call', () => {
    const a = generateCodeVerifier();
    const b = generateCodeVerifier();
    expect(a).not.toBe(b);
  });
});

// ─── codeChallengeFromVerifier ────────────────────────────────────────────────

describe('codeChallengeFromVerifier()', () => {
  it('returns a non-empty string', () => {
    expect(codeChallengeFromVerifier('someverifier')).toBeDefined();
    expect(codeChallengeFromVerifier('someverifier').length).toBeGreaterThan(0);
  });

  it('is deterministic for the same input', () => {
    const v = 'fixed-verifier-value';
    expect(codeChallengeFromVerifier(v)).toBe(codeChallengeFromVerifier(v));
  });

  it('matches SHA-256 base64url of the verifier (RFC 7636)', () => {
    const verifier = 'my-test-verifier-value';
    const expected = createHash('sha256').update(verifier).digest('base64url');
    expect(codeChallengeFromVerifier(verifier)).toBe(expected);
  });

  it('is URL-safe (no +, /, = chars)', () => {
    const v = generateCodeVerifier();
    const challenge = codeChallengeFromVerifier(v);
    expect(challenge).not.toMatch(/[+/=]/);
  });

  it('changes when the verifier changes', () => {
    const c1 = codeChallengeFromVerifier('verifier-a');
    const c2 = codeChallengeFromVerifier('verifier-b');
    expect(c1).not.toBe(c2);
  });

  it('is 43 characters for a 32-byte SHA-256 output (base64url)', () => {
    // SHA-256 is 32 bytes → 43 base64url chars (ceil(32 * 4/3))
    const challenge = codeChallengeFromVerifier(generateCodeVerifier());
    expect(challenge.length).toBe(43);
  });
});

// ─── codeVerifierCookieName ───────────────────────────────────────────────────

describe('codeVerifierCookieName()', () => {
  it('includes the platform name', () => {
    expect(codeVerifierCookieName('canva')).toContain('canva');
  });

  it('follows the expected naming convention', () => {
    expect(codeVerifierCookieName('canva')).toBe('oauth_pkce_canva');
  });

  it('works for all supported platforms', () => {
    for (const p of ['youtube', 'tiktok', 'facebook', 'canva']) {
      expect(codeVerifierCookieName(p)).toBe(`oauth_pkce_${p}`);
    }
  });
});
