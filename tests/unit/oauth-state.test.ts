import { describe, it, expect } from 'vitest';
import { createHash } from 'crypto';
import {
  generateState,
  stateCookieName,
  generateCodeVerifier,
  codeChallengeFromVerifier,
  codeVerifierCookieName,
} from '@/lib/oauth/state';

// ---------------------------------------------------------------------------
// generateState
// ---------------------------------------------------------------------------
describe('generateState()', () => {
  it('returns a string', () => {
    expect(typeof generateState()).toBe('string');
  });

  it('returns a non-empty value', () => {
    expect(generateState().length).toBeGreaterThan(0);
  });

  it('returns a base64url string (no + / = chars)', () => {
    const state = generateState();
    expect(state).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  it('generates a unique value each call', () => {
    const a = generateState();
    const b = generateState();
    expect(a).not.toBe(b);
  });

  it('generates values of consistent length (32 base64url chars for 24 bytes)', () => {
    // 24 bytes -> 32 base64url chars (no padding)
    const state = generateState();
    expect(state.length).toBe(32);
  });
});

// ---------------------------------------------------------------------------
// stateCookieName
// ---------------------------------------------------------------------------
describe('stateCookieName()', () => {
  it('includes the platform name', () => {
    expect(stateCookieName('youtube')).toContain('youtube');
    expect(stateCookieName('tiktok')).toContain('tiktok');
  });

  it('follows the expected prefix pattern', () => {
    expect(stateCookieName('youtube')).toBe('oauth_state_youtube');
    expect(stateCookieName('facebook')).toBe('oauth_state_facebook');
  });

  it('produces different names for different platforms', () => {
    expect(stateCookieName('youtube')).not.toBe(stateCookieName('tiktok'));
  });
});

// ---------------------------------------------------------------------------
// generateCodeVerifier
// ---------------------------------------------------------------------------
describe('generateCodeVerifier()', () => {
  it('returns a string', () => {
    expect(typeof generateCodeVerifier()).toBe('string');
  });

  it('returns a base64url string (no + / = chars)', () => {
    const v = generateCodeVerifier();
    expect(v).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  it('generates a unique value each call', () => {
    const a = generateCodeVerifier();
    const b = generateCodeVerifier();
    expect(a).not.toBe(b);
  });

  it('produces a 43-char value for 32 random bytes', () => {
    // 32 bytes -> 43 base64url chars (no padding)
    const v = generateCodeVerifier();
    expect(v.length).toBe(43);
  });
});

// ---------------------------------------------------------------------------
// codeChallengeFromVerifier
// ---------------------------------------------------------------------------
describe('codeChallengeFromVerifier()', () => {
  it('returns a base64url string', () => {
    const challenge = codeChallengeFromVerifier('someverifier');
    expect(challenge).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  it('is deterministic for the same verifier', () => {
    const v = 'my-test-verifier';
    expect(codeChallengeFromVerifier(v)).toBe(codeChallengeFromVerifier(v));
  });

  it('matches the RFC 7636 SHA-256 base64url formula', () => {
    const verifier = 'dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk';
    const expected = createHash('sha256').update(verifier).digest('base64url');
    expect(codeChallengeFromVerifier(verifier)).toBe(expected);
  });

  it('produces different challenges for different verifiers', () => {
    expect(codeChallengeFromVerifier('verifierA')).not.toBe(codeChallengeFromVerifier('verifierB'));
  });

  it('round-trips: generate verifier then challenge without error', () => {
    const verifier = generateCodeVerifier();
    expect(() => codeChallengeFromVerifier(verifier)).not.toThrow();
  });

  it('produces a 43-char challenge for a SHA-256 digest (256 bits / 6 = 43)', () => {
    // SHA-256 -> 32 bytes -> 43 base64url chars
    const challenge = codeChallengeFromVerifier('test');
    expect(challenge.length).toBe(43);
  });
});

// ---------------------------------------------------------------------------
// codeVerifierCookieName
// ---------------------------------------------------------------------------
describe('codeVerifierCookieName()', () => {
  it('includes the platform name', () => {
    expect(codeVerifierCookieName('canva')).toContain('canva');
  });

  it('follows the expected prefix pattern', () => {
    expect(codeVerifierCookieName('canva')).toBe('oauth_pkce_canva');
  });

  it('produces different names for different platforms', () => {
    expect(codeVerifierCookieName('canva')).not.toBe(codeVerifierCookieName('youtube'));
  });
});
