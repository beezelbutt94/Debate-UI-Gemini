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

  it('returns a base64url string (no +, /, or = padding)', () => {
    const state = generateState();
    expect(state).not.toMatch(/[+/=]/);
  });

  it('returns unique values on repeated calls', () => {
    const values = new Set(Array.from({ length: 100 }, () => generateState()));
    expect(values.size).toBe(100);
  });

  it('produces a string of the expected length (24 bytes → 32 base64url chars)', () => {
    // 24 raw bytes → ceil(24 * 4/3) = 32 base64 chars; base64url has no padding
    expect(generateState()).toHaveLength(32);
  });
});

describe('stateCookieName()', () => {
  it('prefixes with "oauth_state_"', () => {
    expect(stateCookieName('tiktok')).toBe('oauth_state_tiktok');
  });

  it('works for youtube', () => {
    expect(stateCookieName('youtube')).toBe('oauth_state_youtube');
  });

  it('works for facebook', () => {
    expect(stateCookieName('facebook')).toBe('oauth_state_facebook');
  });

  it('works for canva', () => {
    expect(stateCookieName('canva')).toBe('oauth_state_canva');
  });

  it('preserves the platform name as-is', () => {
    expect(stateCookieName('my_platform')).toBe('oauth_state_my_platform');
  });
});

describe('generateCodeVerifier()', () => {
  it('returns a non-empty string', () => {
    expect(generateCodeVerifier().length).toBeGreaterThan(0);
  });

  it('returns a base64url string (no +, /, or = padding)', () => {
    expect(generateCodeVerifier()).not.toMatch(/[+/=]/);
  });

  it('returns unique values on repeated calls', () => {
    const values = new Set(Array.from({ length: 100 }, () => generateCodeVerifier()));
    expect(values.size).toBe(100);
  });

  it('produces the expected length (32 bytes → 43 base64url chars)', () => {
    // 32 raw bytes → 43 unpadded base64url chars
    expect(generateCodeVerifier()).toHaveLength(43);
  });
});

describe('codeChallengeFromVerifier()', () => {
  it('returns a base64url string (no +, /, or = padding)', () => {
    const challenge = codeChallengeFromVerifier(generateCodeVerifier());
    expect(challenge).not.toMatch(/[+/=]/);
  });

  it('returns a deterministic result for the same verifier', () => {
    const verifier = generateCodeVerifier();
    expect(codeChallengeFromVerifier(verifier)).toBe(codeChallengeFromVerifier(verifier));
  });

  it('produces a valid SHA-256 base64url hash (43 chars)', () => {
    // SHA-256 is 32 bytes → 43 unpadded base64url chars
    expect(codeChallengeFromVerifier('test-verifier')).toHaveLength(43);
  });

  it('matches a manually-computed SHA-256 base64url hash', () => {
    const verifier = 'my-test-verifier';
    const expected = createHash('sha256').update(verifier).digest('base64url');
    expect(codeChallengeFromVerifier(verifier)).toBe(expected);
  });

  it('produces different challenges for different verifiers', () => {
    const v1 = 'verifier-one';
    const v2 = 'verifier-two';
    expect(codeChallengeFromVerifier(v1)).not.toBe(codeChallengeFromVerifier(v2));
  });

  it('satisfies PKCE: challenge is base64url(sha256(verifier))', () => {
    const verifier = generateCodeVerifier();
    const challenge = codeChallengeFromVerifier(verifier);
    const manual = createHash('sha256').update(verifier).digest('base64url');
    expect(challenge).toBe(manual);
  });
});

describe('codeVerifierCookieName()', () => {
  it('prefixes with "oauth_pkce_"', () => {
    expect(codeVerifierCookieName('canva')).toBe('oauth_pkce_canva');
  });

  it('works for tiktok', () => {
    expect(codeVerifierCookieName('tiktok')).toBe('oauth_pkce_tiktok');
  });

  it('works for youtube', () => {
    expect(codeVerifierCookieName('youtube')).toBe('oauth_pkce_youtube');
  });

  it('preserves the platform name as-is', () => {
    expect(codeVerifierCookieName('my-platform')).toBe('oauth_pkce_my-platform');
  });
});
