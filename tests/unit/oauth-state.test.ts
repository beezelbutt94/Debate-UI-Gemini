import { describe, it, expect } from 'vitest';
import { createHash } from 'crypto';
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

  it('returns a base64url-safe string (no +, /, or = characters)', () => {
    for (let i = 0; i < 20; i++) {
      const state = generateState();
      expect(state).not.toMatch(/[+/=]/);
    }
  });

  it('generates unique values on each call', () => {
    const values = new Set(Array.from({ length: 50 }, () => generateState()));
    expect(values.size).toBe(50);
  });

  it('produces state of expected length (24 random bytes → 32 base64url chars)', () => {
    // 24 bytes → ceil(24 * 4/3) = 32 base64url chars (no padding)
    expect(generateState().length).toBe(32);
  });
});

describe('stateCookieName', () => {
  it('prefixes with oauth_state_', () => {
    expect(stateCookieName('youtube')).toBe('oauth_state_youtube');
  });

  it('works for tiktok', () => {
    expect(stateCookieName('tiktok')).toBe('oauth_state_tiktok');
  });

  it('works for facebook', () => {
    expect(stateCookieName('facebook')).toBe('oauth_state_facebook');
  });

  it('works for canva', () => {
    expect(stateCookieName('canva')).toBe('oauth_state_canva');
  });

  it('handles arbitrary platform string', () => {
    expect(stateCookieName('newplatform')).toBe('oauth_state_newplatform');
  });
});

describe('generateCodeVerifier', () => {
  it('returns a non-empty string', () => {
    expect(typeof generateCodeVerifier()).toBe('string');
    expect(generateCodeVerifier().length).toBeGreaterThan(0);
  });

  it('returns a base64url-safe string', () => {
    for (let i = 0; i < 20; i++) {
      const verifier = generateCodeVerifier();
      expect(verifier).not.toMatch(/[+/=]/);
    }
  });

  it('generates unique values on each call', () => {
    const values = new Set(Array.from({ length: 50 }, () => generateCodeVerifier()));
    expect(values.size).toBe(50);
  });

  it('produces verifier of expected length (32 random bytes → ~43 base64url chars)', () => {
    // 32 bytes → ceil(32 * 4/3) = 43 base64url chars (no padding)
    expect(generateCodeVerifier().length).toBe(43);
  });

  it('meets RFC 7636 minimum length requirement (>= 43 chars)', () => {
    for (let i = 0; i < 10; i++) {
      expect(generateCodeVerifier().length).toBeGreaterThanOrEqual(43);
    }
  });
});

describe('codeChallengeFromVerifier', () => {
  it('returns a base64url-encoded SHA-256 of the verifier', () => {
    const verifier = 'testverifier';
    const expected = createHash('sha256').update(verifier).digest('base64url');
    expect(codeChallengeFromVerifier(verifier)).toBe(expected);
  });

  it('returns a base64url-safe string (no +, /, or =)', () => {
    for (let i = 0; i < 20; i++) {
      const verifier = generateCodeVerifier();
      const challenge = codeChallengeFromVerifier(verifier);
      expect(challenge).not.toMatch(/[+/=]/);
    }
  });

  it('produces consistent output for the same input', () => {
    const verifier = 'consistent-input';
    expect(codeChallengeFromVerifier(verifier)).toBe(codeChallengeFromVerifier(verifier));
  });

  it('produces different challenges for different verifiers', () => {
    const a = codeChallengeFromVerifier('verifier-A');
    const b = codeChallengeFromVerifier('verifier-B');
    expect(a).not.toBe(b);
  });

  it('S256 challenge is exactly 43 chars (SHA-256 = 32 bytes → 43 base64url chars)', () => {
    const challenge = codeChallengeFromVerifier(generateCodeVerifier());
    expect(challenge.length).toBe(43);
  });

  it('round-trip: challenge from real verifier passes SHA-256 check', () => {
    const verifier = generateCodeVerifier();
    const challenge = codeChallengeFromVerifier(verifier);
    const recomputed = createHash('sha256').update(verifier).digest('base64url');
    expect(challenge).toBe(recomputed);
  });
});

describe('codeVerifierCookieName', () => {
  it('prefixes with oauth_pkce_', () => {
    expect(codeVerifierCookieName('canva')).toBe('oauth_pkce_canva');
  });

  it('works for youtube', () => {
    expect(codeVerifierCookieName('youtube')).toBe('oauth_pkce_youtube');
  });

  it('works for arbitrary platform string', () => {
    expect(codeVerifierCookieName('testplatform')).toBe('oauth_pkce_testplatform');
  });
});
