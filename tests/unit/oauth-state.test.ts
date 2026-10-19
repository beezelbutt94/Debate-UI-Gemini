import { describe, it, expect } from 'vitest';
import {
  generateState,
  stateCookieName,
  generateCodeVerifier,
  codeChallengeFromVerifier,
  codeVerifierCookieName,
} from '@/lib/oauth/state';
import { createHash } from 'crypto';

describe('generateState', () => {
  it('returns a non-empty string', () => {
    expect(generateState()).toBeTruthy();
  });

  it('returns a base64url string (no +, /, or = chars)', () => {
    const state = generateState();
    expect(state).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  it('is at least 30 characters long (24 random bytes → 32 base64url chars)', () => {
    expect(generateState().length).toBeGreaterThanOrEqual(30);
  });

  it('generates different values on successive calls (CSRF uniqueness)', () => {
    const values = new Set(Array.from({ length: 20 }, generateState));
    expect(values.size).toBe(20);
  });
});

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

  it('uses the platform name verbatim in the suffix', () => {
    expect(stateCookieName('custom_platform')).toBe('oauth_state_custom_platform');
  });
});

describe('generateCodeVerifier', () => {
  it('returns a non-empty string', () => {
    expect(generateCodeVerifier()).toBeTruthy();
  });

  it('returns a base64url string (no +, /, or = chars)', () => {
    expect(generateCodeVerifier()).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  it('is at least 40 characters (32 random bytes → ~43 base64url chars)', () => {
    expect(generateCodeVerifier().length).toBeGreaterThanOrEqual(40);
  });

  it('generates unique verifiers across calls', () => {
    const values = new Set(Array.from({ length: 20 }, generateCodeVerifier));
    expect(values.size).toBe(20);
  });
});

describe('codeChallengeFromVerifier', () => {
  it('produces a base64url string (no +, /, or = chars)', () => {
    const challenge = codeChallengeFromVerifier('some-verifier-value');
    expect(challenge).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  it('is deterministic for a given verifier', () => {
    const v = 'my-stable-verifier';
    expect(codeChallengeFromVerifier(v)).toBe(codeChallengeFromVerifier(v));
  });

  it('produces the correct SHA-256 base64url hash', () => {
    const verifier = 'dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk';
    const expected = createHash('sha256').update(verifier).digest('base64url');
    expect(codeChallengeFromVerifier(verifier)).toBe(expected);
  });

  it('different verifiers produce different challenges', () => {
    expect(codeChallengeFromVerifier('abc')).not.toBe(codeChallengeFromVerifier('xyz'));
  });

  it('challenge derived from a real generated verifier is also base64url', () => {
    const verifier = generateCodeVerifier();
    const challenge = codeChallengeFromVerifier(verifier);
    expect(challenge).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  it('round-trip: verifier → challenge matches manual SHA-256', () => {
    const verifier = generateCodeVerifier();
    const manual = createHash('sha256').update(verifier).digest('base64url');
    expect(codeChallengeFromVerifier(verifier)).toBe(manual);
  });
});

describe('codeVerifierCookieName', () => {
  it('returns expected name for canva', () => {
    expect(codeVerifierCookieName('canva')).toBe('oauth_pkce_canva');
  });

  it('returns expected name for youtube', () => {
    expect(codeVerifierCookieName('youtube')).toBe('oauth_pkce_youtube');
  });

  it('uses the platform name verbatim in the suffix', () => {
    expect(codeVerifierCookieName('my_platform')).toBe('oauth_pkce_my_platform');
  });

  it('state and verifier cookies have different prefixes', () => {
    expect(stateCookieName('youtube')).not.toBe(codeVerifierCookieName('youtube'));
  });
});
