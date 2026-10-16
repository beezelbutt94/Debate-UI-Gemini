import { describe, it, expect } from 'vitest';
import {
  generateState,
  stateCookieName,
  generateCodeVerifier,
  codeChallengeFromVerifier,
  codeVerifierCookieName,
} from '@/lib/oauth/state';

describe('generateState', () => {
  it('returns a non-empty string', () => {
    expect(typeof generateState()).toBe('string');
    expect(generateState().length).toBeGreaterThan(0);
  });

  it('returns a base64url-safe string (no +, /, or = padding)', () => {
    const state = generateState();
    expect(state).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  it('returns a different value each call (random)', () => {
    const states = new Set(Array.from({ length: 20 }, () => generateState()));
    expect(states.size).toBe(20);
  });

  it('has a reasonable length (24 bytes → 32 base64url chars)', () => {
    // randomBytes(24).toString('base64url') is always 32 chars
    expect(generateState().length).toBe(32);
  });
});

describe('stateCookieName', () => {
  it('builds the correct cookie name for youtube', () => {
    expect(stateCookieName('youtube')).toBe('oauth_state_youtube');
  });

  it('builds the correct cookie name for tiktok', () => {
    expect(stateCookieName('tiktok')).toBe('oauth_state_tiktok');
  });

  it('builds the correct cookie name for facebook', () => {
    expect(stateCookieName('facebook')).toBe('oauth_state_facebook');
  });

  it('builds the correct cookie name for canva', () => {
    expect(stateCookieName('canva')).toBe('oauth_state_canva');
  });

  it('returns a string', () => {
    expect(typeof stateCookieName('any')).toBe('string');
  });
});

describe('generateCodeVerifier', () => {
  it('returns a non-empty string', () => {
    const v = generateCodeVerifier();
    expect(typeof v).toBe('string');
    expect(v.length).toBeGreaterThan(0);
  });

  it('is base64url-safe', () => {
    expect(generateCodeVerifier()).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  it('returns different values each call', () => {
    const verifiers = new Set(Array.from({ length: 20 }, () => generateCodeVerifier()));
    expect(verifiers.size).toBe(20);
  });

  it('has length from randomBytes(32) → 43 base64url chars', () => {
    // randomBytes(32).toString('base64url') is always 43 chars
    expect(generateCodeVerifier().length).toBe(43);
  });
});

describe('codeChallengeFromVerifier', () => {
  it('returns a non-empty string', () => {
    const challenge = codeChallengeFromVerifier('someverifier');
    expect(typeof challenge).toBe('string');
    expect(challenge.length).toBeGreaterThan(0);
  });

  it('is base64url-safe (no + / =)', () => {
    const challenge = codeChallengeFromVerifier('verifier123');
    expect(challenge).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  it('is deterministic for the same input', () => {
    const v = 'fixed-verifier-value';
    expect(codeChallengeFromVerifier(v)).toBe(codeChallengeFromVerifier(v));
  });

  it('produces different output for different inputs', () => {
    expect(codeChallengeFromVerifier('abc')).not.toBe(codeChallengeFromVerifier('def'));
  });

  it('produces the correct SHA-256 base64url for a known verifier', () => {
    // SHA-256('abc') base64url = 'ungWv48Bz-pBQUDeXa4iI7ADYaOWF3qctBD_YfIAFa0'
    expect(codeChallengeFromVerifier('abc')).toBe('ungWv48Bz-pBQUDeXa4iI7ADYaOWF3qctBD_YfIAFa0');
  });

  it('round-trips: verifier -> challenge has stable length (SHA-256 → 43 base64url)', () => {
    const verifier = generateCodeVerifier();
    expect(codeChallengeFromVerifier(verifier).length).toBe(43);
  });

  it('handles empty string input without throwing', () => {
    expect(() => codeChallengeFromVerifier('')).not.toThrow();
  });
});

describe('codeVerifierCookieName', () => {
  it('builds the correct cookie name for canva', () => {
    expect(codeVerifierCookieName('canva')).toBe('oauth_pkce_canva');
  });

  it('builds the correct cookie name for youtube', () => {
    expect(codeVerifierCookieName('youtube')).toBe('oauth_pkce_youtube');
  });

  it('is distinct from stateCookieName for the same platform', () => {
    expect(codeVerifierCookieName('canva')).not.toBe(stateCookieName('canva'));
  });

  it('returns a string', () => {
    expect(typeof codeVerifierCookieName('test')).toBe('string');
  });
});
