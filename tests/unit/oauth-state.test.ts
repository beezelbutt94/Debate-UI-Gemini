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
    expect(generateState()).toBeTruthy();
  });

  it('returns a base64url string (no +, /, = chars)', () => {
    const state = generateState();
    expect(state).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  it('returns at least 20 chars (from 24 random bytes)', () => {
    expect(generateState().length).toBeGreaterThanOrEqual(20);
  });

  it('returns different values on each call', () => {
    const a = generateState();
    const b = generateState();
    expect(a).not.toBe(b);
  });
});

// ─── stateCookieName ─────────────────────────────────────────────────────────

describe('stateCookieName', () => {
  it('returns expected pattern for youtube', () => {
    expect(stateCookieName('youtube')).toBe('oauth_state_youtube');
  });

  it('returns expected pattern for tiktok', () => {
    expect(stateCookieName('tiktok')).toBe('oauth_state_tiktok');
  });

  it('returns expected pattern for facebook', () => {
    expect(stateCookieName('facebook')).toBe('oauth_state_facebook');
  });

  it('returns expected pattern for canva', () => {
    expect(stateCookieName('canva')).toBe('oauth_state_canva');
  });

  it('uses the platform name literally', () => {
    expect(stateCookieName('custom')).toBe('oauth_state_custom');
  });
});

// ─── generateCodeVerifier ────────────────────────────────────────────────────

describe('generateCodeVerifier', () => {
  it('returns a non-empty string', () => {
    expect(generateCodeVerifier()).toBeTruthy();
  });

  it('returns a base64url string (no +, /, = chars)', () => {
    const verifier = generateCodeVerifier();
    expect(verifier).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  it('returns at least 40 chars (from 32 random bytes)', () => {
    expect(generateCodeVerifier().length).toBeGreaterThanOrEqual(40);
  });

  it('returns different values on each call', () => {
    const a = generateCodeVerifier();
    const b = generateCodeVerifier();
    expect(a).not.toBe(b);
  });
});

// ─── codeChallengeFromVerifier ───────────────────────────────────────────────

describe('codeChallengeFromVerifier', () => {
  it('produces a base64url string', () => {
    const challenge = codeChallengeFromVerifier('some-verifier');
    expect(challenge).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  it('is deterministic for the same verifier', () => {
    const v = 'fixed-verifier-value';
    expect(codeChallengeFromVerifier(v)).toBe(codeChallengeFromVerifier(v));
  });

  it('matches SHA-256 base64url of the verifier', () => {
    const verifier = 'test-verifier-abc123';
    const expected = createHash('sha256').update(verifier).digest('base64url');
    expect(codeChallengeFromVerifier(verifier)).toBe(expected);
  });

  it('produces different challenges for different verifiers', () => {
    const a = codeChallengeFromVerifier('verifier-a');
    const b = codeChallengeFromVerifier('verifier-b');
    expect(a).not.toBe(b);
  });

  it('round-trip: challenge from real verifier can be verified independently', () => {
    const verifier = generateCodeVerifier();
    const challenge = codeChallengeFromVerifier(verifier);
    const expected = createHash('sha256').update(verifier).digest('base64url');
    expect(challenge).toBe(expected);
  });

  it('handles empty string verifier', () => {
    const challenge = codeChallengeFromVerifier('');
    expect(challenge).toBeTruthy();
    expect(challenge).toMatch(/^[A-Za-z0-9_-]+$/);
  });
});

// ─── codeVerifierCookieName ──────────────────────────────────────────────────

describe('codeVerifierCookieName', () => {
  it('returns expected pattern for canva', () => {
    expect(codeVerifierCookieName('canva')).toBe('oauth_pkce_canva');
  });

  it('returns expected pattern for youtube', () => {
    expect(codeVerifierCookieName('youtube')).toBe('oauth_pkce_youtube');
  });

  it('uses the platform name literally', () => {
    expect(codeVerifierCookieName('custom')).toBe('oauth_pkce_custom');
  });
});
