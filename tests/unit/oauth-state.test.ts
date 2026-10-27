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
    expect(typeof generateState()).toBe('string');
    expect(generateState().length).toBeGreaterThan(0);
  });

  it('returns base64url characters only', () => {
    for (let i = 0; i < 50; i++) {
      expect(generateState()).toMatch(/^[A-Za-z0-9_-]+$/);
    }
  });

  it('produces unique values on successive calls', () => {
    const values = new Set(Array.from({ length: 100 }, () => generateState()));
    expect(values.size).toBe(100);
  });

  it('has correct entropy length (24 bytes → 32 base64url chars)', () => {
    // 24 bytes → ceil(24 * 4 / 3) = 32 chars (no padding in base64url)
    expect(generateState()).toHaveLength(32);
  });
});

describe('stateCookieName()', () => {
  it('returns expected cookie name for youtube', () => {
    expect(stateCookieName('youtube')).toBe('oauth_state_youtube');
  });

  it('returns expected cookie name for tiktok', () => {
    expect(stateCookieName('tiktok')).toBe('oauth_state_tiktok');
  });

  it('returns expected cookie name for facebook', () => {
    expect(stateCookieName('facebook')).toBe('oauth_state_facebook');
  });

  it('returns expected cookie name for canva', () => {
    expect(stateCookieName('canva')).toBe('oauth_state_canva');
  });

  it('interpolates arbitrary platform names', () => {
    expect(stateCookieName('custom')).toBe('oauth_state_custom');
  });
});

describe('generateCodeVerifier()', () => {
  it('returns a non-empty string', () => {
    expect(typeof generateCodeVerifier()).toBe('string');
    expect(generateCodeVerifier().length).toBeGreaterThan(0);
  });

  it('returns base64url characters only', () => {
    for (let i = 0; i < 50; i++) {
      expect(generateCodeVerifier()).toMatch(/^[A-Za-z0-9_-]+$/);
    }
  });

  it('produces unique values on successive calls', () => {
    const values = new Set(Array.from({ length: 100 }, () => generateCodeVerifier()));
    expect(values.size).toBe(100);
  });

  it('has correct entropy length (32 bytes → 43 base64url chars)', () => {
    // 32 bytes → ceil(32 * 4 / 3) = 43 chars (no padding in base64url)
    expect(generateCodeVerifier()).toHaveLength(43);
  });

  it('meets RFC 7636 minimum length requirement (43 chars)', () => {
    expect(generateCodeVerifier().length).toBeGreaterThanOrEqual(43);
  });
});

describe('codeChallengeFromVerifier()', () => {
  it('produces a non-empty string', () => {
    const verifier = generateCodeVerifier();
    expect(typeof codeChallengeFromVerifier(verifier)).toBe('string');
    expect(codeChallengeFromVerifier(verifier).length).toBeGreaterThan(0);
  });

  it('is deterministic for the same verifier', () => {
    const verifier = 'test-verifier-abc123';
    expect(codeChallengeFromVerifier(verifier)).toBe(codeChallengeFromVerifier(verifier));
  });

  it('matches manual SHA-256 base64url of the verifier', () => {
    const verifier = 'dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk';
    const expected = createHash('sha256').update(verifier).digest('base64url');
    expect(codeChallengeFromVerifier(verifier)).toBe(expected);
  });

  it('produces base64url characters only', () => {
    const verifier = generateCodeVerifier();
    expect(codeChallengeFromVerifier(verifier)).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  it('SHA-256 output is 43 base64url chars (256 bits → 32 bytes → 43 chars)', () => {
    const verifier = generateCodeVerifier();
    expect(codeChallengeFromVerifier(verifier)).toHaveLength(43);
  });

  it('produces different challenges for different verifiers', () => {
    const v1 = 'verifier-one';
    const v2 = 'verifier-two';
    expect(codeChallengeFromVerifier(v1)).not.toBe(codeChallengeFromVerifier(v2));
  });

  it('satisfies PKCE S256 method spec for a known test vector', () => {
    // RFC 7636 appendix B test vector
    const verifier = 'dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk';
    const expected = createHash('sha256').update(verifier).digest('base64url');
    expect(codeChallengeFromVerifier(verifier)).toBe(expected);
  });
});

describe('codeVerifierCookieName()', () => {
  it('returns expected cookie name for canva', () => {
    expect(codeVerifierCookieName('canva')).toBe('oauth_pkce_canva');
  });

  it('returns expected cookie name for youtube', () => {
    expect(codeVerifierCookieName('youtube')).toBe('oauth_pkce_youtube');
  });

  it('interpolates arbitrary platform names', () => {
    expect(codeVerifierCookieName('custom')).toBe('oauth_pkce_custom');
  });
});
