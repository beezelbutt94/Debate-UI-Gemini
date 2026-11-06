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

  it('is URL-safe base64 (no +, /, or = characters)', () => {
    for (let i = 0; i < 20; i++) {
      const s = generateState();
      expect(s).toMatch(/^[A-Za-z0-9\-_]+$/);
    }
  });

  it('produces 32 base64url chars from 24 random bytes', () => {
    // 24 bytes → 32 base64url characters (4/3 ratio, no padding)
    expect(generateState().length).toBe(32);
  });

  it('generates unique values on each call', () => {
    const values = new Set(Array.from({ length: 50 }, generateState));
    expect(values.size).toBe(50);
  });
});

describe('stateCookieName()', () => {
  it('returns the correct cookie name for youtube', () => {
    expect(stateCookieName('youtube')).toBe('oauth_state_youtube');
  });

  it('returns the correct cookie name for tiktok', () => {
    expect(stateCookieName('tiktok')).toBe('oauth_state_tiktok');
  });

  it('returns the correct cookie name for facebook', () => {
    expect(stateCookieName('facebook')).toBe('oauth_state_facebook');
  });

  it('returns the correct cookie name for canva', () => {
    expect(stateCookieName('canva')).toBe('oauth_state_canva');
  });

  it('uses the passed platform verbatim', () => {
    expect(stateCookieName('custom_platform')).toBe('oauth_state_custom_platform');
  });
});

describe('generateCodeVerifier()', () => {
  it('returns a non-empty string', () => {
    expect(typeof generateCodeVerifier()).toBe('string');
    expect(generateCodeVerifier().length).toBeGreaterThan(0);
  });

  it('is URL-safe base64 (no +, /, or = characters)', () => {
    for (let i = 0; i < 20; i++) {
      const v = generateCodeVerifier();
      expect(v).toMatch(/^[A-Za-z0-9\-_]+$/);
    }
  });

  it('produces 43 base64url chars from 32 random bytes', () => {
    // 32 bytes → 43 base64url characters (ceiling of 32*4/3), no padding
    expect(generateCodeVerifier().length).toBe(43);
  });

  it('generates unique values on each call', () => {
    const values = new Set(Array.from({ length: 50 }, generateCodeVerifier));
    expect(values.size).toBe(50);
  });
});

describe('codeChallengeFromVerifier()', () => {
  it('returns a URL-safe base64 string', () => {
    const challenge = codeChallengeFromVerifier('abc123');
    expect(challenge).toMatch(/^[A-Za-z0-9\-_]+$/);
  });

  it('matches the SHA-256 base64url of the verifier', () => {
    const verifier = 'test-verifier-string';
    const expected = createHash('sha256').update(verifier).digest('base64url');
    expect(codeChallengeFromVerifier(verifier)).toBe(expected);
  });

  it('is deterministic — same input → same output', () => {
    const v = 'deterministic-test';
    expect(codeChallengeFromVerifier(v)).toBe(codeChallengeFromVerifier(v));
  });

  it('produces different challenges for different verifiers', () => {
    expect(codeChallengeFromVerifier('aaa')).not.toBe(codeChallengeFromVerifier('bbb'));
  });

  it('round-trips with a generated verifier', () => {
    const verifier = generateCodeVerifier();
    const challenge = codeChallengeFromVerifier(verifier);
    const expected = createHash('sha256').update(verifier).digest('base64url');
    expect(challenge).toBe(expected);
  });

  it('produces 43-character output for a standard verifier', () => {
    // SHA-256 = 32 bytes = 43 base64url chars (no padding)
    const verifier = generateCodeVerifier();
    expect(codeChallengeFromVerifier(verifier).length).toBe(43);
  });
});

describe('codeVerifierCookieName()', () => {
  it('returns the correct cookie name for canva', () => {
    expect(codeVerifierCookieName('canva')).toBe('oauth_pkce_canva');
  });

  it('returns the correct cookie name for youtube', () => {
    expect(codeVerifierCookieName('youtube')).toBe('oauth_pkce_youtube');
  });

  it('returns the correct cookie name for tiktok', () => {
    expect(codeVerifierCookieName('tiktok')).toBe('oauth_pkce_tiktok');
  });

  it('uses the passed platform verbatim', () => {
    expect(codeVerifierCookieName('my_provider')).toBe('oauth_pkce_my_provider');
  });
});
