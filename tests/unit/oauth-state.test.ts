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
    expect(generateState()).toBeTruthy();
  });

  it('returns a base64url string (no +, /, = padding)', () => {
    const state = generateState();
    expect(state).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  it('returns a sufficiently long value (24 random bytes → ~32 base64url chars)', () => {
    const state = generateState();
    expect(state.length).toBeGreaterThanOrEqual(32);
  });

  it('generates unique values each call', () => {
    const states = new Set(Array.from({ length: 20 }, () => generateState()));
    expect(states.size).toBe(20);
  });
});

describe('stateCookieName()', () => {
  it('prefixes platform with oauth_state_', () => {
    expect(stateCookieName('youtube')).toBe('oauth_state_youtube');
  });

  it('works for tiktok', () => {
    expect(stateCookieName('tiktok')).toBe('oauth_state_tiktok');
  });

  it('works for facebook', () => {
    expect(stateCookieName('facebook')).toBe('oauth_state_facebook');
  });

  it('works for canva', () => {
    expect(stateCookieName('canva')).toBe('oauth_state_canva');
  });

  it('handles arbitrary string input', () => {
    expect(stateCookieName('custom_platform')).toBe('oauth_state_custom_platform');
  });
});

describe('generateCodeVerifier()', () => {
  it('returns a non-empty string', () => {
    expect(generateCodeVerifier()).toBeTruthy();
  });

  it('returns a base64url string', () => {
    const verifier = generateCodeVerifier();
    expect(verifier).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  it('returns at least 43 chars (32 bytes → 43 base64url chars, RFC7636 minimum)', () => {
    const verifier = generateCodeVerifier();
    expect(verifier.length).toBeGreaterThanOrEqual(43);
  });

  it('generates unique values each call', () => {
    const verifiers = new Set(Array.from({ length: 20 }, () => generateCodeVerifier()));
    expect(verifiers.size).toBe(20);
  });
});

describe('codeChallengeFromVerifier()', () => {
  it('returns a non-empty string', () => {
    expect(codeChallengeFromVerifier('some-verifier')).toBeTruthy();
  });

  it('returns a base64url string', () => {
    const challenge = codeChallengeFromVerifier('some-verifier');
    expect(challenge).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  it('is deterministic for the same input', () => {
    const verifier = 'fixed-verifier-string';
    expect(codeChallengeFromVerifier(verifier)).toBe(codeChallengeFromVerifier(verifier));
  });

  it('matches SHA-256(verifier) encoded as base64url', () => {
    const verifier = 'test-verifier-abc';
    const expected = createHash('sha256').update(verifier).digest('base64url');
    expect(codeChallengeFromVerifier(verifier)).toBe(expected);
  });

  it('produces different output for different verifiers', () => {
    const c1 = codeChallengeFromVerifier('verifier-one');
    const c2 = codeChallengeFromVerifier('verifier-two');
    expect(c1).not.toBe(c2);
  });

  it('round-trips with a generated verifier (challenge is valid SHA-256 base64url)', () => {
    const verifier = generateCodeVerifier();
    const challenge = codeChallengeFromVerifier(verifier);
    const expected = createHash('sha256').update(verifier).digest('base64url');
    expect(challenge).toBe(expected);
  });

  it('output length is 43 chars (SHA-256 → 32 bytes → 43 base64url chars)', () => {
    const challenge = codeChallengeFromVerifier('any-input');
    expect(challenge.length).toBe(43);
  });
});

describe('codeVerifierCookieName()', () => {
  it('prefixes platform with oauth_pkce_', () => {
    expect(codeVerifierCookieName('canva')).toBe('oauth_pkce_canva');
  });

  it('works for youtube', () => {
    expect(codeVerifierCookieName('youtube')).toBe('oauth_pkce_youtube');
  });

  it('works for tiktok', () => {
    expect(codeVerifierCookieName('tiktok')).toBe('oauth_pkce_tiktok');
  });

  it('works for facebook', () => {
    expect(codeVerifierCookieName('facebook')).toBe('oauth_pkce_facebook');
  });

  it('handles arbitrary platform string', () => {
    expect(codeVerifierCookieName('my-platform')).toBe('oauth_pkce_my-platform');
  });
});
