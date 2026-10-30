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
    expect(typeof generateState()).toBe('string');
    expect(generateState().length).toBeGreaterThan(0);
  });

  it('returns a base64url string (no +, /, = characters)', () => {
    const state = generateState();
    expect(state).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  it('returns values of consistent length (~32 chars for 24 random bytes base64url)', () => {
    const len = generateState().length;
    // 24 bytes → ceil(24 * 4 / 3) = 32 base64url chars (no padding)
    expect(len).toBe(32);
  });

  it('produces unique values on every call', () => {
    const states = new Set(Array.from({ length: 50 }, generateState));
    expect(states.size).toBe(50);
  });
});

describe('stateCookieName()', () => {
  it('returns the expected cookie name for youtube', () => {
    expect(stateCookieName('youtube')).toBe('oauth_state_youtube');
  });

  it('returns the expected cookie name for tiktok', () => {
    expect(stateCookieName('tiktok')).toBe('oauth_state_tiktok');
  });

  it('returns the expected cookie name for facebook', () => {
    expect(stateCookieName('facebook')).toBe('oauth_state_facebook');
  });

  it('returns the expected cookie name for canva', () => {
    expect(stateCookieName('canva')).toBe('oauth_state_canva');
  });

  it('handles an arbitrary platform string', () => {
    expect(stateCookieName('some_future_platform')).toBe('oauth_state_some_future_platform');
  });
});

describe('generateCodeVerifier()', () => {
  it('returns a non-empty base64url string', () => {
    const verifier = generateCodeVerifier();
    expect(verifier).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  it('returns 43 chars for 32 random bytes (RFC 7636 minimum length)', () => {
    // 32 bytes → ceil(32 * 4 / 3) = 43 base64url chars (no padding)
    expect(generateCodeVerifier().length).toBe(43);
  });

  it('produces unique values on every call', () => {
    const verifiers = new Set(Array.from({ length: 50 }, generateCodeVerifier));
    expect(verifiers.size).toBe(50);
  });
});

describe('codeChallengeFromVerifier()', () => {
  it('produces a base64url string with no padding', () => {
    const challenge = codeChallengeFromVerifier('test-verifier');
    expect(challenge).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  it('produces the correct SHA-256 base64url for a known verifier', () => {
    const verifier = 'dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk';
    const expected = createHash('sha256').update(verifier).digest('base64url');
    expect(codeChallengeFromVerifier(verifier)).toBe(expected);
  });

  it('is deterministic: same verifier → same challenge', () => {
    const v = generateCodeVerifier();
    expect(codeChallengeFromVerifier(v)).toBe(codeChallengeFromVerifier(v));
  });

  it('produces different challenges for different verifiers', () => {
    const a = codeChallengeFromVerifier('aaa');
    const b = codeChallengeFromVerifier('bbb');
    expect(a).not.toBe(b);
  });

  it('round-trips: generate verifier, derive challenge, verify via Node crypto', () => {
    const verifier = generateCodeVerifier();
    const challenge = codeChallengeFromVerifier(verifier);
    const expected = createHash('sha256').update(verifier).digest('base64url');
    expect(challenge).toBe(expected);
  });
});

describe('codeVerifierCookieName()', () => {
  it('returns the expected cookie name for canva', () => {
    expect(codeVerifierCookieName('canva')).toBe('oauth_pkce_canva');
  });

  it('handles an arbitrary platform string', () => {
    expect(codeVerifierCookieName('test')).toBe('oauth_pkce_test');
  });
});
