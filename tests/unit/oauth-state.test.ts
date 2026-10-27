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

  it('returns a base64url-safe string (no +, /, or = padding)', () => {
    const state = generateState();
    expect(state).not.toMatch(/[+/=]/);
  });

  it('returns a unique value on each call (entropy check)', () => {
    const values = new Set(Array.from({ length: 20 }, () => generateState()));
    expect(values.size).toBe(20);
  });

  it('is at least 32 characters (24 random bytes → ~32 base64url chars)', () => {
    expect(generateState().length).toBeGreaterThanOrEqual(32);
  });
});

// ---------------------------------------------------------------------------
// stateCookieName
// ---------------------------------------------------------------------------

describe('stateCookieName()', () => {
  it('returns the correct prefix for youtube', () => {
    expect(stateCookieName('youtube')).toBe('oauth_state_youtube');
  });

  it('returns the correct prefix for tiktok', () => {
    expect(stateCookieName('tiktok')).toBe('oauth_state_tiktok');
  });

  it('returns the correct prefix for facebook', () => {
    expect(stateCookieName('facebook')).toBe('oauth_state_facebook');
  });

  it('returns the correct prefix for canva', () => {
    expect(stateCookieName('canva')).toBe('oauth_state_canva');
  });

  it('includes the platform name verbatim', () => {
    expect(stateCookieName('custom_platform')).toBe('oauth_state_custom_platform');
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

  it('returns a base64url-safe string (no +, /, or = padding)', () => {
    const v = generateCodeVerifier();
    expect(v).not.toMatch(/[+/=]/);
  });

  it('returns a unique value on each call', () => {
    const values = new Set(Array.from({ length: 20 }, () => generateCodeVerifier()));
    expect(values.size).toBe(20);
  });

  it('is at least 43 characters (32 random bytes → ~43 base64url chars)', () => {
    expect(generateCodeVerifier().length).toBeGreaterThanOrEqual(43);
  });
});

// ---------------------------------------------------------------------------
// codeChallengeFromVerifier
// ---------------------------------------------------------------------------

describe('codeChallengeFromVerifier()', () => {
  it('returns the SHA-256 base64url hash of the verifier', () => {
    const verifier = 'test-verifier-value';
    const expected = createHash('sha256').update(verifier).digest('base64url');
    expect(codeChallengeFromVerifier(verifier)).toBe(expected);
  });

  it('is deterministic — same input always yields same output', () => {
    const v = generateCodeVerifier();
    expect(codeChallengeFromVerifier(v)).toBe(codeChallengeFromVerifier(v));
  });

  it('produces different output for different verifiers', () => {
    const a = generateCodeVerifier();
    const b = generateCodeVerifier();
    expect(codeChallengeFromVerifier(a)).not.toBe(codeChallengeFromVerifier(b));
  });

  it('returns a base64url-safe string', () => {
    const challenge = codeChallengeFromVerifier('any-string');
    expect(challenge).not.toMatch(/[+/=]/);
  });

  it('is 43 characters for a SHA-256 hash encoded as base64url', () => {
    const challenge = codeChallengeFromVerifier('any-string');
    expect(challenge.length).toBe(43);
  });
});

// ---------------------------------------------------------------------------
// codeVerifierCookieName
// ---------------------------------------------------------------------------

describe('codeVerifierCookieName()', () => {
  it('returns the correct prefix for canva', () => {
    expect(codeVerifierCookieName('canva')).toBe('oauth_pkce_canva');
  });

  it('returns the correct prefix for youtube', () => {
    expect(codeVerifierCookieName('youtube')).toBe('oauth_pkce_youtube');
  });

  it('includes the platform name verbatim', () => {
    expect(codeVerifierCookieName('my_platform')).toBe('oauth_pkce_my_platform');
  });
});
