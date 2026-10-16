import { describe, it, expect } from 'vitest';
import {
  generateState,
  stateCookieName,
  generateCodeVerifier,
  codeChallengeFromVerifier,
  codeVerifierCookieName,
} from '@/lib/oauth/state';
import { createHash } from 'crypto';

// ── generateState ────────────────────────────────────────────────────────────

describe('generateState()', () => {
  it('returns a non-empty string', () => {
    expect(typeof generateState()).toBe('string');
    expect(generateState().length).toBeGreaterThan(0);
  });

  it('returns a base64url-safe string (no +, /, or = characters)', () => {
    for (let i = 0; i < 20; i++) {
      const state = generateState();
      expect(state).toMatch(/^[A-Za-z0-9_-]+$/);
    }
  });

  it('generates unique values each call', () => {
    const states = new Set(Array.from({ length: 100 }, () => generateState()));
    expect(states.size).toBe(100);
  });

  it('produces strings of expected length for 24 random bytes (32 base64url chars)', () => {
    // 24 bytes → 32 base64url chars (no padding)
    const state = generateState();
    expect(state.length).toBe(32);
  });
});

// ── stateCookieName ──────────────────────────────────────────────────────────

describe('stateCookieName()', () => {
  it('prefixes platform with oauth_state_', () => {
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

  it('passes arbitrary platform strings through', () => {
    expect(stateCookieName('new-platform')).toBe('oauth_state_new-platform');
  });
});

// ── generateCodeVerifier ─────────────────────────────────────────────────────

describe('generateCodeVerifier()', () => {
  it('returns a non-empty string', () => {
    expect(typeof generateCodeVerifier()).toBe('string');
    expect(generateCodeVerifier().length).toBeGreaterThan(0);
  });

  it('produces a base64url-safe string', () => {
    for (let i = 0; i < 20; i++) {
      const verifier = generateCodeVerifier();
      expect(verifier).toMatch(/^[A-Za-z0-9_-]+$/);
    }
  });

  it('generates unique values each call', () => {
    const verifiers = new Set(Array.from({ length: 100 }, () => generateCodeVerifier()));
    expect(verifiers.size).toBe(100);
  });

  it('produces strings of expected length for 32 random bytes (43 base64url chars)', () => {
    // 32 bytes → 43 base64url chars (no padding)
    const verifier = generateCodeVerifier();
    expect(verifier.length).toBe(43);
  });
});

// ── codeChallengeFromVerifier ────────────────────────────────────────────────

describe('codeChallengeFromVerifier()', () => {
  it('returns a non-empty string', () => {
    const verifier = generateCodeVerifier();
    expect(typeof codeChallengeFromVerifier(verifier)).toBe('string');
    expect(codeChallengeFromVerifier(verifier).length).toBeGreaterThan(0);
  });

  it('returns a base64url-safe string (RFC 7636 S256)', () => {
    for (let i = 0; i < 20; i++) {
      const challenge = codeChallengeFromVerifier(generateCodeVerifier());
      expect(challenge).toMatch(/^[A-Za-z0-9_-]+$/);
    }
  });

  it('is deterministic for the same verifier', () => {
    const verifier = 'fixed-verifier-for-test';
    expect(codeChallengeFromVerifier(verifier)).toBe(codeChallengeFromVerifier(verifier));
  });

  it('matches hand-computed SHA-256 base64url of verifier', () => {
    const verifier = 'dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk';
    const expected = createHash('sha256').update(verifier).digest('base64url');
    expect(codeChallengeFromVerifier(verifier)).toBe(expected);
  });

  it('produces different challenges for different verifiers', () => {
    const c1 = codeChallengeFromVerifier('verifier-one');
    const c2 = codeChallengeFromVerifier('verifier-two');
    expect(c1).not.toBe(c2);
  });

  it('generates challenge of expected length (SHA-256 → 43 base64url chars)', () => {
    // SHA-256 = 32 bytes → 43 base64url chars
    const challenge = codeChallengeFromVerifier(generateCodeVerifier());
    expect(challenge.length).toBe(43);
  });

  it('round-trip: generateCodeVerifier → codeChallengeFromVerifier produces valid PKCE pair', () => {
    const verifier = generateCodeVerifier();
    const challenge = codeChallengeFromVerifier(verifier);
    const recomputed = createHash('sha256').update(verifier).digest('base64url');
    expect(challenge).toBe(recomputed);
  });
});

// ── codeVerifierCookieName ───────────────────────────────────────────────────

describe('codeVerifierCookieName()', () => {
  it('prefixes platform with oauth_pkce_', () => {
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

  it('passes arbitrary platform strings through', () => {
    expect(codeVerifierCookieName('new-platform')).toBe('oauth_pkce_new-platform');
  });
});
