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
    const state = generateState();
    expect(typeof state).toBe('string');
    expect(state.length).toBeGreaterThan(0);
  });

  it('returns a base64url-encoded string (no +/= characters)', () => {
    const state = generateState();
    expect(state).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  it('is ~32 chars long (24 random bytes -> base64url)', () => {
    const state = generateState();
    // 24 bytes → ceil(24 * 4 / 3) = 32 chars in base64url
    expect(state.length).toBe(32);
  });

  it('generates unique values on each call', () => {
    const states = new Set(Array.from({ length: 20 }, () => generateState()));
    expect(states.size).toBe(20);
  });

  it('has sufficient entropy for CSRF protection (≥16 bytes equiv.)', () => {
    // Base64url: each char is 6 bits, so 32 chars = 192 bits >> 128-bit minimum
    const state = generateState();
    expect(state.length * 6).toBeGreaterThanOrEqual(128);
  });
});

describe('stateCookieName()', () => {
  it('builds correct cookie name for tiktok', () => {
    expect(stateCookieName('tiktok')).toBe('oauth_state_tiktok');
  });

  it('builds correct cookie name for youtube', () => {
    expect(stateCookieName('youtube')).toBe('oauth_state_youtube');
  });

  it('builds correct cookie name for facebook', () => {
    expect(stateCookieName('facebook')).toBe('oauth_state_facebook');
  });

  it('builds correct cookie name for canva', () => {
    expect(stateCookieName('canva')).toBe('oauth_state_canva');
  });

  it('uses the platform as a suffix', () => {
    const platform = 'myplatform';
    expect(stateCookieName(platform)).toBe(`oauth_state_${platform}`);
  });
});

describe('generateCodeVerifier()', () => {
  it('returns a non-empty string', () => {
    const verifier = generateCodeVerifier();
    expect(typeof verifier).toBe('string');
    expect(verifier.length).toBeGreaterThan(0);
  });

  it('returns only base64url characters', () => {
    const verifier = generateCodeVerifier();
    expect(verifier).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  it('is ~43 chars long (32 bytes -> base64url)', () => {
    const verifier = generateCodeVerifier();
    // 32 bytes → ceil(32 * 4 / 3) = 43 chars in base64url (no padding)
    expect(verifier.length).toBe(43);
  });

  it('generates unique values on each call', () => {
    const verifiers = new Set(Array.from({ length: 20 }, () => generateCodeVerifier()));
    expect(verifiers.size).toBe(20);
  });

  it('meets RFC 7636 minimum length requirement (43+ chars)', () => {
    // RFC 7636 §4.1: code_verifier must be 43-128 chars
    const verifier = generateCodeVerifier();
    expect(verifier.length).toBeGreaterThanOrEqual(43);
    expect(verifier.length).toBeLessThanOrEqual(128);
  });
});

describe('codeChallengeFromVerifier()', () => {
  it('produces a non-empty base64url string', () => {
    const verifier = generateCodeVerifier();
    const challenge = codeChallengeFromVerifier(verifier);
    expect(challenge).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  it('is deterministic for the same verifier', () => {
    const verifier = generateCodeVerifier();
    expect(codeChallengeFromVerifier(verifier)).toBe(codeChallengeFromVerifier(verifier));
  });

  it('produces a SHA-256 base64url hash (43 chars)', () => {
    const verifier = generateCodeVerifier();
    const challenge = codeChallengeFromVerifier(verifier);
    // SHA-256 = 32 bytes -> 43 chars base64url
    expect(challenge.length).toBe(43);
  });

  it('matches manual SHA-256 base64url calculation', () => {
    const verifier = 'test-verifier-value-for-manual-check';
    const expected = createHash('sha256').update(verifier).digest('base64url');
    expect(codeChallengeFromVerifier(verifier)).toBe(expected);
  });

  it('produces different challenges for different verifiers', () => {
    const v1 = 'verifierone';
    const v2 = 'verifiertwo';
    expect(codeChallengeFromVerifier(v1)).not.toBe(codeChallengeFromVerifier(v2));
  });

  it('has no padding characters (= is not valid base64url)', () => {
    const verifier = generateCodeVerifier();
    const challenge = codeChallengeFromVerifier(verifier);
    expect(challenge).not.toContain('=');
  });

  it('has no + or / characters (base64 standard chars not in base64url)', () => {
    const verifier = generateCodeVerifier();
    const challenge = codeChallengeFromVerifier(verifier);
    expect(challenge).not.toContain('+');
    expect(challenge).not.toContain('/');
  });
});

describe('codeVerifierCookieName()', () => {
  it('builds correct cookie name for canva', () => {
    expect(codeVerifierCookieName('canva')).toBe('oauth_pkce_canva');
  });

  it('builds correct cookie name for any platform string', () => {
    expect(codeVerifierCookieName('tiktok')).toBe('oauth_pkce_tiktok');
  });

  it('uses the platform as a suffix', () => {
    const platform = 'testplatform';
    expect(codeVerifierCookieName(platform)).toBe(`oauth_pkce_${platform}`);
  });
});
