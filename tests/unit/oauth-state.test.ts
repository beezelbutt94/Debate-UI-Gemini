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
    expect(generateState().length).toBeGreaterThan(0);
  });

  it('returns a base64url string (no +, /, or = chars)', () => {
    const state = generateState();
    expect(state).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  it('returns different values on successive calls', () => {
    const a = generateState();
    const b = generateState();
    expect(a).not.toBe(b);
  });

  it('returns a string of consistent expected length (24 random bytes → 32 base64url chars)', () => {
    // 24 bytes → ceil(24/3)*4 = 32 base64 chars (no padding in base64url)
    const state = generateState();
    expect(state.length).toBe(32);
  });

  it('generates unique values over 100 iterations', () => {
    const values = new Set(Array.from({ length: 100 }, () => generateState()));
    expect(values.size).toBe(100);
  });
});

describe('stateCookieName()', () => {
  it('returns the expected pattern for youtube', () => {
    expect(stateCookieName('youtube')).toBe('oauth_state_youtube');
  });

  it('returns the expected pattern for tiktok', () => {
    expect(stateCookieName('tiktok')).toBe('oauth_state_tiktok');
  });

  it('returns the expected pattern for facebook', () => {
    expect(stateCookieName('facebook')).toBe('oauth_state_facebook');
  });

  it('returns the expected pattern for canva', () => {
    expect(stateCookieName('canva')).toBe('oauth_state_canva');
  });

  it('handles arbitrary string platform', () => {
    expect(stateCookieName('custom-platform')).toBe('oauth_state_custom-platform');
  });

  it('starts with oauth_state_', () => {
    expect(stateCookieName('anything')).toMatch(/^oauth_state_/);
  });
});

describe('generateCodeVerifier()', () => {
  it('returns a non-empty string', () => {
    expect(generateCodeVerifier().length).toBeGreaterThan(0);
  });

  it('returns a base64url string (no +, /, or = chars)', () => {
    const verifier = generateCodeVerifier();
    expect(verifier).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  it('returns different values on successive calls', () => {
    const a = generateCodeVerifier();
    const b = generateCodeVerifier();
    expect(a).not.toBe(b);
  });

  it('returns a string of expected length (32 random bytes → 43 base64url chars)', () => {
    // 32 bytes → 43 base64url chars (no padding)
    const verifier = generateCodeVerifier();
    expect(verifier.length).toBe(43);
  });

  it('generates unique values over 100 iterations', () => {
    const values = new Set(Array.from({ length: 100 }, () => generateCodeVerifier()));
    expect(values.size).toBe(100);
  });
});

describe('codeChallengeFromVerifier()', () => {
  it('returns a non-empty string', () => {
    expect(codeChallengeFromVerifier('test-verifier').length).toBeGreaterThan(0);
  });

  it('returns a base64url string (no +, /, or = chars)', () => {
    const challenge = codeChallengeFromVerifier('some-verifier');
    expect(challenge).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  it('is deterministic — same verifier → same challenge', () => {
    const v = 'deterministic-verifier-abc';
    expect(codeChallengeFromVerifier(v)).toBe(codeChallengeFromVerifier(v));
  });

  it('produces the correct SHA-256 base64url of the verifier', () => {
    const verifier = 'hello-world';
    const expected = createHash('sha256').update(verifier).digest('base64url');
    expect(codeChallengeFromVerifier(verifier)).toBe(expected);
  });

  it('two different verifiers produce different challenges', () => {
    const c1 = codeChallengeFromVerifier('verifier-a');
    const c2 = codeChallengeFromVerifier('verifier-b');
    expect(c1).not.toBe(c2);
  });

  it('works with a real generated code verifier end-to-end', () => {
    const verifier = generateCodeVerifier();
    const challenge = codeChallengeFromVerifier(verifier);
    const expected = createHash('sha256').update(verifier).digest('base64url');
    expect(challenge).toBe(expected);
  });

  it('handles empty string verifier without throwing', () => {
    expect(() => codeChallengeFromVerifier('')).not.toThrow();
  });

  it('empty string verifier produces a valid base64url challenge', () => {
    const challenge = codeChallengeFromVerifier('');
    expect(challenge).toMatch(/^[A-Za-z0-9_-]+$/);
  });
});

describe('codeVerifierCookieName()', () => {
  it('returns the expected pattern for canva', () => {
    expect(codeVerifierCookieName('canva')).toBe('oauth_pkce_canva');
  });

  it('returns the expected pattern for youtube', () => {
    expect(codeVerifierCookieName('youtube')).toBe('oauth_pkce_youtube');
  });

  it('starts with oauth_pkce_', () => {
    expect(codeVerifierCookieName('anything')).toMatch(/^oauth_pkce_/);
  });

  it('handles arbitrary platform name', () => {
    expect(codeVerifierCookieName('my-custom-platform')).toBe('oauth_pkce_my-custom-platform');
  });
});
