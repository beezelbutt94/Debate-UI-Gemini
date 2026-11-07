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

describe('generateState()', () => {
  it('returns a non-empty string', () => {
    expect(generateState()).toBeTruthy();
  });

  it('returns a base64url-safe string (no +, /, or = chars)', () => {
    for (let i = 0; i < 20; i++) {
      expect(generateState()).toMatch(BASE64URL_RE);
    }
  });

  it('returns exactly 32 chars (24 random bytes → base64url without padding)', () => {
    // 24 bytes * 4/3 = 32 chars, no padding needed
    expect(generateState()).toHaveLength(32);
  });

  it('returns different values on consecutive calls (not deterministic)', () => {
    const a = generateState();
    const b = generateState();
    expect(a).not.toBe(b);
  });

  it('produces 1000 unique values (randomness sanity check)', () => {
    const seen = new Set<string>();
    for (let i = 0; i < 1000; i++) seen.add(generateState());
    expect(seen.size).toBe(1000);
  });
});

describe('stateCookieName()', () => {
  it('prefixes with oauth_state_', () => {
    expect(stateCookieName('youtube')).toBe('oauth_state_youtube');
  });

  it('works for all supported platforms', () => {
    expect(stateCookieName('tiktok')).toBe('oauth_state_tiktok');
    expect(stateCookieName('facebook')).toBe('oauth_state_facebook');
    expect(stateCookieName('canva')).toBe('oauth_state_canva');
  });

  it('is deterministic for the same input', () => {
    expect(stateCookieName('youtube')).toBe(stateCookieName('youtube'));
  });
});

describe('generateCodeVerifier()', () => {
  it('returns a non-empty string', () => {
    expect(generateCodeVerifier()).toBeTruthy();
  });

  it('returns a base64url-safe string', () => {
    for (let i = 0; i < 20; i++) {
      expect(generateCodeVerifier()).toMatch(BASE64URL_RE);
    }
  });

  it('returns exactly 43 chars (32 random bytes → base64url)', () => {
    // 32 bytes * 4/3 = 42.67 → ceil = 43 chars
    expect(generateCodeVerifier()).toHaveLength(43);
  });

  it('returns different values on consecutive calls', () => {
    const a = generateCodeVerifier();
    const b = generateCodeVerifier();
    expect(a).not.toBe(b);
  });

  it('meets RFC 7636 minimum entropy (32 bytes)', () => {
    // RFC 7636 requires code_verifier to have at least 256 bits = 32 bytes of entropy.
    // 32 random bytes * 6 bits/base64url char → at least 43 chars
    expect(generateCodeVerifier().length).toBeGreaterThanOrEqual(43);
  });
});

describe('codeChallengeFromVerifier()', () => {
  it('returns a base64url-safe string', () => {
    const verifier = generateCodeVerifier();
    expect(codeChallengeFromVerifier(verifier)).toMatch(BASE64URL_RE);
  });

  it('produces the correct SHA-256 base64url of the verifier', () => {
    const verifier = 'dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk';
    const expected = createHash('sha256').update(verifier).digest('base64url');
    expect(codeChallengeFromVerifier(verifier)).toBe(expected);
  });

  it('is deterministic — same verifier always gives same challenge', () => {
    const verifier = generateCodeVerifier();
    expect(codeChallengeFromVerifier(verifier)).toBe(codeChallengeFromVerifier(verifier));
  });

  it('produces different challenges for different verifiers', () => {
    const a = codeChallengeFromVerifier(generateCodeVerifier());
    const b = codeChallengeFromVerifier(generateCodeVerifier());
    expect(a).not.toBe(b);
  });

  it('round-trips correctly against Node crypto SHA-256', () => {
    for (let i = 0; i < 50; i++) {
      const v = generateCodeVerifier();
      const expected = createHash('sha256').update(v).digest('base64url');
      expect(codeChallengeFromVerifier(v)).toBe(expected);
    }
  });
});

describe('codeVerifierCookieName()', () => {
  it('prefixes with oauth_pkce_', () => {
    expect(codeVerifierCookieName('canva')).toBe('oauth_pkce_canva');
  });

  it('works for arbitrary platform strings', () => {
    expect(codeVerifierCookieName('youtube')).toBe('oauth_pkce_youtube');
    expect(codeVerifierCookieName('tiktok')).toBe('oauth_pkce_tiktok');
  });

  it('is deterministic', () => {
    expect(codeVerifierCookieName('canva')).toBe(codeVerifierCookieName('canva'));
  });
});
