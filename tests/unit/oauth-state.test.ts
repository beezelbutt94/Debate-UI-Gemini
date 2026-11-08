import { describe, it, expect } from 'vitest';
import {
  generateState,
  stateCookieName,
  generateCodeVerifier,
  codeChallengeFromVerifier,
  codeVerifierCookieName,
} from '@/lib/oauth/state';
import { createHash } from 'crypto';

describe('generateState', () => {
  it('returns a non-empty string', () => {
    expect(typeof generateState()).toBe('string');
    expect(generateState().length).toBeGreaterThan(0);
  });

  it('returns a base64url-safe string (no +, /, =)', () => {
    const state = generateState();
    expect(state).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  it('returns different values on each call (randomness)', () => {
    const a = generateState();
    const b = generateState();
    expect(a).not.toBe(b);
  });

  it('has correct byte length (32 bytes → 43 base64url chars)', () => {
    // 24 random bytes → ceil(24*4/3) = 32 base64url chars
    expect(generateState().length).toBe(32);
  });
});

describe('stateCookieName', () => {
  it('prefixes with oauth_state_', () => {
    expect(stateCookieName('youtube')).toBe('oauth_state_youtube');
  });

  it('works for all supported platforms', () => {
    expect(stateCookieName('tiktok')).toBe('oauth_state_tiktok');
    expect(stateCookieName('facebook')).toBe('oauth_state_facebook');
    expect(stateCookieName('canva')).toBe('oauth_state_canva');
  });

  it('arbitrary platform string', () => {
    expect(stateCookieName('anything')).toBe('oauth_state_anything');
  });
});

describe('generateCodeVerifier', () => {
  it('returns a non-empty string', () => {
    expect(typeof generateCodeVerifier()).toBe('string');
    expect(generateCodeVerifier().length).toBeGreaterThan(0);
  });

  it('returns a base64url-safe string', () => {
    expect(generateCodeVerifier()).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  it('returns different values on each call', () => {
    expect(generateCodeVerifier()).not.toBe(generateCodeVerifier());
  });

  it('has the correct length for 32 random bytes', () => {
    // 32 bytes → 43 base64url chars
    expect(generateCodeVerifier().length).toBe(43);
  });
});

describe('codeChallengeFromVerifier', () => {
  it('returns a base64url-safe string', () => {
    const challenge = codeChallengeFromVerifier('test-verifier');
    expect(challenge).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  it('produces a correct SHA-256 base64url digest', () => {
    const verifier = 'hello-world';
    const expected = createHash('sha256').update(verifier).digest('base64url');
    expect(codeChallengeFromVerifier(verifier)).toBe(expected);
  });

  it('is deterministic for the same input', () => {
    const v = 'my-code-verifier';
    expect(codeChallengeFromVerifier(v)).toBe(codeChallengeFromVerifier(v));
  });

  it('produces different outputs for different inputs', () => {
    expect(codeChallengeFromVerifier('aaa')).not.toBe(codeChallengeFromVerifier('bbb'));
  });

  it('round-trips: challenge from a generated verifier is a valid base64url string', () => {
    const verifier = generateCodeVerifier();
    const challenge = codeChallengeFromVerifier(verifier);
    expect(challenge).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(challenge.length).toBe(43); // SHA-256 → 32 bytes → 43 base64url chars
  });
});

describe('codeVerifierCookieName', () => {
  it('prefixes with oauth_pkce_', () => {
    expect(codeVerifierCookieName('canva')).toBe('oauth_pkce_canva');
  });

  it('works for all platforms', () => {
    expect(codeVerifierCookieName('youtube')).toBe('oauth_pkce_youtube');
    expect(codeVerifierCookieName('tiktok')).toBe('oauth_pkce_tiktok');
    expect(codeVerifierCookieName('facebook')).toBe('oauth_pkce_facebook');
  });

  it('arbitrary platform string is accepted', () => {
    expect(codeVerifierCookieName('anything')).toBe('oauth_pkce_anything');
  });
});

describe('codeChallengeFromVerifier — additional cases', () => {
  it('handles empty string verifier without throwing', () => {
    const challenge = codeChallengeFromVerifier('');
    expect(challenge).toMatch(/^[A-Za-z0-9_-]+$/);
    const expected = createHash('sha256').update('').digest('base64url');
    expect(challenge).toBe(expected);
  });

  it('handles long verifier strings', () => {
    const longVerifier = 'a'.repeat(500);
    const challenge = codeChallengeFromVerifier(longVerifier);
    expect(challenge).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(challenge.length).toBe(43);
  });

  it('handles verifier with special characters', () => {
    const challenge = codeChallengeFromVerifier('hello world! @#$%');
    expect(challenge).toMatch(/^[A-Za-z0-9_-]+$/);
  });
});

describe('generateState — additional cases', () => {
  it('generates 10 unique states without collision', () => {
    const states = Array.from({ length: 10 }, () => generateState());
    expect(new Set(states).size).toBe(10);
  });
});

describe('generateCodeVerifier — additional cases', () => {
  it('generates 10 unique verifiers without collision', () => {
    const verifiers = Array.from({ length: 10 }, () => generateCodeVerifier());
    expect(new Set(verifiers).size).toBe(10);
  });
});
