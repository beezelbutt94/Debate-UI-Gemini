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
    expect(typeof generateState()).toBe('string');
    expect(generateState().length).toBeGreaterThan(0);
  });

  it('returns a base64url-safe string (no +, /, or = characters)', () => {
    const state = generateState();
    expect(state).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  it('returns ~32 characters (24 bytes base64url ≈ 32 chars)', () => {
    // 24 bytes → ceil(24*4/3) = 32 base64url chars
    expect(generateState().length).toBe(32);
  });

  it('produces a different value on each call (random)', () => {
    const states = new Set(Array.from({ length: 20 }, () => generateState()));
    expect(states.size).toBe(20);
  });
});

describe('stateCookieName()', () => {
  it('prefixes the platform with oauth_state_', () => {
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

  it('works with an arbitrary platform string', () => {
    expect(stateCookieName('my-platform')).toBe('oauth_state_my-platform');
  });

  it('is deterministic for the same input', () => {
    expect(stateCookieName('test')).toBe(stateCookieName('test'));
  });
});

describe('generateCodeVerifier()', () => {
  it('returns a non-empty string', () => {
    expect(typeof generateCodeVerifier()).toBe('string');
    expect(generateCodeVerifier().length).toBeGreaterThan(0);
  });

  it('returns a base64url-safe string', () => {
    expect(generateCodeVerifier()).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  it('returns ~43 characters (32 bytes base64url ≈ 43 chars)', () => {
    // 32 bytes → ceil(32*4/3) = 43 base64url chars
    expect(generateCodeVerifier().length).toBe(43);
  });

  it('produces a different value on each call', () => {
    const verifiers = new Set(Array.from({ length: 20 }, () => generateCodeVerifier()));
    expect(verifiers.size).toBe(20);
  });
});

describe('codeChallengeFromVerifier()', () => {
  it('produces a base64url string', () => {
    const verifier = generateCodeVerifier();
    const challenge = codeChallengeFromVerifier(verifier);
    expect(challenge).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  it('matches the RFC 7636 S256 algorithm (SHA-256, base64url, no padding)', () => {
    const verifier = 'dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk';
    const expected = createHash('sha256').update(verifier).digest('base64url');
    expect(codeChallengeFromVerifier(verifier)).toBe(expected);
  });

  it('is deterministic for the same verifier', () => {
    const v = generateCodeVerifier();
    expect(codeChallengeFromVerifier(v)).toBe(codeChallengeFromVerifier(v));
  });

  it('produces different challenges for different verifiers', () => {
    const a = generateCodeVerifier();
    const b = generateCodeVerifier();
    // astronomically unlikely to collide
    expect(codeChallengeFromVerifier(a)).not.toBe(codeChallengeFromVerifier(b));
  });

  it('challenge length is 43 characters (256-bit SHA-256 → base64url)', () => {
    expect(codeChallengeFromVerifier(generateCodeVerifier()).length).toBe(43);
  });
});

describe('codeVerifierCookieName()', () => {
  it('prefixes with oauth_pkce_', () => {
    expect(codeVerifierCookieName('canva')).toBe('oauth_pkce_canva');
  });

  it('works for youtube', () => {
    expect(codeVerifierCookieName('youtube')).toBe('oauth_pkce_youtube');
  });

  it('is deterministic', () => {
    expect(codeVerifierCookieName('tiktok')).toBe(codeVerifierCookieName('tiktok'));
  });

  it('handles arbitrary platform strings', () => {
    expect(codeVerifierCookieName('custom-platform')).toBe('oauth_pkce_custom-platform');
  });
});
