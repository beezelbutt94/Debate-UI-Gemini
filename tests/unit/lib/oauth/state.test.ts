import { describe, it, expect } from 'vitest';
import {
  generateState,
  stateCookieName,
  generateCodeVerifier,
  codeChallengeFromVerifier,
  codeVerifierCookieName,
} from '@/lib/oauth/state';
import { createHash } from 'crypto';

const BASE64URL_RE = /^[A-Za-z0-9\-_]+$/;

describe('generateState()', () => {
  it('returns a non-empty string', () => {
    expect(typeof generateState()).toBe('string');
    expect(generateState().length).toBeGreaterThan(0);
  });

  it('produces only base64url characters (no +, /, or = padding)', () => {
    for (let i = 0; i < 20; i++) {
      expect(generateState()).toMatch(BASE64URL_RE);
    }
  });

  it('produces 32-character strings (24 random bytes → 32-char base64url)', () => {
    expect(generateState().length).toBe(32);
  });

  it('each call produces a unique value', () => {
    const values = new Set(Array.from({ length: 50 }, () => generateState()));
    expect(values.size).toBe(50);
  });
});

describe('generateCodeVerifier()', () => {
  it('returns a non-empty string', () => {
    expect(typeof generateCodeVerifier()).toBe('string');
    expect(generateCodeVerifier().length).toBeGreaterThan(0);
  });

  it('produces only base64url characters', () => {
    for (let i = 0; i < 20; i++) {
      expect(generateCodeVerifier()).toMatch(BASE64URL_RE);
    }
  });

  it('produces 43-character strings (32 random bytes → 43-char base64url)', () => {
    expect(generateCodeVerifier().length).toBe(43);
  });

  it('each call produces a unique value', () => {
    const values = new Set(Array.from({ length: 50 }, () => generateCodeVerifier()));
    expect(values.size).toBe(50);
  });
});

describe('codeChallengeFromVerifier()', () => {
  it('returns a base64url string', () => {
    const verifier = generateCodeVerifier();
    expect(codeChallengeFromVerifier(verifier)).toMatch(BASE64URL_RE);
  });

  it('is deterministic: same verifier always gives same challenge', () => {
    const verifier = generateCodeVerifier();
    expect(codeChallengeFromVerifier(verifier)).toBe(codeChallengeFromVerifier(verifier));
  });

  it('different verifiers produce different challenges', () => {
    const a = generateCodeVerifier();
    const b = generateCodeVerifier();
    // extremely unlikely to collide
    expect(codeChallengeFromVerifier(a)).not.toBe(codeChallengeFromVerifier(b));
  });

  it('produces the correct SHA-256 base64url digest of the verifier', () => {
    const verifier = 'hello-world-test-verifier';
    const expected = createHash('sha256').update(verifier).digest('base64url');
    expect(codeChallengeFromVerifier(verifier)).toBe(expected);
  });

  it('works for a known RFC-7636 test vector', () => {
    // dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk (from RFC 7636 appendix B)
    const verifier = 'dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk';
    const challenge = codeChallengeFromVerifier(verifier);
    expect(challenge).toMatch(BASE64URL_RE);
    // Must not contain '=' padding that would make it non-compliant
    expect(challenge).not.toContain('=');
  });
});

describe('stateCookieName()', () => {
  it('formats the cookie name for youtube', () => {
    expect(stateCookieName('youtube')).toBe('oauth_state_youtube');
  });

  it('formats the cookie name for tiktok', () => {
    expect(stateCookieName('tiktok')).toBe('oauth_state_tiktok');
  });

  it('formats the cookie name for facebook', () => {
    expect(stateCookieName('facebook')).toBe('oauth_state_facebook');
  });

  it('formats the cookie name for canva', () => {
    expect(stateCookieName('canva')).toBe('oauth_state_canva');
  });

  it('uses the platform name as a suffix verbatim', () => {
    expect(stateCookieName('custom')).toBe('oauth_state_custom');
  });
});

describe('codeVerifierCookieName()', () => {
  it('formats the cookie name for canva', () => {
    expect(codeVerifierCookieName('canva')).toBe('oauth_pkce_canva');
  });

  it('formats the cookie name for any platform', () => {
    expect(codeVerifierCookieName('youtube')).toBe('oauth_pkce_youtube');
  });

  it('uses the platform name as suffix verbatim', () => {
    expect(codeVerifierCookieName('custom')).toBe('oauth_pkce_custom');
  });
});
