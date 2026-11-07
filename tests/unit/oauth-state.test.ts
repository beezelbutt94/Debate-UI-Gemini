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
    expect(generateState().length).toBeGreaterThan(0);
  });

  it('returns a base64url string (no +, /, = characters)', () => {
    const state = generateState();
    expect(state).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  it('returns different values on each call', () => {
    const a = generateState();
    const b = generateState();
    expect(a).not.toBe(b);
  });

  it('produces a string of roughly the right length (32 bytes → ~43 base64url chars)', () => {
    // randomBytes(24).toString('base64url') → 32 chars
    const state = generateState();
    expect(state.length).toBeGreaterThanOrEqual(30);
    expect(state.length).toBeLessThanOrEqual(36);
  });

  it('produces 10 unique values in a row (collision probability negligible)', () => {
    const values = new Set(Array.from({ length: 10 }, () => generateState()));
    expect(values.size).toBe(10);
  });
});

// ─── stateCookieName ──────────────────────────────────────────────────────────

describe('stateCookieName()', () => {
  it('returns expected name for youtube', () => {
    expect(stateCookieName('youtube')).toBe('oauth_state_youtube');
  });

  it('returns expected name for tiktok', () => {
    expect(stateCookieName('tiktok')).toBe('oauth_state_tiktok');
  });

  it('returns expected name for facebook', () => {
    expect(stateCookieName('facebook')).toBe('oauth_state_facebook');
  });

  it('returns expected name for canva', () => {
    expect(stateCookieName('canva')).toBe('oauth_state_canva');
  });

  it('uses the platform name verbatim', () => {
    expect(stateCookieName('my_custom_platform')).toBe('oauth_state_my_custom_platform');
  });
});

// ─── generateCodeVerifier ────────────────────────────────────────────────────

describe('generateCodeVerifier()', () => {
  it('returns a non-empty string', () => {
    expect(generateCodeVerifier().length).toBeGreaterThan(0);
  });

  it('returns a base64url string (no +, /, = characters)', () => {
    expect(generateCodeVerifier()).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  it('returns different values on each call', () => {
    const a = generateCodeVerifier();
    const b = generateCodeVerifier();
    expect(a).not.toBe(b);
  });

  it('is at least 43 characters (RFC 7636 minimum)', () => {
    // randomBytes(32) → 43 base64url chars (without padding)
    expect(generateCodeVerifier().length).toBeGreaterThanOrEqual(43);
  });

  it('produces 10 unique values in a row', () => {
    const values = new Set(Array.from({ length: 10 }, () => generateCodeVerifier()));
    expect(values.size).toBe(10);
  });
});

// ─── codeChallengeFromVerifier ───────────────────────────────────────────────

describe('codeChallengeFromVerifier()', () => {
  it('returns a base64url string', () => {
    const challenge = codeChallengeFromVerifier('someVerifier');
    expect(challenge).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  it('is deterministic: same verifier → same challenge', () => {
    const v = 'fixed-verifier-string';
    expect(codeChallengeFromVerifier(v)).toBe(codeChallengeFromVerifier(v));
  });

  it('produces the correct SHA-256/base64url value', () => {
    const verifier = 'test-verifier-abc123';
    const expected = createHash('sha256').update(verifier).digest('base64url');
    expect(codeChallengeFromVerifier(verifier)).toBe(expected);
  });

  it('different verifiers produce different challenges', () => {
    const a = codeChallengeFromVerifier('verifier-A');
    const b = codeChallengeFromVerifier('verifier-B');
    expect(a).not.toBe(b);
  });

  it('round-trips correctly with a generated verifier', () => {
    const verifier = generateCodeVerifier();
    const challenge = codeChallengeFromVerifier(verifier);
    const expected = createHash('sha256').update(verifier).digest('base64url');
    expect(challenge).toBe(expected);
  });

  it('handles an empty verifier (edge case — still a valid SHA-256)', () => {
    const challenge = codeChallengeFromVerifier('');
    expect(challenge).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(challenge.length).toBeGreaterThan(0);
  });

  it('handles a very long verifier', () => {
    const longVerifier = 'x'.repeat(1000);
    const challenge = codeChallengeFromVerifier(longVerifier);
    expect(challenge).toMatch(/^[A-Za-z0-9_-]+$/);
  });
});

// ─── codeVerifierCookieName ──────────────────────────────────────────────────

describe('codeVerifierCookieName()', () => {
  it('returns expected name for canva', () => {
    expect(codeVerifierCookieName('canva')).toBe('oauth_pkce_canva');
  });

  it('returns expected name for youtube', () => {
    expect(codeVerifierCookieName('youtube')).toBe('oauth_pkce_youtube');
  });

  it('uses the platform name verbatim', () => {
    expect(codeVerifierCookieName('my_platform')).toBe('oauth_pkce_my_platform');
  });
});
