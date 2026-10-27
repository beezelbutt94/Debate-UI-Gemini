import { describe, it, expect } from 'vitest';
import { createHash } from 'crypto';
import {
  generateState,
  stateCookieName,
  generateCodeVerifier,
  codeChallengeFromVerifier,
  codeVerifierCookieName,
} from '@/lib/oauth/state';

// ── generateState ─────────────────────────────────────────────────────────────

describe('generateState()', () => {
  it('returns a non-empty string', () => {
    expect(typeof generateState()).toBe('string');
    expect(generateState().length).toBeGreaterThan(0);
  });

  it('returns only base64url characters', () => {
    const state = generateState();
    // base64url alphabet: A-Z, a-z, 0-9, -, _  (no +, /, or =)
    expect(state).toMatch(/^[A-Za-z0-9\-_]+$/);
  });

  it('returns a string of expected length (~32 chars for 24 random bytes)', () => {
    // 24 bytes * (4/3) = 32 base64 chars
    const state = generateState();
    expect(state.length).toBeGreaterThanOrEqual(30);
    expect(state.length).toBeLessThanOrEqual(36);
  });

  it('returns a different value on each call (probabilistic uniqueness)', () => {
    const states = new Set(Array.from({ length: 20 }, () => generateState()));
    expect(states.size).toBe(20);
  });
});

// ── stateCookieName ───────────────────────────────────────────────────────────

describe('stateCookieName()', () => {
  it('returns the correct format for youtube', () => {
    expect(stateCookieName('youtube')).toBe('oauth_state_youtube');
  });

  it('returns the correct format for tiktok', () => {
    expect(stateCookieName('tiktok')).toBe('oauth_state_tiktok');
  });

  it('returns the correct format for facebook', () => {
    expect(stateCookieName('facebook')).toBe('oauth_state_facebook');
  });

  it('returns the correct format for canva', () => {
    expect(stateCookieName('canva')).toBe('oauth_state_canva');
  });

  it('handles arbitrary platform strings', () => {
    expect(stateCookieName('my_platform')).toBe('oauth_state_my_platform');
  });
});

// ── generateCodeVerifier ──────────────────────────────────────────────────────

describe('generateCodeVerifier()', () => {
  it('returns a non-empty string', () => {
    expect(typeof generateCodeVerifier()).toBe('string');
    expect(generateCodeVerifier().length).toBeGreaterThan(0);
  });

  it('returns only base64url characters (PKCE §4.1 requirement)', () => {
    const verifier = generateCodeVerifier();
    expect(verifier).toMatch(/^[A-Za-z0-9\-_]+$/);
  });

  it('returns a string ≥43 characters (RFC 7636 minimum)', () => {
    // 32 bytes → ceil(32 * 4/3) = 43 base64 chars
    expect(generateCodeVerifier().length).toBeGreaterThanOrEqual(43);
  });

  it('returns a different value on each call', () => {
    const verifiers = new Set(Array.from({ length: 20 }, () => generateCodeVerifier()));
    expect(verifiers.size).toBe(20);
  });
});

// ── codeChallengeFromVerifier ─────────────────────────────────────────────────

describe('codeChallengeFromVerifier()', () => {
  it('produces a SHA-256 base64url digest of the verifier', () => {
    const verifier = 'test-verifier-string';
    const expected = createHash('sha256').update(verifier).digest('base64url');
    expect(codeChallengeFromVerifier(verifier)).toBe(expected);
  });

  it('is deterministic: same input → same output', () => {
    const v = 'some-fixed-verifier';
    expect(codeChallengeFromVerifier(v)).toBe(codeChallengeFromVerifier(v));
  });

  it('produces different challenges for different verifiers', () => {
    expect(codeChallengeFromVerifier('verifier-a')).not.toBe(
      codeChallengeFromVerifier('verifier-b')
    );
  });

  it('returns only base64url characters (no +, /, or =)', () => {
    const challenge = codeChallengeFromVerifier(generateCodeVerifier());
    expect(challenge).toMatch(/^[A-Za-z0-9\-_]+$/);
  });

  it('returns a string of 43 characters (256-bit SHA-256 in base64url)', () => {
    // SHA-256 → 32 bytes → 43 base64url chars (no padding)
    const challenge = codeChallengeFromVerifier('any-verifier');
    expect(challenge.length).toBe(43);
  });

  it('round-trips: a real verifier produces a valid challenge', () => {
    const verifier = generateCodeVerifier();
    const challenge = codeChallengeFromVerifier(verifier);
    // Verify independently
    const expected = createHash('sha256').update(verifier).digest('base64url');
    expect(challenge).toBe(expected);
  });
});

// ── codeVerifierCookieName ────────────────────────────────────────────────────

describe('codeVerifierCookieName()', () => {
  it('returns the correct format for canva', () => {
    expect(codeVerifierCookieName('canva')).toBe('oauth_pkce_canva');
  });

  it('returns the correct format for youtube', () => {
    expect(codeVerifierCookieName('youtube')).toBe('oauth_pkce_youtube');
  });

  it('handles arbitrary platform strings', () => {
    expect(codeVerifierCookieName('new_platform')).toBe('oauth_pkce_new_platform');
  });
});
