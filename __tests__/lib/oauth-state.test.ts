import { describe, it, expect } from 'vitest';
import { createHash } from 'crypto';
import {
  generateState,
  stateCookieName,
  generateCodeVerifier,
  codeChallengeFromVerifier,
  codeVerifierCookieName,
} from '@/lib/oauth/state';

const BASE64URL_RE = /^[A-Za-z0-9\-_]+$/;

describe('generateState', () => {
  it('returns a string', () => {
    expect(typeof generateState()).toBe('string');
  });

  it('returns a 32-character base64url string (24 random bytes)', () => {
    expect(generateState()).toHaveLength(32);
  });

  it('only contains base64url-safe characters', () => {
    for (let i = 0; i < 20; i++) {
      expect(generateState()).toMatch(BASE64URL_RE);
    }
  });

  it('produces different values on successive calls', () => {
    const values = new Set(Array.from({ length: 50 }, () => generateState()));
    expect(values.size).toBe(50);
  });
});

describe('stateCookieName', () => {
  it('formats correctly for youtube', () => {
    expect(stateCookieName('youtube')).toBe('oauth_state_youtube');
  });

  it('formats correctly for tiktok', () => {
    expect(stateCookieName('tiktok')).toBe('oauth_state_tiktok');
  });

  it('formats correctly for facebook', () => {
    expect(stateCookieName('facebook')).toBe('oauth_state_facebook');
  });

  it('formats correctly for canva', () => {
    expect(stateCookieName('canva')).toBe('oauth_state_canva');
  });

  it('uses the platform name verbatim', () => {
    expect(stateCookieName('my-platform')).toBe('oauth_state_my-platform');
  });
});

describe('generateCodeVerifier', () => {
  it('returns a string', () => {
    expect(typeof generateCodeVerifier()).toBe('string');
  });

  it('returns a 43-character base64url string (32 random bytes)', () => {
    expect(generateCodeVerifier()).toHaveLength(43);
  });

  it('only contains base64url-safe characters', () => {
    for (let i = 0; i < 20; i++) {
      expect(generateCodeVerifier()).toMatch(BASE64URL_RE);
    }
  });

  it('produces different values on successive calls', () => {
    const values = new Set(Array.from({ length: 50 }, () => generateCodeVerifier()));
    expect(values.size).toBe(50);
  });
});

describe('codeChallengeFromVerifier', () => {
  it('returns a 43-character base64url string (SHA-256 → 32 bytes)', () => {
    expect(codeChallengeFromVerifier('anything')).toHaveLength(43);
  });

  it('only contains base64url-safe characters', () => {
    expect(codeChallengeFromVerifier('verifier')).toMatch(BASE64URL_RE);
  });

  it('matches the SHA-256 base64url of the verifier (RFC 7636 S256 method)', () => {
    const verifier = 'dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk';
    const expected = createHash('sha256').update(verifier).digest('base64url');
    expect(codeChallengeFromVerifier(verifier)).toBe(expected);
  });

  it('is deterministic: same input always gives same output', () => {
    const v = 'test-verifier-123';
    expect(codeChallengeFromVerifier(v)).toBe(codeChallengeFromVerifier(v));
  });

  it('produces different challenges for different verifiers', () => {
    expect(codeChallengeFromVerifier('aaa')).not.toBe(codeChallengeFromVerifier('bbb'));
  });

  it('handles an empty string verifier', () => {
    const result = codeChallengeFromVerifier('');
    expect(result).toHaveLength(43);
    expect(result).toMatch(BASE64URL_RE);
    // SHA-256 of empty string is well-known
    const expected = createHash('sha256').update('').digest('base64url');
    expect(result).toBe(expected);
  });
});

describe('codeVerifierCookieName', () => {
  it('formats correctly for canva', () => {
    expect(codeVerifierCookieName('canva')).toBe('oauth_pkce_canva');
  });

  it('formats correctly for other platforms', () => {
    expect(codeVerifierCookieName('youtube')).toBe('oauth_pkce_youtube');
  });

  it('uses the platform name verbatim', () => {
    expect(codeVerifierCookieName('custom-provider')).toBe('oauth_pkce_custom-provider');
  });
});
