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
    expect(typeof generateState()).toBe('string');
    expect(generateState().length).toBeGreaterThan(0);
  });

  it('uses base64url encoding (no +, /, or = padding)', () => {
    const state = generateState();
    expect(state).not.toMatch(/[+/=]/);
  });

  it('produces unique values each call', () => {
    const states = Array.from({ length: 20 }, () => generateState());
    const unique = new Set(states);
    expect(unique.size).toBe(20);
  });

  it('is at least 32 characters (24 random bytes → 32 base64url chars)', () => {
    expect(generateState().length).toBeGreaterThanOrEqual(32);
  });
});

describe('stateCookieName', () => {
  it('includes the platform name', () => {
    expect(stateCookieName('youtube')).toBe('oauth_state_youtube');
  });

  it('handles any platform string', () => {
    expect(stateCookieName('tiktok')).toBe('oauth_state_tiktok');
    expect(stateCookieName('facebook')).toBe('oauth_state_facebook');
    expect(stateCookieName('canva')).toBe('oauth_state_canva');
  });
});

describe('generateCodeVerifier', () => {
  it('returns a non-empty base64url string', () => {
    const v = generateCodeVerifier();
    expect(typeof v).toBe('string');
    expect(v.length).toBeGreaterThan(0);
    expect(v).not.toMatch(/[+/=]/);
  });

  it('is at least 43 characters (32 bytes → 43 base64url chars)', () => {
    expect(generateCodeVerifier().length).toBeGreaterThanOrEqual(43);
  });

  it('produces unique values each call', () => {
    const verifiers = Array.from({ length: 20 }, () => generateCodeVerifier());
    const unique = new Set(verifiers);
    expect(unique.size).toBe(20);
  });
});

describe('codeChallengeFromVerifier', () => {
  it('produces a base64url-encoded SHA-256 of the verifier', () => {
    const verifier = 'test-verifier-string';
    const expected = createHash('sha256').update(verifier).digest('base64url');
    expect(codeChallengeFromVerifier(verifier)).toBe(expected);
  });

  it('produces different output for different verifiers', () => {
    expect(codeChallengeFromVerifier('abc')).not.toBe(codeChallengeFromVerifier('def'));
  });

  it('is deterministic for the same input', () => {
    const v = generateCodeVerifier();
    expect(codeChallengeFromVerifier(v)).toBe(codeChallengeFromVerifier(v));
  });

  it('does not contain + / or = (base64url clean)', () => {
    const challenge = codeChallengeFromVerifier(generateCodeVerifier());
    expect(challenge).not.toMatch(/[+/=]/);
  });
});

describe('codeVerifierCookieName', () => {
  it('includes the platform name', () => {
    expect(codeVerifierCookieName('canva')).toBe('oauth_pkce_canva');
  });

  it('handles any platform string', () => {
    expect(codeVerifierCookieName('youtube')).toBe('oauth_pkce_youtube');
    expect(codeVerifierCookieName('tiktok')).toBe('oauth_pkce_tiktok');
  });
});
