import { describe, it, expect } from 'vitest';
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

  it('returns base64url-safe characters only', () => {
    const state = generateState();
    expect(state).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  it('returns unique values on each call', () => {
    const a = generateState();
    const b = generateState();
    expect(a).not.toBe(b);
  });

  it('has appropriate length (24 bytes -> 32 base64url chars)', () => {
    // 24 random bytes = ceil(24/3)*4 = 32 base64 chars (no padding in base64url)
    const state = generateState();
    expect(state.length).toBe(32);
  });

  it('is consistent enough for use as a cookie value (no spaces, slashes, plus)', () => {
    for (let i = 0; i < 20; i++) {
      const state = generateState();
      expect(state).not.toContain(' ');
      expect(state).not.toContain('/');
      expect(state).not.toContain('+');
      expect(state).not.toContain('=');
    }
  });
});

describe('stateCookieName()', () => {
  it('returns correct prefix + platform', () => {
    expect(stateCookieName('canva')).toBe('oauth_state_canva');
  });

  it('works for all expected platforms', () => {
    expect(stateCookieName('youtube')).toBe('oauth_state_youtube');
    expect(stateCookieName('tiktok')).toBe('oauth_state_tiktok');
    expect(stateCookieName('facebook')).toBe('oauth_state_facebook');
  });

  it('preserves the platform string exactly', () => {
    expect(stateCookieName('my-custom-platform')).toBe('oauth_state_my-custom-platform');
  });
});

describe('generateCodeVerifier()', () => {
  it('returns a non-empty string', () => {
    expect(typeof generateCodeVerifier()).toBe('string');
    expect(generateCodeVerifier().length).toBeGreaterThan(0);
  });

  it('returns base64url-safe characters only', () => {
    const verifier = generateCodeVerifier();
    expect(verifier).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  it('returns unique values on each call', () => {
    const a = generateCodeVerifier();
    const b = generateCodeVerifier();
    expect(a).not.toBe(b);
  });

  it('has length matching 32 random bytes encoded as base64url (~43 chars)', () => {
    const verifier = generateCodeVerifier();
    // 32 bytes -> 43 base64url chars (no padding)
    expect(verifier.length).toBe(43);
  });
});

describe('codeChallengeFromVerifier()', () => {
  it('returns a non-empty string', () => {
    const challenge = codeChallengeFromVerifier('test-verifier');
    expect(typeof challenge).toBe('string');
    expect(challenge.length).toBeGreaterThan(0);
  });

  it('returns base64url-safe characters only', () => {
    const challenge = codeChallengeFromVerifier('test-verifier');
    expect(challenge).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  it('is deterministic for the same input', () => {
    const v = 'my-code-verifier-abc123';
    expect(codeChallengeFromVerifier(v)).toBe(codeChallengeFromVerifier(v));
  });

  it('produces different challenges for different verifiers', () => {
    const a = codeChallengeFromVerifier('verifier-a');
    const b = codeChallengeFromVerifier('verifier-b');
    expect(a).not.toBe(b);
  });

  it('produces SHA-256 base64url output (43 chars)', () => {
    // SHA-256 = 32 bytes -> 43 base64url chars
    const challenge = codeChallengeFromVerifier('any-verifier');
    expect(challenge.length).toBe(43);
  });

  it('satisfies RFC 7636: challenge = BASE64URL(SHA256(verifier))', async () => {
    // Verify against a known test vector
    const { createHash } = await import('crypto');
    const verifier = 'dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk';
    const expected = createHash('sha256').update(verifier).digest('base64url');
    expect(codeChallengeFromVerifier(verifier)).toBe(expected);
  });

  it('works with verifier produced by generateCodeVerifier()', () => {
    const verifier = generateCodeVerifier();
    const challenge = codeChallengeFromVerifier(verifier);
    expect(challenge).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(challenge.length).toBe(43);
  });
});

describe('codeVerifierCookieName()', () => {
  it('returns correct prefix + platform', () => {
    expect(codeVerifierCookieName('canva')).toBe('oauth_pkce_canva');
  });

  it('works for all expected platforms', () => {
    expect(codeVerifierCookieName('youtube')).toBe('oauth_pkce_youtube');
    expect(codeVerifierCookieName('tiktok')).toBe('oauth_pkce_tiktok');
    expect(codeVerifierCookieName('facebook')).toBe('oauth_pkce_facebook');
  });

  it('preserves the platform string exactly', () => {
    expect(codeVerifierCookieName('my-platform')).toBe('oauth_pkce_my-platform');
  });
});
