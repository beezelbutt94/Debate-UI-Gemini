import { describe, it, expect } from 'vitest';
import { createHash } from 'crypto';
import {
  generateState,
  stateCookieName,
  generateCodeVerifier,
  codeChallengeFromVerifier,
  codeVerifierCookieName,
} from '@/lib/oauth/state';

const BASE64URL_RE = /^[A-Za-z0-9_-]+$/;

describe('generateState()', () => {
  it('returns a non-empty string', () => {
    expect(typeof generateState()).toBe('string');
    expect(generateState().length).toBeGreaterThan(0);
  });

  it('uses only base64url characters', () => {
    for (let i = 0; i < 20; i++) {
      expect(generateState()).toMatch(BASE64URL_RE);
    }
  });

  it('generates unique values each call', () => {
    const states = new Set(Array.from({ length: 100 }, () => generateState()));
    expect(states.size).toBe(100);
  });

  it('has sufficient length for CSRF protection (≥ 16 chars)', () => {
    // 24 random bytes → 32 base64url chars
    expect(generateState().length).toBeGreaterThanOrEqual(16);
  });
});

describe('stateCookieName()', () => {
  it('returns expected format for youtube', () => {
    expect(stateCookieName('youtube')).toBe('oauth_state_youtube');
  });

  it('returns expected format for tiktok', () => {
    expect(stateCookieName('tiktok')).toBe('oauth_state_tiktok');
  });

  it('returns expected format for facebook', () => {
    expect(stateCookieName('facebook')).toBe('oauth_state_facebook');
  });

  it('returns expected format for canva', () => {
    expect(stateCookieName('canva')).toBe('oauth_state_canva');
  });

  it('uses the exact platform string passed in', () => {
    expect(stateCookieName('custom_platform')).toBe('oauth_state_custom_platform');
  });
});

describe('generateCodeVerifier()', () => {
  it('returns a non-empty string', () => {
    expect(typeof generateCodeVerifier()).toBe('string');
    expect(generateCodeVerifier().length).toBeGreaterThan(0);
  });

  it('uses only base64url characters', () => {
    for (let i = 0; i < 20; i++) {
      expect(generateCodeVerifier()).toMatch(BASE64URL_RE);
    }
  });

  it('generates unique values each call', () => {
    const verifiers = new Set(Array.from({ length: 100 }, () => generateCodeVerifier()));
    expect(verifiers.size).toBe(100);
  });

  it('meets PKCE minimum length requirement (≥ 43 chars)', () => {
    // RFC 7636: 32 random bytes → 43 base64url chars (ceiling of 32*8/6)
    expect(generateCodeVerifier().length).toBeGreaterThanOrEqual(43);
  });
});

describe('codeChallengeFromVerifier()', () => {
  it('returns a non-empty base64url string', () => {
    const challenge = codeChallengeFromVerifier('verifier');
    expect(challenge).toMatch(BASE64URL_RE);
  });

  it('is deterministic for the same input', () => {
    const v = 'my-test-verifier-12345';
    expect(codeChallengeFromVerifier(v)).toBe(codeChallengeFromVerifier(v));
  });

  it('produces the correct SHA-256/base64url hash', () => {
    const verifier = 'dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk';
    const expected = createHash('sha256').update(verifier).digest('base64url');
    expect(codeChallengeFromVerifier(verifier)).toBe(expected);
  });

  it('produces different challenges for different verifiers', () => {
    const c1 = codeChallengeFromVerifier('verifier-a');
    const c2 = codeChallengeFromVerifier('verifier-b');
    expect(c1).not.toBe(c2);
  });

  it('generates valid challenge from a real generateCodeVerifier() output', () => {
    const verifier = generateCodeVerifier();
    const challenge = codeChallengeFromVerifier(verifier);
    expect(challenge).toMatch(BASE64URL_RE);
    expect(challenge.length).toBeGreaterThan(0);
  });
});

describe('codeVerifierCookieName()', () => {
  it('returns expected format for canva', () => {
    expect(codeVerifierCookieName('canva')).toBe('oauth_pkce_canva');
  });

  it('returns expected format for any string', () => {
    expect(codeVerifierCookieName('testplatform')).toBe('oauth_pkce_testplatform');
  });

  it('uses the exact platform string passed', () => {
    expect(codeVerifierCookieName('my-platform')).toBe('oauth_pkce_my-platform');
  });
});
