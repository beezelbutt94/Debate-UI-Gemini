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
    const state = generateState();
    expect(typeof state).toBe('string');
    expect(state.length).toBeGreaterThan(0);
  });

  it('generates base64url-safe characters only', () => {
    const state = generateState();
    // base64url: A-Z, a-z, 0-9, -, _
    expect(state).toMatch(/^[A-Za-z0-9\-_]+$/);
  });

  it('generates states of consistent expected length (24 bytes → 32 base64url chars)', () => {
    const state = generateState();
    // 24 raw bytes in base64url → ceil(24 * 4/3) = 32 chars (no padding)
    expect(state.length).toBe(32);
  });

  it('generates unique values on successive calls', () => {
    const a = generateState();
    const b = generateState();
    expect(a).not.toBe(b);
  });

  it('generates a new random value each call (10 samples all distinct)', () => {
    const samples = Array.from({ length: 10 }, generateState);
    const unique = new Set(samples);
    expect(unique.size).toBe(10);
  });
});

describe('stateCookieName', () => {
  it('prefixes with oauth_state_', () => {
    expect(stateCookieName('youtube')).toBe('oauth_state_youtube');
  });

  it('works for every supported platform', () => {
    expect(stateCookieName('tiktok')).toBe('oauth_state_tiktok');
    expect(stateCookieName('facebook')).toBe('oauth_state_facebook');
    expect(stateCookieName('canva')).toBe('oauth_state_canva');
  });

  it('handles arbitrary platform names', () => {
    expect(stateCookieName('twitter')).toBe('oauth_state_twitter');
  });
});

describe('generateCodeVerifier', () => {
  it('returns a non-empty string', () => {
    const v = generateCodeVerifier();
    expect(typeof v).toBe('string');
    expect(v.length).toBeGreaterThan(0);
  });

  it('generates base64url-safe characters', () => {
    const v = generateCodeVerifier();
    expect(v).toMatch(/^[A-Za-z0-9\-_]+$/);
  });

  it('is 43 chars long (32 bytes → base64url, no padding)', () => {
    const v = generateCodeVerifier();
    // 32 bytes in base64url → ceil(32 * 4 / 3) with no padding = 43 chars
    expect(v.length).toBe(43);
  });

  it('generates unique verifiers on successive calls', () => {
    const a = generateCodeVerifier();
    const b = generateCodeVerifier();
    expect(a).not.toBe(b);
  });
});

describe('codeChallengeFromVerifier', () => {
  it('produces base64url output', () => {
    const verifier = generateCodeVerifier();
    const challenge = codeChallengeFromVerifier(verifier);
    expect(challenge).toMatch(/^[A-Za-z0-9\-_]+$/);
  });

  it('is deterministic for the same verifier', () => {
    const verifier = 'test-verifier-abc123';
    const c1 = codeChallengeFromVerifier(verifier);
    const c2 = codeChallengeFromVerifier(verifier);
    expect(c1).toBe(c2);
  });

  it('matches manual SHA-256 base64url computation', () => {
    const verifier = 'hello-world-verifier';
    const expected = createHash('sha256').update(verifier).digest('base64url');
    expect(codeChallengeFromVerifier(verifier)).toBe(expected);
  });

  it('produces 43-char output (SHA-256 → 32 bytes → 43 base64url chars)', () => {
    const verifier = generateCodeVerifier();
    expect(codeChallengeFromVerifier(verifier).length).toBe(43);
  });

  it('different verifiers produce different challenges', () => {
    const c1 = codeChallengeFromVerifier('verifier-one');
    const c2 = codeChallengeFromVerifier('verifier-two');
    expect(c1).not.toBe(c2);
  });

  it('handles empty string verifier', () => {
    const challenge = codeChallengeFromVerifier('');
    // SHA-256 of empty string is well-defined
    const expected = createHash('sha256').update('').digest('base64url');
    expect(challenge).toBe(expected);
  });
});

describe('codeVerifierCookieName', () => {
  it('prefixes with oauth_pkce_', () => {
    expect(codeVerifierCookieName('canva')).toBe('oauth_pkce_canva');
  });

  it('works for all supported platforms', () => {
    expect(codeVerifierCookieName('youtube')).toBe('oauth_pkce_youtube');
    expect(codeVerifierCookieName('tiktok')).toBe('oauth_pkce_tiktok');
    expect(codeVerifierCookieName('facebook')).toBe('oauth_pkce_facebook');
  });

  it('handles arbitrary platform names', () => {
    expect(codeVerifierCookieName('custom')).toBe('oauth_pkce_custom');
  });
});
