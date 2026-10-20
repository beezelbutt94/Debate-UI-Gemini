import { describe, it, expect } from 'vitest';
import {
  generateState,
  stateCookieName,
  generateCodeVerifier,
  codeChallengeFromVerifier,
  codeVerifierCookieName,
} from '@/lib/oauth/state';
import { createHash } from 'crypto';

// ── generateState ─────────────────────────────────────────────────────────────

describe('generateState()', () => {
  it('returns a non-empty string', () => {
    expect(typeof generateState()).toBe('string');
    expect(generateState().length).toBeGreaterThan(0);
  });

  it('returns a base64url-encoded string (no +, /, = characters)', () => {
    const state = generateState();
    expect(state).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  it('generates unique values on each call', () => {
    const states = new Set(Array.from({ length: 50 }, () => generateState()));
    expect(states.size).toBe(50);
  });

  it('has expected length: 24 bytes base64url → 32 chars', () => {
    // 24 bytes → ceil(24/3)*4 = 32 base64 chars, but base64url may trim padding
    const state = generateState();
    expect(state.length).toBe(32);
  });
});

// ── stateCookieName ───────────────────────────────────────────────────────────

describe('stateCookieName()', () => {
  it('prefixes with oauth_state_', () => {
    expect(stateCookieName('youtube')).toBe('oauth_state_youtube');
  });

  it('works for each supported platform', () => {
    expect(stateCookieName('tiktok')).toBe('oauth_state_tiktok');
    expect(stateCookieName('facebook')).toBe('oauth_state_facebook');
    expect(stateCookieName('canva')).toBe('oauth_state_canva');
  });

  it('passes arbitrary platform strings through unchanged', () => {
    expect(stateCookieName('test_platform')).toBe('oauth_state_test_platform');
  });
});

// ── generateCodeVerifier ──────────────────────────────────────────────────────

describe('generateCodeVerifier()', () => {
  it('returns a non-empty base64url string', () => {
    const v = generateCodeVerifier();
    expect(typeof v).toBe('string');
    expect(v).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  it('has expected length: 32 bytes → 43 base64url chars (no padding)', () => {
    expect(generateCodeVerifier().length).toBe(43);
  });

  it('generates unique verifiers on each call', () => {
    const verifiers = new Set(Array.from({ length: 50 }, () => generateCodeVerifier()));
    expect(verifiers.size).toBe(50);
  });
});

// ── codeChallengeFromVerifier ─────────────────────────────────────────────────

describe('codeChallengeFromVerifier()', () => {
  it('produces the SHA-256 base64url hash of the verifier', () => {
    const verifier = 'test-verifier-string';
    const expected = createHash('sha256').update(verifier).digest('base64url');
    expect(codeChallengeFromVerifier(verifier)).toBe(expected);
  });

  it('returns a base64url string (no padding characters)', () => {
    const challenge = codeChallengeFromVerifier(generateCodeVerifier());
    expect(challenge).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  it('is deterministic: same input → same output', () => {
    const v = 'fixed-verifier';
    expect(codeChallengeFromVerifier(v)).toBe(codeChallengeFromVerifier(v));
  });

  it('different verifiers produce different challenges', () => {
    const a = codeChallengeFromVerifier('aaa');
    const b = codeChallengeFromVerifier('bbb');
    expect(a).not.toBe(b);
  });

  it('satisfies RFC 7636: round-trip code_verifier → challenge matches node SHA-256', () => {
    const verifier = generateCodeVerifier();
    const challenge = codeChallengeFromVerifier(verifier);
    const recomputed = createHash('sha256').update(verifier).digest('base64url');
    expect(challenge).toBe(recomputed);
  });
});

// ── codeVerifierCookieName ────────────────────────────────────────────────────

describe('codeVerifierCookieName()', () => {
  it('prefixes with oauth_pkce_', () => {
    expect(codeVerifierCookieName('canva')).toBe('oauth_pkce_canva');
  });

  it('works for all platforms', () => {
    for (const p of ['youtube', 'tiktok', 'facebook', 'canva']) {
      expect(codeVerifierCookieName(p)).toBe(`oauth_pkce_${p}`);
    }
  });
});
