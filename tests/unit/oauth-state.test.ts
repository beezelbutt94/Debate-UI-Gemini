import { describe, it, expect } from 'vitest';
import {
  generateState,
  stateCookieName,
  generateCodeVerifier,
  codeChallengeFromVerifier,
  codeVerifierCookieName,
} from '@/lib/oauth/state';
import { createHash } from 'crypto';

// ─── generateState ────────────────────────────────────────────────────────────

describe('generateState', () => {
  it('returns a non-empty string', () => {
    expect(generateState()).toBeTruthy();
    expect(typeof generateState()).toBe('string');
  });

  it('returns at least 24 characters of base64url (32 bytes / 24 random bytes)', () => {
    // 24 random bytes → ceil(24*8/6)=32 base64url chars
    expect(generateState().length).toBeGreaterThanOrEqual(32);
  });

  it('produces different values on consecutive calls', () => {
    const s1 = generateState();
    const s2 = generateState();
    expect(s1).not.toBe(s2);
  });

  it('uses only base64url-safe characters (no +, /, =)', () => {
    for (let i = 0; i < 20; i++) {
      const state = generateState();
      expect(state).toMatch(/^[A-Za-z0-9_-]+$/);
    }
  });
});

// ─── stateCookieName ─────────────────────────────────────────────────────────

describe('stateCookieName', () => {
  it('returns oauth_state_<platform>', () => {
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

  it('works for arbitrary platform strings', () => {
    expect(stateCookieName('custom_platform')).toBe('oauth_state_custom_platform');
  });
});

// ─── generateCodeVerifier ─────────────────────────────────────────────────────

describe('generateCodeVerifier', () => {
  it('returns a non-empty string', () => {
    expect(generateCodeVerifier()).toBeTruthy();
  });

  it('returns at least 43 characters (32 bytes → base64url)', () => {
    // 32 bytes → ceil(32*8/6)=43 base64url chars
    expect(generateCodeVerifier().length).toBeGreaterThanOrEqual(43);
  });

  it('produces different values on consecutive calls', () => {
    const v1 = generateCodeVerifier();
    const v2 = generateCodeVerifier();
    expect(v1).not.toBe(v2);
  });

  it('uses only base64url-safe characters (no +, /, =)', () => {
    for (let i = 0; i < 20; i++) {
      const verifier = generateCodeVerifier();
      expect(verifier).toMatch(/^[A-Za-z0-9_-]+$/);
    }
  });
});

// ─── codeChallengeFromVerifier ───────────────────────────────────────────────

describe('codeChallengeFromVerifier', () => {
  it('returns a non-empty string', () => {
    expect(codeChallengeFromVerifier('some-verifier')).toBeTruthy();
  });

  it('is deterministic (same input → same output)', () => {
    const verifier = 'deterministic-test-verifier';
    expect(codeChallengeFromVerifier(verifier)).toBe(codeChallengeFromVerifier(verifier));
  });

  it('matches independent SHA-256 + base64url computation', () => {
    const verifier = 'test-verifier-for-pkce';
    const expected = createHash('sha256').update(verifier).digest('base64url');
    expect(codeChallengeFromVerifier(verifier)).toBe(expected);
  });

  it('uses only base64url-safe characters (no +, /, =)', () => {
    const challenge = codeChallengeFromVerifier('any-verifier-value-here');
    expect(challenge).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  it('produces different challenges for different verifiers', () => {
    const c1 = codeChallengeFromVerifier('verifier-one');
    const c2 = codeChallengeFromVerifier('verifier-two');
    expect(c1).not.toBe(c2);
  });

  it('works correctly with a full PKCE round-trip from generateCodeVerifier', () => {
    const verifier = generateCodeVerifier();
    const challenge = codeChallengeFromVerifier(verifier);
    const expected = createHash('sha256').update(verifier).digest('base64url');
    expect(challenge).toBe(expected);
  });
});

// ─── codeVerifierCookieName ───────────────────────────────────────────────────

describe('codeVerifierCookieName', () => {
  it('returns oauth_pkce_<platform>', () => {
    expect(codeVerifierCookieName('canva')).toBe('oauth_pkce_canva');
  });

  it('works for youtube', () => {
    expect(codeVerifierCookieName('youtube')).toBe('oauth_pkce_youtube');
  });

  it('works for arbitrary platform strings', () => {
    expect(codeVerifierCookieName('my_platform')).toBe('oauth_pkce_my_platform');
  });
});
