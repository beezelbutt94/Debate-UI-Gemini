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
  });

  it('returns a base64url string (no +, /, = characters)', () => {
    const state = generateState();
    expect(state).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  it('produces 32 base64url characters for 24 random bytes', () => {
    // 24 bytes → 32 base64url chars (ceil(24 * 4/3) = 32)
    const state = generateState();
    expect(state.length).toBe(32);
  });

  it('generates unique values on each call', () => {
    const a = generateState();
    const b = generateState();
    const c = generateState();
    expect(a).not.toBe(b);
    expect(b).not.toBe(c);
    expect(a).not.toBe(c);
  });

  it('generates 100 unique values with no collisions', () => {
    const states = Array.from({ length: 100 }, generateState);
    const unique = new Set(states);
    expect(unique.size).toBe(100);
  });
});

// ─── stateCookieName ──────────────────────────────────────────────────────────

describe('stateCookieName', () => {
  it('returns expected pattern for youtube', () => {
    expect(stateCookieName('youtube')).toBe('oauth_state_youtube');
  });

  it('returns expected pattern for tiktok', () => {
    expect(stateCookieName('tiktok')).toBe('oauth_state_tiktok');
  });

  it('returns expected pattern for facebook', () => {
    expect(stateCookieName('facebook')).toBe('oauth_state_facebook');
  });

  it('returns expected pattern for canva', () => {
    expect(stateCookieName('canva')).toBe('oauth_state_canva');
  });

  it('uses platform as suffix', () => {
    const platform = 'some_platform';
    expect(stateCookieName(platform)).toBe(`oauth_state_${platform}`);
  });

  it('prefixes with oauth_state_', () => {
    expect(stateCookieName('x')).toMatch(/^oauth_state_/);
  });
});

// ─── generateCodeVerifier ────────────────────────────────────────────────────

describe('generateCodeVerifier', () => {
  it('returns a non-empty string', () => {
    expect(generateCodeVerifier()).toBeTruthy();
  });

  it('returns a base64url string (no +, /, = characters)', () => {
    const verifier = generateCodeVerifier();
    expect(verifier).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  it('produces 43 base64url chars for 32 random bytes', () => {
    // 32 bytes → ceil(32 * 4/3) = 43 base64url chars (no padding)
    const verifier = generateCodeVerifier();
    expect(verifier.length).toBe(43);
  });

  it('generates unique values on each call', () => {
    const a = generateCodeVerifier();
    const b = generateCodeVerifier();
    expect(a).not.toBe(b);
  });

  it('generates 50 unique values with no collisions', () => {
    const verifiers = Array.from({ length: 50 }, generateCodeVerifier);
    expect(new Set(verifiers).size).toBe(50);
  });
});

// ─── codeChallengeFromVerifier ───────────────────────────────────────────────

describe('codeChallengeFromVerifier', () => {
  it('returns a non-empty string', () => {
    expect(codeChallengeFromVerifier('verifier')).toBeTruthy();
  });

  it('returns a base64url string (no +, /, = characters)', () => {
    const challenge = codeChallengeFromVerifier('some_verifier_value');
    expect(challenge).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  it('is deterministic: same verifier produces same challenge', () => {
    const v = 'test_verifier_123';
    expect(codeChallengeFromVerifier(v)).toBe(codeChallengeFromVerifier(v));
  });

  it('produces the correct SHA-256 base64url digest', () => {
    const verifier = 'dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk';
    const expected = createHash('sha256').update(verifier).digest('base64url');
    expect(codeChallengeFromVerifier(verifier)).toBe(expected);
  });

  it('different verifiers produce different challenges', () => {
    const c1 = codeChallengeFromVerifier('verifier_A');
    const c2 = codeChallengeFromVerifier('verifier_B');
    expect(c1).not.toBe(c2);
  });

  it('round-trips from generateCodeVerifier', () => {
    const verifier = generateCodeVerifier();
    const challenge = codeChallengeFromVerifier(verifier);
    // Verify it matches a manual SHA-256 digest
    const expected = createHash('sha256').update(verifier).digest('base64url');
    expect(challenge).toBe(expected);
  });

  it('handles empty verifier without throwing', () => {
    expect(() => codeChallengeFromVerifier('')).not.toThrow();
  });

  it('produces 43-char SHA-256 base64url output for typical input', () => {
    // SHA-256 is 32 bytes → 43 base64url chars
    const challenge = codeChallengeFromVerifier(generateCodeVerifier());
    expect(challenge.length).toBe(43);
  });
});

// ─── codeVerifierCookieName ───────────────────────────────────────────────────

describe('codeVerifierCookieName', () => {
  it('returns expected pattern for canva', () => {
    expect(codeVerifierCookieName('canva')).toBe('oauth_pkce_canva');
  });

  it('returns expected pattern for youtube', () => {
    expect(codeVerifierCookieName('youtube')).toBe('oauth_pkce_youtube');
  });

  it('prefixes with oauth_pkce_', () => {
    expect(codeVerifierCookieName('x')).toMatch(/^oauth_pkce_/);
  });

  it('uses platform as suffix', () => {
    const platform = 'my_platform';
    expect(codeVerifierCookieName(platform)).toBe(`oauth_pkce_${platform}`);
  });

  it('is different from stateCookieName for the same platform', () => {
    expect(codeVerifierCookieName('canva')).not.toBe(stateCookieName('canva'));
  });
});
