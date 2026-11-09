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
    expect(generateState().length).toBeGreaterThan(0);
  });

  it('returns a base64url-safe string (no +, /, or =)', () => {
    for (let i = 0; i < 20; i++) {
      const s = generateState();
      expect(s).toMatch(/^[A-Za-z0-9_-]+$/);
    }
  });

  it('returns different values on each call', () => {
    const a = generateState();
    const b = generateState();
    expect(a).not.toBe(b);
  });

  it('is at least 32 characters long (24 bytes base64url ~= 32 chars)', () => {
    // 24 bytes → 32 base64url characters
    expect(generateState().length).toBeGreaterThanOrEqual(32);
  });
});

describe('stateCookieName', () => {
  it('returns expected pattern for tiktok', () => {
    expect(stateCookieName('tiktok')).toBe('oauth_state_tiktok');
  });

  it('returns expected pattern for youtube', () => {
    expect(stateCookieName('youtube')).toBe('oauth_state_youtube');
  });

  it('returns expected pattern for facebook', () => {
    expect(stateCookieName('facebook')).toBe('oauth_state_facebook');
  });

  it('returns expected pattern for canva', () => {
    expect(stateCookieName('canva')).toBe('oauth_state_canva');
  });

  it('incorporates the platform string faithfully', () => {
    expect(stateCookieName('x_new_platform')).toBe('oauth_state_x_new_platform');
  });
});

describe('generateCodeVerifier', () => {
  it('returns a non-empty string', () => {
    expect(generateCodeVerifier().length).toBeGreaterThan(0);
  });

  it('returns a base64url-safe string', () => {
    for (let i = 0; i < 20; i++) {
      const v = generateCodeVerifier();
      expect(v).toMatch(/^[A-Za-z0-9_-]+$/);
    }
  });

  it('returns different values on each call', () => {
    const a = generateCodeVerifier();
    const b = generateCodeVerifier();
    expect(a).not.toBe(b);
  });

  it('is at least 43 characters (32 bytes base64url)', () => {
    // RFC 7636 mandates 43-128 chars; 32 bytes base64url = 43 chars
    expect(generateCodeVerifier().length).toBeGreaterThanOrEqual(43);
  });
});

describe('codeChallengeFromVerifier', () => {
  it('returns a non-empty base64url string', () => {
    const challenge = codeChallengeFromVerifier('test-verifier');
    expect(challenge).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  it('is deterministic for the same input', () => {
    const a = codeChallengeFromVerifier('same-verifier');
    const b = codeChallengeFromVerifier('same-verifier');
    expect(a).toBe(b);
  });

  it('produces SHA-256 of the verifier encoded as base64url', () => {
    const verifier = 'hello-world';
    const expected = createHash('sha256').update(verifier).digest('base64url');
    expect(codeChallengeFromVerifier(verifier)).toBe(expected);
  });

  it('different verifiers produce different challenges', () => {
    const c1 = codeChallengeFromVerifier('verifier-a');
    const c2 = codeChallengeFromVerifier('verifier-b');
    expect(c1).not.toBe(c2);
  });

  it('the generated verifier and challenge form a valid PKCE pair (SHA-256)', () => {
    const verifier = generateCodeVerifier();
    const challenge = codeChallengeFromVerifier(verifier);
    const expected = createHash('sha256').update(verifier).digest('base64url');
    expect(challenge).toBe(expected);
  });
});

describe('codeVerifierCookieName', () => {
  it('returns expected pattern for canva', () => {
    expect(codeVerifierCookieName('canva')).toBe('oauth_pkce_canva');
  });

  it('returns expected pattern for tiktok', () => {
    expect(codeVerifierCookieName('tiktok')).toBe('oauth_pkce_tiktok');
  });

  it('incorporates the platform string faithfully', () => {
    expect(codeVerifierCookieName('new_platform')).toBe('oauth_pkce_new_platform');
  });
});
