import { describe, it, expect } from 'vitest';
import { createHash } from 'crypto';
import {
  generateState,
  stateCookieName,
  generateCodeVerifier,
  codeChallengeFromVerifier,
  codeVerifierCookieName,
} from '@/lib/oauth/state';
import { isOAuthPlatform } from '@/lib/oauth/types';

// ─── generateState ───────────────────────────────────────────────────────────

describe('generateState', () => {
  it('returns a string', () => {
    expect(typeof generateState()).toBe('string');
  });

  it('returns a non-empty string', () => {
    expect(generateState().length).toBeGreaterThan(0);
  });

  it('returns a base64url string (no +, /, or = characters)', () => {
    const state = generateState();
    expect(state).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  it('generates unique values on each call (randomness check)', () => {
    const states = new Set(Array.from({ length: 20 }, () => generateState()));
    expect(states.size).toBe(20);
  });

  it('returns a string of at least 24 bytes encoded (~32 chars base64url)', () => {
    // 24 random bytes → base64url is 32 chars
    expect(generateState().length).toBeGreaterThanOrEqual(32);
  });
});

// ─── stateCookieName ─────────────────────────────────────────────────────────

describe('stateCookieName', () => {
  it('returns oauth_state_ prefix + platform', () => {
    expect(stateCookieName('youtube')).toBe('oauth_state_youtube');
  });

  it('handles tiktok platform', () => {
    expect(stateCookieName('tiktok')).toBe('oauth_state_tiktok');
  });

  it('handles facebook platform', () => {
    expect(stateCookieName('facebook')).toBe('oauth_state_facebook');
  });

  it('handles canva platform', () => {
    expect(stateCookieName('canva')).toBe('oauth_state_canva');
  });

  it('is deterministic for the same platform', () => {
    expect(stateCookieName('youtube')).toBe(stateCookieName('youtube'));
  });

  it('produces different names for different platforms', () => {
    expect(stateCookieName('youtube')).not.toBe(stateCookieName('tiktok'));
  });
});

// ─── generateCodeVerifier ────────────────────────────────────────────────────

describe('generateCodeVerifier', () => {
  it('returns a string', () => {
    expect(typeof generateCodeVerifier()).toBe('string');
  });

  it('is a valid base64url string', () => {
    expect(generateCodeVerifier()).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  it('is at least 43 chars (RFC 7636 minimum for 32 bytes)', () => {
    // 32 bytes → 43 chars base64url (no padding)
    expect(generateCodeVerifier().length).toBeGreaterThanOrEqual(43);
  });

  it('generates unique values (randomness check)', () => {
    const verifiers = new Set(Array.from({ length: 20 }, () => generateCodeVerifier()));
    expect(verifiers.size).toBe(20);
  });
});

// ─── codeChallengeFromVerifier ───────────────────────────────────────────────

describe('codeChallengeFromVerifier', () => {
  it('returns a string', () => {
    expect(typeof codeChallengeFromVerifier('test-verifier')).toBe('string');
  });

  it('is deterministic for the same verifier', () => {
    const v = generateCodeVerifier();
    expect(codeChallengeFromVerifier(v)).toBe(codeChallengeFromVerifier(v));
  });

  it('produces different challenges for different verifiers', () => {
    const a = codeChallengeFromVerifier('verifier-a');
    const b = codeChallengeFromVerifier('verifier-b');
    expect(a).not.toBe(b);
  });

  it('is a valid base64url string (no +, /, or = padding)', () => {
    const challenge = codeChallengeFromVerifier(generateCodeVerifier());
    expect(challenge).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  it('matches the expected SHA256/base64url calculation (RFC 7636 S256)', () => {
    const verifier = 'dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk';
    const expected = createHash('sha256').update(verifier).digest('base64url');
    expect(codeChallengeFromVerifier(verifier)).toBe(expected);
  });

  it('handles a short verifier string', () => {
    expect(() => codeChallengeFromVerifier('x')).not.toThrow();
  });

  it('handles a very long verifier string', () => {
    const longVerifier = 'a'.repeat(128);
    expect(() => codeChallengeFromVerifier(longVerifier)).not.toThrow();
  });

  it('challenge is 43 chars (SHA-256 → 32 bytes → 43 base64url chars)', () => {
    const challenge = codeChallengeFromVerifier(generateCodeVerifier());
    expect(challenge.length).toBe(43);
  });
});

// ─── codeVerifierCookieName ──────────────────────────────────────────────────

describe('codeVerifierCookieName', () => {
  it('returns oauth_pkce_ prefix + platform', () => {
    expect(codeVerifierCookieName('canva')).toBe('oauth_pkce_canva');
  });

  it('handles all known platforms', () => {
    expect(codeVerifierCookieName('youtube')).toBe('oauth_pkce_youtube');
    expect(codeVerifierCookieName('tiktok')).toBe('oauth_pkce_tiktok');
    expect(codeVerifierCookieName('facebook')).toBe('oauth_pkce_facebook');
  });

  it('is deterministic', () => {
    expect(codeVerifierCookieName('canva')).toBe(codeVerifierCookieName('canva'));
  });

  it('differs from stateCookieName for same platform', () => {
    expect(codeVerifierCookieName('canva')).not.toBe(stateCookieName('canva'));
  });
});

// ─── isOAuthPlatform ─────────────────────────────────────────────────────────

describe('isOAuthPlatform', () => {
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

  it('returns false for unknown platform', () => {
    expect(isOAuthPlatform('instagram')).toBe(false);
  });

  it('returns false for empty string', () => {
    expect(isOAuthPlatform('')).toBe(false);
  });

  it('returns false for uppercase variant', () => {
    expect(isOAuthPlatform('YouTube')).toBe(false);
  });

  it('returns false for partial match', () => {
    expect(isOAuthPlatform('you')).toBe(false);
  });

  it('returns false for arbitrary string', () => {
    expect(isOAuthPlatform('twitter')).toBe(false);
  });

  it('returns false for "youtube_shorts" (content platform, not OAuth platform)', () => {
    expect(isOAuthPlatform('youtube_shorts')).toBe(false);
  });

  it('returns false for "facebook_reels"', () => {
    expect(isOAuthPlatform('facebook_reels')).toBe(false);
  });
});
