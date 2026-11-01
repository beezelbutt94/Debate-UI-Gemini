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
  it('returns a non-empty string', () => {
    expect(generateState()).toBeTruthy();
  });

  it('returns a base64url string (no +, /, or = chars)', () => {
    const state = generateState();
    expect(state).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  it('returns different values on each call', () => {
    const states = new Set(Array.from({ length: 20 }, () => generateState()));
    expect(states.size).toBe(20);
  });

  it('has expected byte length: 24 bytes → 32 base64url chars', () => {
    // 24 raw bytes = 32 base64url characters (no padding)
    const state = generateState();
    expect(state.length).toBe(32);
  });
});

// ─── stateCookieName ─────────────────────────────────────────────────────────

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

  it('preserves arbitrary platform strings', () => {
    expect(stateCookieName('custom_provider')).toBe('oauth_state_custom_provider');
  });
});

// ─── generateCodeVerifier ────────────────────────────────────────────────────

describe('generateCodeVerifier', () => {
  it('returns a non-empty string', () => {
    expect(generateCodeVerifier()).toBeTruthy();
  });

  it('returns a base64url string (no +, /, or = chars)', () => {
    const verifier = generateCodeVerifier();
    expect(verifier).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  it('returns different values on each call', () => {
    const verifiers = new Set(Array.from({ length: 20 }, () => generateCodeVerifier()));
    expect(verifiers.size).toBe(20);
  });

  it('has expected byte length: 32 bytes → 43 base64url chars', () => {
    // 32 raw bytes = 43 base64url characters (ceil(32*8/6) = 43, no padding)
    const verifier = generateCodeVerifier();
    expect(verifier.length).toBe(43);
  });
});

// ─── codeChallengeFromVerifier ───────────────────────────────────────────────

describe('codeChallengeFromVerifier', () => {
  it('returns a non-empty string', () => {
    const verifier = generateCodeVerifier();
    expect(codeChallengeFromVerifier(verifier)).toBeTruthy();
  });

  it('returns a base64url string (no +, /, or = chars)', () => {
    const verifier = generateCodeVerifier();
    const challenge = codeChallengeFromVerifier(verifier);
    expect(challenge).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  it('produces the correct SHA-256 base64url of the verifier (RFC 7636)', () => {
    const verifier = 'dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk';
    const expected = createHash('sha256').update(verifier).digest('base64url');
    expect(codeChallengeFromVerifier(verifier)).toBe(expected);
  });

  it('is deterministic for the same verifier', () => {
    const verifier = generateCodeVerifier();
    expect(codeChallengeFromVerifier(verifier)).toBe(codeChallengeFromVerifier(verifier));
  });

  it('produces different challenges for different verifiers', () => {
    const v1 = generateCodeVerifier();
    const v2 = generateCodeVerifier();
    expect(codeChallengeFromVerifier(v1)).not.toBe(codeChallengeFromVerifier(v2));
  });

  it('challenge length is 43 chars (SHA-256 = 32 bytes = 43 base64url chars)', () => {
    const verifier = generateCodeVerifier();
    const challenge = codeChallengeFromVerifier(verifier);
    expect(challenge.length).toBe(43);
  });

  it('handles an empty verifier string', () => {
    // SHA-256 of '' is a well-known hash
    const expected = createHash('sha256').update('').digest('base64url');
    expect(codeChallengeFromVerifier('')).toBe(expected);
  });
});

// ─── codeVerifierCookieName ──────────────────────────────────────────────────

describe('codeVerifierCookieName', () => {
  it('prefixes with oauth_pkce_', () => {
    expect(codeVerifierCookieName('canva')).toBe('oauth_pkce_canva');
  });

  it('works for youtube', () => {
    expect(codeVerifierCookieName('youtube')).toBe('oauth_pkce_youtube');
  });

  it('works for tiktok', () => {
    expect(codeVerifierCookieName('tiktok')).toBe('oauth_pkce_tiktok');
  });

  it('works for facebook', () => {
    expect(codeVerifierCookieName('facebook')).toBe('oauth_pkce_facebook');
  });

  it('preserves arbitrary platform strings', () => {
    expect(codeVerifierCookieName('my-provider')).toBe('oauth_pkce_my-provider');
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

  it('returns false for "instagram"', () => {
    expect(isOAuthPlatform('instagram')).toBe(false);
  });

  it('returns false for "twitter"', () => {
    expect(isOAuthPlatform('twitter')).toBe(false);
  });

  it('returns false for empty string', () => {
    expect(isOAuthPlatform('')).toBe(false);
  });

  it('returns false for uppercase "YouTube"', () => {
    expect(isOAuthPlatform('YouTube')).toBe(false);
  });

  it('returns false for "TIKTOK"', () => {
    expect(isOAuthPlatform('TIKTOK')).toBe(false);
  });

  it('returns false for random string', () => {
    expect(isOAuthPlatform('somerandomprovider')).toBe(false);
  });

  it('returns false for "FACEBOOK"', () => {
    expect(isOAuthPlatform('FACEBOOK')).toBe(false);
  });

  it('returns false for "CANVA"', () => {
    expect(isOAuthPlatform('CANVA')).toBe(false);
  });
});
