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

  it('returns a base64url-safe string (no +, /, =)', () => {
    for (let i = 0; i < 20; i++) {
      const state = generateState();
      expect(state).toMatch(/^[A-Za-z0-9_-]+$/);
    }
  });

  it('generates unique values each call', () => {
    const states = new Set(Array.from({ length: 50 }, () => generateState()));
    expect(states.size).toBe(50);
  });

  it('has expected length for 24 random bytes in base64url', () => {
    // 24 bytes * 4/3 = 32 chars in base64url (no padding)
    expect(generateState().length).toBe(32);
  });
});

describe('stateCookieName()', () => {
  it('builds correct cookie name for youtube', () => {
    expect(stateCookieName('youtube')).toBe('oauth_state_youtube');
  });

  it('builds correct cookie name for tiktok', () => {
    expect(stateCookieName('tiktok')).toBe('oauth_state_tiktok');
  });

  it('builds correct cookie name for facebook', () => {
    expect(stateCookieName('facebook')).toBe('oauth_state_facebook');
  });

  it('builds correct cookie name for canva', () => {
    expect(stateCookieName('canva')).toBe('oauth_state_canva');
  });

  it('handles arbitrary platform strings', () => {
    expect(stateCookieName('some_platform')).toBe('oauth_state_some_platform');
  });
});

describe('generateCodeVerifier()', () => {
  it('returns a non-empty string', () => {
    expect(typeof generateCodeVerifier()).toBe('string');
    expect(generateCodeVerifier().length).toBeGreaterThan(0);
  });

  it('returns a base64url-safe string (no +, /, =)', () => {
    for (let i = 0; i < 20; i++) {
      const verifier = generateCodeVerifier();
      expect(verifier).toMatch(/^[A-Za-z0-9_-]+$/);
    }
  });

  it('has expected length for 32 random bytes in base64url', () => {
    // 32 bytes * 4/3 ≈ 43 chars in base64url (no padding)
    expect(generateCodeVerifier().length).toBe(43);
  });

  it('generates unique values each call', () => {
    const verifiers = new Set(Array.from({ length: 50 }, () => generateCodeVerifier()));
    expect(verifiers.size).toBe(50);
  });
});

describe('codeChallengeFromVerifier()', () => {
  it('returns a base64url string', () => {
    const challenge = codeChallengeFromVerifier('some-verifier');
    expect(challenge).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  it('is deterministic for the same verifier', () => {
    const v = 'stable-verifier-abc123';
    expect(codeChallengeFromVerifier(v)).toBe(codeChallengeFromVerifier(v));
  });

  it('produces different challenges for different verifiers', () => {
    const c1 = codeChallengeFromVerifier('verifier-one');
    const c2 = codeChallengeFromVerifier('verifier-two');
    expect(c1).not.toBe(c2);
  });

  it('matches manual SHA-256 base64url of the verifier', () => {
    const verifier = 'test-pkce-verifier-value';
    const expected = createHash('sha256').update(verifier).digest('base64url');
    expect(codeChallengeFromVerifier(verifier)).toBe(expected);
  });

  it('round-trips with generateCodeVerifier()', () => {
    const verifier = generateCodeVerifier();
    const challenge = codeChallengeFromVerifier(verifier);
    const expected = createHash('sha256').update(verifier).digest('base64url');
    expect(challenge).toBe(expected);
  });

  it('handles empty string verifier', () => {
    const challenge = codeChallengeFromVerifier('');
    expect(typeof challenge).toBe('string');
    expect(challenge.length).toBeGreaterThan(0);
  });
});

describe('codeVerifierCookieName()', () => {
  it('builds correct cookie name for canva', () => {
    expect(codeVerifierCookieName('canva')).toBe('oauth_pkce_canva');
  });

  it('builds correct cookie name for youtube', () => {
    expect(codeVerifierCookieName('youtube')).toBe('oauth_pkce_youtube');
  });

  it('handles arbitrary platform strings', () => {
    expect(codeVerifierCookieName('some_platform')).toBe('oauth_pkce_some_platform');
  });
});
