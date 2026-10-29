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
    expect(generateState().length).toBeGreaterThan(0);
  });

  it('returns a base64url-encoded string (only URL-safe chars)', () => {
    const state = generateState();
    // base64url uses A-Z, a-z, 0-9, -, _  — no +, /, or = padding
    expect(state).toMatch(/^[A-Za-z0-9\-_]+$/);
  });

  it('generates unique values on repeated calls', () => {
    const states = new Set(Array.from({ length: 20 }, () => generateState()));
    expect(states.size).toBe(20);
  });

  it('produces strings of expected length for 24 random bytes (~32 base64url chars)', () => {
    // 24 bytes → ceil(24*4/3) = 32 chars (base64url, no padding)
    expect(generateState().length).toBe(32);
  });
});

describe('stateCookieName()', () => {
  it('returns expected cookie name for a platform', () => {
    expect(stateCookieName('youtube')).toBe('oauth_state_youtube');
  });

  it('includes the platform name', () => {
    expect(stateCookieName('tiktok')).toBe('oauth_state_tiktok');
    expect(stateCookieName('facebook')).toBe('oauth_state_facebook');
    expect(stateCookieName('canva')).toBe('oauth_state_canva');
  });

  it('returns a string for any input', () => {
    expect(typeof stateCookieName('any_platform')).toBe('string');
  });

  it('prefix is always "oauth_state_"', () => {
    expect(stateCookieName('xyz')).toMatch(/^oauth_state_/);
  });
});

describe('generateCodeVerifier()', () => {
  it('returns a non-empty base64url string', () => {
    const v = generateCodeVerifier();
    expect(v).toMatch(/^[A-Za-z0-9\-_]+$/);
  });

  it('produces strings of expected length for 32 random bytes (~43 base64url chars)', () => {
    // 32 bytes → ceil(32*4/3) = 43 chars (base64url, no padding)
    expect(generateCodeVerifier().length).toBe(43);
  });

  it('generates unique verifiers on repeated calls', () => {
    const verifiers = new Set(Array.from({ length: 20 }, () => generateCodeVerifier()));
    expect(verifiers.size).toBe(20);
  });
});

describe('codeChallengeFromVerifier()', () => {
  it('produces a base64url-encoded SHA-256 digest', () => {
    const verifier = 'test_verifier_string';
    const challenge = codeChallengeFromVerifier(verifier);
    // Verify manually
    const expected = createHash('sha256').update(verifier).digest('base64url');
    expect(challenge).toBe(expected);
  });

  it('returns only URL-safe characters', () => {
    const challenge = codeChallengeFromVerifier(generateCodeVerifier());
    expect(challenge).toMatch(/^[A-Za-z0-9\-_]+$/);
  });

  it('SHA-256 output is always 43 base64url chars (256 bits)', () => {
    const challenge = codeChallengeFromVerifier('arbitrary input');
    expect(challenge.length).toBe(43);
  });

  it('is deterministic for the same verifier', () => {
    const v = 'constant_input';
    expect(codeChallengeFromVerifier(v)).toBe(codeChallengeFromVerifier(v));
  });

  it('produces different challenges for different verifiers', () => {
    expect(codeChallengeFromVerifier('aaa')).not.toBe(codeChallengeFromVerifier('bbb'));
  });

  it('round-trips: verifier generated then challenged is a valid challenge', () => {
    const verifier = generateCodeVerifier();
    const challenge = codeChallengeFromVerifier(verifier);
    const recomputed = createHash('sha256').update(verifier).digest('base64url');
    expect(challenge).toBe(recomputed);
  });
});

describe('codeVerifierCookieName()', () => {
  it('returns expected cookie name for a platform', () => {
    expect(codeVerifierCookieName('canva')).toBe('oauth_pkce_canva');
  });

  it('includes the platform name', () => {
    expect(codeVerifierCookieName('youtube')).toBe('oauth_pkce_youtube');
    expect(codeVerifierCookieName('tiktok')).toBe('oauth_pkce_tiktok');
  });

  it('prefix is always "oauth_pkce_"', () => {
    expect(codeVerifierCookieName('any')).toMatch(/^oauth_pkce_/);
  });

  it('returns a string type', () => {
    expect(typeof codeVerifierCookieName('x')).toBe('string');
  });
});
