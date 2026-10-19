import { describe, it, expect } from 'vitest';
import {
  generateState,
  generateCodeVerifier,
  codeChallengeFromVerifier,
  stateCookieName,
  codeVerifierCookieName,
} from '@/lib/oauth/state';
import { createHash } from 'crypto';

describe('generateState', () => {
  it('returns a string', () => {
    expect(typeof generateState()).toBe('string');
  });

  it('is a valid base64url string (no +, /, or = chars)', () => {
    const state = generateState();
    expect(state).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  it('is 32 characters long (24 random bytes → base64url)', () => {
    // 24 bytes → ceil(24/3)*4 = 32 base64url chars (no padding)
    expect(generateState()).toHaveLength(32);
  });

  it('generates unique values each time', () => {
    const a = generateState();
    const b = generateState();
    expect(a).not.toBe(b);
  });
});

describe('generateCodeVerifier', () => {
  it('returns a string', () => {
    expect(typeof generateCodeVerifier()).toBe('string');
  });

  it('is a valid base64url string', () => {
    expect(generateCodeVerifier()).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  it('is 43 characters long (32 random bytes → base64url)', () => {
    // 32 bytes → ceil(32/3)*4 = 44 base64url chars but without padding = 43
    expect(generateCodeVerifier()).toHaveLength(43);
  });

  it('generates unique values each time', () => {
    const a = generateCodeVerifier();
    const b = generateCodeVerifier();
    expect(a).not.toBe(b);
  });
});

describe('codeChallengeFromVerifier', () => {
  it('returns a valid base64url string', () => {
    expect(codeChallengeFromVerifier('someverifier')).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  it('is deterministic for the same input', () => {
    const v = 'testverifier123';
    expect(codeChallengeFromVerifier(v)).toBe(codeChallengeFromVerifier(v));
  });

  it('matches an independent SHA-256 base64url calculation', () => {
    const verifier = 'abc123XYZ-_testVerifier';
    const expected = createHash('sha256').update(verifier).digest('base64url');
    expect(codeChallengeFromVerifier(verifier)).toBe(expected);
  });

  it('produces different outputs for different verifiers', () => {
    expect(codeChallengeFromVerifier('aaa')).not.toBe(codeChallengeFromVerifier('bbb'));
  });

  it('round-trips: verifier from generateCodeVerifier produces a 43-char challenge', () => {
    const verifier = generateCodeVerifier();
    const challenge = codeChallengeFromVerifier(verifier);
    // SHA-256 is 32 bytes → 43 base64url chars
    expect(challenge).toHaveLength(43);
    expect(challenge).toMatch(/^[A-Za-z0-9_-]+$/);
  });
});

describe('stateCookieName', () => {
  it('returns the expected pattern', () => {
    expect(stateCookieName('youtube')).toBe('oauth_state_youtube');
  });

  it('works for all platforms', () => {
    expect(stateCookieName('tiktok')).toBe('oauth_state_tiktok');
    expect(stateCookieName('facebook')).toBe('oauth_state_facebook');
    expect(stateCookieName('canva')).toBe('oauth_state_canva');
  });

  it('preserves whatever platform string is passed', () => {
    expect(stateCookieName('custom-platform')).toBe('oauth_state_custom-platform');
  });
});

describe('codeVerifierCookieName', () => {
  it('returns the expected pattern', () => {
    expect(codeVerifierCookieName('canva')).toBe('oauth_pkce_canva');
  });

  it('works for all platforms', () => {
    expect(codeVerifierCookieName('youtube')).toBe('oauth_pkce_youtube');
    expect(codeVerifierCookieName('tiktok')).toBe('oauth_pkce_tiktok');
    expect(codeVerifierCookieName('facebook')).toBe('oauth_pkce_facebook');
  });
});
