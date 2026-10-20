import { describe, it, expect } from 'vitest';
import { createHash } from 'crypto';
import {
  generateState,
  stateCookieName,
  generateCodeVerifier,
  codeChallengeFromVerifier,
  codeVerifierCookieName,
} from '@/lib/oauth/state';

// ── generateState ─────────────────────────────────────────────────────────────

describe('generateState', () => {
  it('returns a non-empty string', () => {
    expect(generateState().length).toBeGreaterThan(0);
  });

  it('returns a base64url string (no +/= chars)', () => {
    const state = generateState();
    expect(state).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  it('returns a unique value each call', () => {
    const a = generateState();
    const b = generateState();
    expect(a).not.toBe(b);
  });

  it('returns a string of expected length (24 random bytes → ~32 base64url chars)', () => {
    const state = generateState();
    // base64url of 24 bytes = 32 characters (no padding)
    expect(state.length).toBe(32);
  });

  it('generates 1000 unique values without collision', () => {
    const values = new Set(Array.from({ length: 1000 }, generateState));
    expect(values.size).toBe(1000);
  });
});

// ── stateCookieName ───────────────────────────────────────────────────────────

describe('stateCookieName', () => {
  it('produces correct cookie name for youtube', () => {
    expect(stateCookieName('youtube')).toBe('oauth_state_youtube');
  });

  it('produces correct cookie name for tiktok', () => {
    expect(stateCookieName('tiktok')).toBe('oauth_state_tiktok');
  });

  it('produces correct cookie name for facebook', () => {
    expect(stateCookieName('facebook')).toBe('oauth_state_facebook');
  });

  it('produces correct cookie name for canva', () => {
    expect(stateCookieName('canva')).toBe('oauth_state_canva');
  });

  it('handles arbitrary platform string', () => {
    expect(stateCookieName('instagram')).toBe('oauth_state_instagram');
  });
});

// ── generateCodeVerifier ──────────────────────────────────────────────────────

describe('generateCodeVerifier', () => {
  it('returns a non-empty string', () => {
    expect(generateCodeVerifier().length).toBeGreaterThan(0);
  });

  it('returns a base64url string (no +/= chars)', () => {
    const verifier = generateCodeVerifier();
    expect(verifier).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  it('returns a unique value each call', () => {
    const a = generateCodeVerifier();
    const b = generateCodeVerifier();
    expect(a).not.toBe(b);
  });

  it('returns a string of expected length (32 random bytes → ~43 base64url chars)', () => {
    const verifier = generateCodeVerifier();
    // base64url of 32 bytes = 43 characters (no padding)
    expect(verifier.length).toBe(43);
  });

  it('generates 1000 unique values without collision', () => {
    const values = new Set(Array.from({ length: 1000 }, generateCodeVerifier));
    expect(values.size).toBe(1000);
  });
});

// ── codeChallengeFromVerifier ─────────────────────────────────────────────────

describe('codeChallengeFromVerifier', () => {
  it('returns a base64url string', () => {
    const challenge = codeChallengeFromVerifier('some-verifier');
    expect(challenge).toMatch(/^[A-Za-z0-9_-]+$/);
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

  it('matches the RFC 7636 S256 spec: BASE64URL(SHA-256(ASCII(code_verifier)))', () => {
    const verifier = 'dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk';
    const expected = createHash('sha256').update(verifier).digest('base64url');
    expect(codeChallengeFromVerifier(verifier)).toBe(expected);
  });

  it('produces a 43-character challenge (SHA-256 = 32 bytes → 43 base64url chars, no padding)', () => {
    const challenge = codeChallengeFromVerifier(generateCodeVerifier());
    expect(challenge.length).toBe(43);
  });

  it('handles empty string verifier (edge case)', () => {
    const challenge = codeChallengeFromVerifier('');
    expect(challenge).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(challenge.length).toBe(43);
  });

  it('handles verifier with special ASCII chars', () => {
    const challenge = codeChallengeFromVerifier('hello world!@#$');
    expect(challenge).toMatch(/^[A-Za-z0-9_-]+$/);
  });
});

// ── codeVerifierCookieName ────────────────────────────────────────────────────

describe('codeVerifierCookieName', () => {
  it('produces correct cookie name for canva', () => {
    expect(codeVerifierCookieName('canva')).toBe('oauth_pkce_canva');
  });

  it('produces correct cookie name for youtube', () => {
    expect(codeVerifierCookieName('youtube')).toBe('oauth_pkce_youtube');
  });

  it('produces correct cookie name for tiktok', () => {
    expect(codeVerifierCookieName('tiktok')).toBe('oauth_pkce_tiktok');
  });

  it('handles arbitrary platform string', () => {
    expect(codeVerifierCookieName('instagram')).toBe('oauth_pkce_instagram');
  });
});
