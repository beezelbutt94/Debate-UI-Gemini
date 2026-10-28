import { describe, it, expect } from 'vitest';
import { createHash } from 'crypto';
import {
  generateState,
  stateCookieName,
  generateCodeVerifier,
  codeChallengeFromVerifier,
  codeVerifierCookieName,
} from '../../lib/oauth/state';

describe('generateState', () => {
  it('returns a non-empty string', () => {
    expect(generateState()).toBeTypeOf('string');
    expect(generateState().length).toBeGreaterThan(0);
  });

  it('returns a base64url-safe string (no +, /, =)', () => {
    const state = generateState();
    expect(state).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  it('generates 32 base64url chars for 24 random bytes', () => {
    // 24 bytes → ceil(24 * 4/3) = 32 base64url chars
    const state = generateState();
    expect(state.length).toBe(32);
  });

  it('produces unique values across calls', () => {
    const a = generateState();
    const b = generateState();
    expect(a).not.toBe(b);
  });

  it('generates 50 unique states in a row', () => {
    const states = new Set(Array.from({ length: 50 }, generateState));
    expect(states.size).toBe(50);
  });
});

describe('stateCookieName', () => {
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

  it('prefixes with oauth_state_', () => {
    const platform = 'anything';
    expect(stateCookieName(platform)).toBe(`oauth_state_${platform}`);
  });
});

describe('generateCodeVerifier', () => {
  it('returns a non-empty string', () => {
    expect(generateCodeVerifier()).toBeTypeOf('string');
    expect(generateCodeVerifier().length).toBeGreaterThan(0);
  });

  it('returns a base64url-safe string', () => {
    expect(generateCodeVerifier()).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  it('generates 43 base64url chars for 32 random bytes', () => {
    // 32 bytes → ceil(32 * 4/3) = 43 base64url chars (no padding)
    expect(generateCodeVerifier().length).toBe(43);
  });

  it('produces unique values', () => {
    expect(generateCodeVerifier()).not.toBe(generateCodeVerifier());
  });
});

describe('codeChallengeFromVerifier', () => {
  it('returns a base64url string', () => {
    expect(codeChallengeFromVerifier('verifier')).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  it('is deterministic for the same verifier', () => {
    const v = 'my-test-verifier-abc123';
    expect(codeChallengeFromVerifier(v)).toBe(codeChallengeFromVerifier(v));
  });

  it('produces different challenges for different verifiers', () => {
    expect(codeChallengeFromVerifier('verifier-a')).not.toBe(codeChallengeFromVerifier('verifier-b'));
  });

  it('matches a known SHA-256 base64url value', () => {
    // SHA-256("abc") — cross-check against Node's own crypto
    const challenge = codeChallengeFromVerifier('abc');
    const expected = createHash('sha256').update('abc').digest('base64url');
    expect(challenge).toBe(expected);
  });

  it('produces 43-char challenge for a 32-byte verifier', () => {
    const verifier = generateCodeVerifier();
    // SHA-256 is always 32 bytes → 43 chars in base64url
    expect(codeChallengeFromVerifier(verifier).length).toBe(43);
  });

  it('handles empty string verifier without throwing', () => {
    expect(() => codeChallengeFromVerifier('')).not.toThrow();
  });

  it('challenge differs from verifier itself', () => {
    const v = generateCodeVerifier();
    expect(codeChallengeFromVerifier(v)).not.toBe(v);
  });
});

describe('codeVerifierCookieName', () => {
  it('returns expected cookie name for canva', () => {
    expect(codeVerifierCookieName('canva')).toBe('oauth_pkce_canva');
  });

  it('returns expected cookie name for any platform', () => {
    expect(codeVerifierCookieName('youtube')).toBe('oauth_pkce_youtube');
  });

  it('prefixes with oauth_pkce_', () => {
    const platform = 'test';
    expect(codeVerifierCookieName(platform)).toBe(`oauth_pkce_${platform}`);
  });
});
