import { describe, it, expect } from 'vitest';
import {
  generateState,
  stateCookieName,
  generateCodeVerifier,
  codeChallengeFromVerifier,
  codeVerifierCookieName,
} from '@/lib/oauth/state';
import { isOAuthPlatform } from '@/lib/oauth/types';
import { createHash } from 'crypto';

// ─── generateState ────────────────────────────────────────────────────────────

describe('generateState()', () => {
  it('returns a non-empty string', () => {
    expect(typeof generateState()).toBe('string');
    expect(generateState().length).toBeGreaterThan(0);
  });

  it('uses base64url alphabet (no +, /, or = padding)', () => {
    for (let i = 0; i < 20; i++) {
      const state = generateState();
      expect(state).not.toMatch(/[+/=]/);
    }
  });

  it('generates a value of expected length (24 bytes → 32 base64url chars)', () => {
    // 24 random bytes encodes to ceil(24 * 4/3) = 32 chars in base64url (no padding)
    const state = generateState();
    expect(state.length).toBe(32);
  });

  it('produces unique values on successive calls', () => {
    const states = new Set(Array.from({ length: 50 }, () => generateState()));
    expect(states.size).toBe(50);
  });
});

// ─── stateCookieName ──────────────────────────────────────────────────────────

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

  it('includes the platform in the cookie name', () => {
    const platform = 'testplatform';
    expect(stateCookieName(platform)).toContain(platform);
  });

  it('uses underscore separator (no hyphens)', () => {
    expect(stateCookieName('facebook')).not.toContain('-');
  });
});

// ─── generateCodeVerifier ─────────────────────────────────────────────────────

describe('generateCodeVerifier()', () => {
  it('returns a non-empty string', () => {
    expect(typeof generateCodeVerifier()).toBe('string');
    expect(generateCodeVerifier().length).toBeGreaterThan(0);
  });

  it('uses base64url alphabet (no +, /, or = padding)', () => {
    for (let i = 0; i < 20; i++) {
      const verifier = generateCodeVerifier();
      expect(verifier).not.toMatch(/[+/=]/);
    }
  });

  it('generates a value of expected length (32 bytes → ~43 base64url chars)', () => {
    // 32 bytes → ceil(32 * 4/3) = 43 base64url chars
    const verifier = generateCodeVerifier();
    expect(verifier.length).toBe(43);
  });

  it('produces unique values on successive calls', () => {
    const verifiers = new Set(Array.from({ length: 50 }, () => generateCodeVerifier()));
    expect(verifiers.size).toBe(50);
  });
});

// ─── codeChallengeFromVerifier ────────────────────────────────────────────────

describe('codeChallengeFromVerifier()', () => {
  it('returns a non-empty string', () => {
    const verifier = generateCodeVerifier();
    expect(typeof codeChallengeFromVerifier(verifier)).toBe('string');
    expect(codeChallengeFromVerifier(verifier).length).toBeGreaterThan(0);
  });

  it('produces a base64url-encoded SHA-256 hash', () => {
    const verifier = 'test-verifier-value';
    const expected = createHash('sha256').update(verifier).digest('base64url');
    expect(codeChallengeFromVerifier(verifier)).toBe(expected);
  });

  it('is deterministic for the same input', () => {
    const verifier = generateCodeVerifier();
    expect(codeChallengeFromVerifier(verifier)).toBe(codeChallengeFromVerifier(verifier));
  });

  it('produces different output for different verifiers', () => {
    const v1 = generateCodeVerifier();
    const v2 = generateCodeVerifier();
    expect(codeChallengeFromVerifier(v1)).not.toBe(codeChallengeFromVerifier(v2));
  });

  it('uses base64url alphabet (no +, /, or = padding)', () => {
    for (let i = 0; i < 10; i++) {
      const challenge = codeChallengeFromVerifier(generateCodeVerifier());
      expect(challenge).not.toMatch(/[+/=]/);
    }
  });

  it('satisfies RFC 7636 S256 method: SHA-256(verifier) → base64url', () => {
    const verifier = 'dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk';
    const challenge = codeChallengeFromVerifier(verifier);
    // Independently compute the expected hash
    const expected = createHash('sha256').update(verifier).digest('base64url');
    expect(challenge).toBe(expected);
  });
});

// ─── codeVerifierCookieName ───────────────────────────────────────────────────

describe('codeVerifierCookieName()', () => {
  it('returns expected cookie name for canva', () => {
    expect(codeVerifierCookieName('canva')).toBe('oauth_pkce_canva');
  });

  it('returns expected cookie name for youtube', () => {
    expect(codeVerifierCookieName('youtube')).toBe('oauth_pkce_youtube');
  });

  it('includes the platform in the cookie name', () => {
    const platform = 'testplatform';
    expect(codeVerifierCookieName(platform)).toContain(platform);
  });

  it('is distinct from stateCookieName for the same platform', () => {
    expect(codeVerifierCookieName('canva')).not.toBe(stateCookieName('canva'));
  });
});

// ─── isOAuthPlatform ──────────────────────────────────────────────────────────

describe('isOAuthPlatform()', () => {
  it('returns true for "youtube"', () => {
    expect(isOAuthPlatform('youtube')).toBe(true);
  });

  it('returns true for "tiktok"', () => {
    expect(isOAuthPlatform('tiktok')).toBe(true);
  });

  it('returns true for "facebook"', () => {
    expect(isOAuthPlatform('facebook')).toBe(true);
  });

  it('returns true for "canva"', () => {
    expect(isOAuthPlatform('canva')).toBe(true);
  });

  it('returns false for "instagram" (not a ConnectablePlatform)', () => {
    expect(isOAuthPlatform('instagram')).toBe(false);
  });

  it('returns false for empty string', () => {
    expect(isOAuthPlatform('')).toBe(false);
  });

  it('returns false for a random string', () => {
    expect(isOAuthPlatform('twitter')).toBe(false);
  });

  it('returns false for uppercase platform name', () => {
    expect(isOAuthPlatform('YouTube')).toBe(false);
    expect(isOAuthPlatform('TIKTOK')).toBe(false);
  });

  it('returns false for partial match', () => {
    expect(isOAuthPlatform('you')).toBe(false);
    expect(isOAuthPlatform('tik')).toBe(false);
  });

  it('returns false for null cast as string check', () => {
    // The function signature accepts string, but let's make sure edge values return false
    expect(isOAuthPlatform('null')).toBe(false);
    expect(isOAuthPlatform('undefined')).toBe(false);
  });
});
