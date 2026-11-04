import { describe, it, expect } from 'vitest';
import { createHash } from 'crypto';
import {
  generateState,
  stateCookieName,
  generateCodeVerifier,
  codeChallengeFromVerifier,
  codeVerifierCookieName,
} from '@/lib/oauth/state';

describe('generateState()', () => {
  it('returns a non-empty string', () => {
    expect(generateState()).toBeTruthy();
    expect(typeof generateState()).toBe('string');
  });

  it('returns a base64url string (no +, /, or = characters)', () => {
    const state = generateState();
    expect(state).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  it('returns different values on each call', () => {
    const a = generateState();
    const b = generateState();
    expect(a).not.toBe(b);
  });

  it('produces 32 bytes encoded as base64url (length is 43)', () => {
    // randomBytes(24) → 24 bytes → base64url length = Math.ceil(24 / 3) * 4 = 32 chars (no padding)
    // base64url of 24 bytes = 32 chars
    const state = generateState();
    expect(state.length).toBe(32);
  });

  it('is unique across many generations', () => {
    const states = new Set(Array.from({ length: 100 }, generateState));
    expect(states.size).toBe(100);
  });
});

describe('stateCookieName()', () => {
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

  it('prefixes any platform string with oauth_state_', () => {
    expect(stateCookieName('x')).toBe('oauth_state_x');
  });
});

describe('generateCodeVerifier()', () => {
  it('returns a non-empty string', () => {
    expect(generateCodeVerifier()).toBeTruthy();
    expect(typeof generateCodeVerifier()).toBe('string');
  });

  it('returns a base64url string (no +, /, or = characters)', () => {
    const verifier = generateCodeVerifier();
    expect(verifier).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  it('produces 32 bytes encoded as base64url (43 chars)', () => {
    // randomBytes(32) → 32 bytes → base64url length = 43 chars
    const verifier = generateCodeVerifier();
    expect(verifier.length).toBe(43);
  });

  it('returns different values on each call', () => {
    const a = generateCodeVerifier();
    const b = generateCodeVerifier();
    expect(a).not.toBe(b);
  });

  it('is unique across many generations', () => {
    const verifiers = new Set(Array.from({ length: 100 }, generateCodeVerifier));
    expect(verifiers.size).toBe(100);
  });
});

describe('codeChallengeFromVerifier()', () => {
  it('returns a base64url-encoded SHA-256 hash', () => {
    const verifier = 'test-verifier-string';
    const expected = createHash('sha256').update(verifier).digest('base64url');
    expect(codeChallengeFromVerifier(verifier)).toBe(expected);
  });

  it('returns a base64url string (no +, /, or = characters)', () => {
    const challenge = codeChallengeFromVerifier('any-verifier');
    expect(challenge).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  it('produces 43-character output for a SHA-256 hash in base64url', () => {
    // SHA-256 = 32 bytes → base64url = 43 chars
    const challenge = codeChallengeFromVerifier('verifier');
    expect(challenge.length).toBe(43);
  });

  it('is deterministic — same verifier always gives same challenge', () => {
    const v = 'consistent-verifier';
    expect(codeChallengeFromVerifier(v)).toBe(codeChallengeFromVerifier(v));
  });

  it('produces different outputs for different verifiers', () => {
    expect(codeChallengeFromVerifier('aaa')).not.toBe(codeChallengeFromVerifier('bbb'));
  });

  it('round-trips: verifier → challenge matches the spec derivation', () => {
    const verifier = generateCodeVerifier();
    const expected = createHash('sha256').update(verifier).digest('base64url');
    expect(codeChallengeFromVerifier(verifier)).toBe(expected);
  });

  it('handles an empty string verifier', () => {
    const expected = createHash('sha256').update('').digest('base64url');
    expect(codeChallengeFromVerifier('')).toBe(expected);
  });

  it('handles unicode characters in the verifier', () => {
    const v = 'héllo-wörld';
    const expected = createHash('sha256').update(v).digest('base64url');
    expect(codeChallengeFromVerifier(v)).toBe(expected);
  });
});

describe('codeVerifierCookieName()', () => {
  it('returns expected pattern for canva', () => {
    expect(codeVerifierCookieName('canva')).toBe('oauth_pkce_canva');
  });

  it('returns expected pattern for youtube', () => {
    expect(codeVerifierCookieName('youtube')).toBe('oauth_pkce_youtube');
  });

  it('prefixes any platform string with oauth_pkce_', () => {
    expect(codeVerifierCookieName('test')).toBe('oauth_pkce_test');
  });
});
