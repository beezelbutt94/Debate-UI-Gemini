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

describe('generateState', () => {
  it('returns a non-empty string', () => {
    expect(typeof generateState()).toBe('string');
    expect(generateState().length).toBeGreaterThan(0);
  });

  it('returns a base64url string (no +, /, = chars)', () => {
    const state = generateState();
    expect(state).toMatch(/^[A-Za-z0-9\-_]+$/);
  });

  it('generates unique values across calls', () => {
    const states = new Set(Array.from({ length: 100 }, () => generateState()));
    expect(states.size).toBe(100);
  });

  it('produces strings of length 32 (24 random bytes → base64url)', () => {
    // 24 bytes × 4/3 = 32 chars (base64url, no padding)
    expect(generateState().length).toBe(32);
  });
});

// ─── stateCookieName ──────────────────────────────────────────────────────────

describe('stateCookieName', () => {
  it('returns oauth_state_<platform>', () => {
    expect(stateCookieName('youtube')).toBe('oauth_state_youtube');
  });

  it('works for all four OAuth platforms', () => {
    expect(stateCookieName('tiktok')).toBe('oauth_state_tiktok');
    expect(stateCookieName('facebook')).toBe('oauth_state_facebook');
    expect(stateCookieName('canva')).toBe('oauth_state_canva');
  });

  it('is deterministic for the same input', () => {
    expect(stateCookieName('youtube')).toBe(stateCookieName('youtube'));
  });

  it('differentiates platforms', () => {
    expect(stateCookieName('youtube')).not.toBe(stateCookieName('tiktok'));
  });
});

// ─── generateCodeVerifier ─────────────────────────────────────────────────────

describe('generateCodeVerifier', () => {
  it('returns a non-empty string', () => {
    expect(typeof generateCodeVerifier()).toBe('string');
    expect(generateCodeVerifier().length).toBeGreaterThan(0);
  });

  it('returns a base64url string (no +, /, = chars)', () => {
    expect(generateCodeVerifier()).toMatch(/^[A-Za-z0-9\-_]+$/);
  });

  it('generates unique values across calls', () => {
    const verifiers = new Set(Array.from({ length: 100 }, () => generateCodeVerifier()));
    expect(verifiers.size).toBe(100);
  });

  it('produces strings of length 43 (32 random bytes → base64url)', () => {
    // 32 bytes × 4/3 ≈ 43 chars (base64url, no padding)
    expect(generateCodeVerifier().length).toBe(43);
  });

  it('meets RFC 7636 minimum verifier length (≥ 43 chars)', () => {
    expect(generateCodeVerifier().length).toBeGreaterThanOrEqual(43);
  });
});

// ─── codeChallengeFromVerifier ────────────────────────────────────────────────

describe('codeChallengeFromVerifier', () => {
  it('returns a non-empty string', () => {
    const verifier = generateCodeVerifier();
    expect(codeChallengeFromVerifier(verifier).length).toBeGreaterThan(0);
  });

  it('returns a base64url string', () => {
    const verifier = generateCodeVerifier();
    expect(codeChallengeFromVerifier(verifier)).toMatch(/^[A-Za-z0-9\-_]+$/);
  });

  it('is deterministic for the same verifier', () => {
    const verifier = generateCodeVerifier();
    expect(codeChallengeFromVerifier(verifier)).toBe(codeChallengeFromVerifier(verifier));
  });

  it('produces the correct SHA-256 base64url hash (RFC 7636)', () => {
    const verifier = 'dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk';
    const expected = createHash('sha256').update(verifier).digest('base64url');
    expect(codeChallengeFromVerifier(verifier)).toBe(expected);
  });

  it('produces different challenges for different verifiers', () => {
    const v1 = generateCodeVerifier();
    const v2 = generateCodeVerifier();
    expect(codeChallengeFromVerifier(v1)).not.toBe(codeChallengeFromVerifier(v2));
  });

  it('matches expected hash for known verifier "abc"', () => {
    const expected = createHash('sha256').update('abc').digest('base64url');
    expect(codeChallengeFromVerifier('abc')).toBe(expected);
  });

  it('produces a challenge of length 43 (SHA-256 = 32 bytes → base64url 43 chars)', () => {
    const verifier = generateCodeVerifier();
    expect(codeChallengeFromVerifier(verifier).length).toBe(43);
  });
});

// ─── codeVerifierCookieName ───────────────────────────────────────────────────

describe('codeVerifierCookieName', () => {
  it('returns oauth_pkce_<platform>', () => {
    expect(codeVerifierCookieName('canva')).toBe('oauth_pkce_canva');
  });

  it('works for all four OAuth platforms', () => {
    expect(codeVerifierCookieName('youtube')).toBe('oauth_pkce_youtube');
    expect(codeVerifierCookieName('tiktok')).toBe('oauth_pkce_tiktok');
    expect(codeVerifierCookieName('facebook')).toBe('oauth_pkce_facebook');
  });

  it('is deterministic for the same input', () => {
    expect(codeVerifierCookieName('canva')).toBe(codeVerifierCookieName('canva'));
  });

  it('differentiates platforms', () => {
    expect(codeVerifierCookieName('canva')).not.toBe(codeVerifierCookieName('youtube'));
  });

  it('differs from stateCookieName for the same platform', () => {
    expect(codeVerifierCookieName('canva')).not.toBe(stateCookieName('canva'));
  });
});
