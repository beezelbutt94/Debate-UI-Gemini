import { describe, it, expect } from 'vitest';
import { createHash } from 'crypto';
import {
  generateState,
  stateCookieName,
  generateCodeVerifier,
  codeChallengeFromVerifier,
  codeVerifierCookieName,
} from '@/lib/oauth/state';

// base64url character set (RFC 4648 §5): A-Z a-z 0-9 - _
const BASE64URL_PATTERN = /^[A-Za-z0-9\-_]+$/;

describe('generateState()', () => {
  it('returns a non-empty string', () => {
    expect(generateState().length).toBeGreaterThan(0);
  });

  it('uses only base64url characters (no + / = padding)', () => {
    expect(generateState()).toMatch(BASE64URL_PATTERN);
  });

  it('produces the expected length for 24 random bytes (32 chars, no padding)', () => {
    // 24 bytes → ceil(24/3)*4 = 32 base64url chars
    expect(generateState()).toHaveLength(32);
  });

  it('returns a different value on each call (probabilistic)', () => {
    const states = new Set(Array.from({ length: 20 }, generateState));
    expect(states.size).toBe(20);
  });
});

describe('stateCookieName()', () => {
  it('produces the expected cookie name for youtube', () => {
    expect(stateCookieName('youtube')).toBe('oauth_state_youtube');
  });

  it('produces the expected cookie name for tiktok', () => {
    expect(stateCookieName('tiktok')).toBe('oauth_state_tiktok');
  });

  it('produces the expected cookie name for facebook', () => {
    expect(stateCookieName('facebook')).toBe('oauth_state_facebook');
  });

  it('produces the expected cookie name for canva', () => {
    expect(stateCookieName('canva')).toBe('oauth_state_canva');
  });

  it('always prefixes with oauth_state_', () => {
    expect(stateCookieName('anyplatform')).toMatch(/^oauth_state_/);
  });
});

describe('generateCodeVerifier()', () => {
  it('returns a non-empty string', () => {
    expect(generateCodeVerifier().length).toBeGreaterThan(0);
  });

  it('uses only base64url characters', () => {
    expect(generateCodeVerifier()).toMatch(BASE64URL_PATTERN);
  });

  it('produces the expected length for 32 random bytes (43 chars without padding)', () => {
    // 32 bytes: floor(32/3)=10 full groups (40 chars) + 2 remaining bytes (3 chars) = 43 chars
    expect(generateCodeVerifier()).toHaveLength(43);
  });

  it('returns a different value on each call', () => {
    const verifiers = new Set(Array.from({ length: 20 }, generateCodeVerifier));
    expect(verifiers.size).toBe(20);
  });
});

describe('codeChallengeFromVerifier()', () => {
  it('returns a non-empty string', () => {
    expect(codeChallengeFromVerifier('test-verifier')).toBeTruthy();
  });

  it('uses only base64url characters', () => {
    expect(codeChallengeFromVerifier('some-verifier')).toMatch(BASE64URL_PATTERN);
  });

  it('produces a 43-character challenge (SHA-256 = 32 bytes → 43 base64url chars)', () => {
    expect(codeChallengeFromVerifier('any-verifier-value')).toHaveLength(43);
  });

  it('is deterministic: same verifier always yields same challenge', () => {
    const v = generateCodeVerifier();
    expect(codeChallengeFromVerifier(v)).toBe(codeChallengeFromVerifier(v));
  });

  it('produces the correct SHA-256 base64url digest', () => {
    const verifier = 'my-test-verifier-string';
    const expected = createHash('sha256').update(verifier).digest('base64url');
    expect(codeChallengeFromVerifier(verifier)).toBe(expected);
  });

  it('different verifiers produce different challenges', () => {
    const v1 = generateCodeVerifier();
    const v2 = generateCodeVerifier();
    expect(codeChallengeFromVerifier(v1)).not.toBe(codeChallengeFromVerifier(v2));
  });
});

describe('codeVerifierCookieName()', () => {
  it('produces the expected cookie name for canva', () => {
    expect(codeVerifierCookieName('canva')).toBe('oauth_pkce_canva');
  });

  it('produces the expected cookie name for youtube', () => {
    expect(codeVerifierCookieName('youtube')).toBe('oauth_pkce_youtube');
  });

  it('always prefixes with oauth_pkce_', () => {
    expect(codeVerifierCookieName('anyplatform')).toMatch(/^oauth_pkce_/);
  });
});
