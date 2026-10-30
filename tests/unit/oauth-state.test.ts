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

  it('returns base64url-safe characters only', () => {
    const state = generateState();
    expect(state).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  it('returns different values on each call (entropy)', () => {
    const states = new Set(Array.from({ length: 20 }, () => generateState()));
    expect(states.size).toBe(20);
  });

  it('has correct byte length for 24 random bytes as base64url (~32 chars)', () => {
    // 24 bytes → ceil(24/3)*4 = 32 base64 chars (no padding with base64url)
    const state = generateState();
    expect(state.length).toBeGreaterThanOrEqual(30);
    expect(state.length).toBeLessThanOrEqual(34);
  });
});

describe('stateCookieName', () => {
  it('returns expected name for youtube', () => {
    expect(stateCookieName('youtube')).toBe('oauth_state_youtube');
  });

  it('returns expected name for tiktok', () => {
    expect(stateCookieName('tiktok')).toBe('oauth_state_tiktok');
  });

  it('returns expected name for facebook', () => {
    expect(stateCookieName('facebook')).toBe('oauth_state_facebook');
  });

  it('returns expected name for canva', () => {
    expect(stateCookieName('canva')).toBe('oauth_state_canva');
  });

  it('uses platform value as suffix', () => {
    const platform = 'testplatform';
    expect(stateCookieName(platform)).toBe(`oauth_state_${platform}`);
  });
});

describe('generateCodeVerifier', () => {
  it('returns a non-empty string', () => {
    expect(typeof generateCodeVerifier()).toBe('string');
    expect(generateCodeVerifier().length).toBeGreaterThan(0);
  });

  it('returns base64url-safe characters only', () => {
    const verifier = generateCodeVerifier();
    expect(verifier).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  it('is unique per call', () => {
    const verifiers = new Set(Array.from({ length: 20 }, () => generateCodeVerifier()));
    expect(verifiers.size).toBe(20);
  });

  it('has correct length for 32 random bytes (~43 chars base64url)', () => {
    // 32 bytes → 43 base64url chars (no padding)
    const v = generateCodeVerifier();
    expect(v.length).toBeGreaterThanOrEqual(41);
    expect(v.length).toBeLessThanOrEqual(44);
  });
});

describe('codeChallengeFromVerifier', () => {
  it('returns a non-empty string', () => {
    const verifier = generateCodeVerifier();
    expect(typeof codeChallengeFromVerifier(verifier)).toBe('string');
  });

  it('returns base64url-safe characters only', () => {
    const challenge = codeChallengeFromVerifier(generateCodeVerifier());
    expect(challenge).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  it('is deterministic for the same verifier', () => {
    const verifier = generateCodeVerifier();
    expect(codeChallengeFromVerifier(verifier)).toBe(codeChallengeFromVerifier(verifier));
  });

  it('produces different challenges for different verifiers', () => {
    const c1 = codeChallengeFromVerifier(generateCodeVerifier());
    const c2 = codeChallengeFromVerifier(generateCodeVerifier());
    expect(c1).not.toBe(c2);
  });

  it('matches the expected SHA-256 base64url of the verifier', () => {
    const verifier = 'test-verifier-string';
    const expected = createHash('sha256').update(verifier).digest('base64url');
    expect(codeChallengeFromVerifier(verifier)).toBe(expected);
  });

  it('challenge length is 43 chars (SHA-256 → 32 bytes → base64url)', () => {
    const challenge = codeChallengeFromVerifier(generateCodeVerifier());
    expect(challenge.length).toBe(43);
  });
});

describe('codeVerifierCookieName', () => {
  it('returns expected name for canva', () => {
    expect(codeVerifierCookieName('canva')).toBe('oauth_pkce_canva');
  });

  it('returns expected name for youtube', () => {
    expect(codeVerifierCookieName('youtube')).toBe('oauth_pkce_youtube');
  });

  it('uses platform value as suffix', () => {
    const platform = 'testplatform';
    expect(codeVerifierCookieName(platform)).toBe(`oauth_pkce_${platform}`);
  });

  it('state and pkce cookies use different prefixes for same platform', () => {
    const platform = 'canva';
    expect(stateCookieName(platform)).not.toBe(codeVerifierCookieName(platform));
  });
});
