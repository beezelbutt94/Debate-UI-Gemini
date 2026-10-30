import { describe, it, expect } from 'vitest';
import {
  generateState,
  stateCookieName,
  generateCodeVerifier,
  codeChallengeFromVerifier,
  codeVerifierCookieName,
} from '@/lib/oauth/state';
import { createHash } from 'crypto';

// ──────────────────────────────────────────────────────────
// generateState()
// ──────────────────────────────────────────────────────────
describe('generateState()', () => {
  it('returns a non-empty string', () => {
    expect(typeof generateState()).toBe('string');
    expect(generateState().length).toBeGreaterThan(0);
  });

  it('produces URL-safe base64 (no +, /, = characters)', () => {
    const state = generateState();
    expect(state).not.toMatch(/[+/=]/);
  });

  it('generates unique values on each call', () => {
    const states = new Set(Array.from({ length: 20 }, () => generateState()));
    expect(states.size).toBe(20);
  });

  it('has expected length for 24 random bytes in base64url (32 chars)', () => {
    // 24 bytes → ceil(24/3)*4 = 32 chars, no padding needed
    expect(generateState().length).toBe(32);
  });
});

// ──────────────────────────────────────────────────────────
// stateCookieName()
// ──────────────────────────────────────────────────────────
describe('stateCookieName()', () => {
  it('returns correct name for youtube', () => {
    expect(stateCookieName('youtube')).toBe('oauth_state_youtube');
  });
  it('returns correct name for tiktok', () => {
    expect(stateCookieName('tiktok')).toBe('oauth_state_tiktok');
  });
  it('returns correct name for facebook', () => {
    expect(stateCookieName('facebook')).toBe('oauth_state_facebook');
  });
  it('returns correct name for canva', () => {
    expect(stateCookieName('canva')).toBe('oauth_state_canva');
  });
  it('handles arbitrary platform string', () => {
    expect(stateCookieName('anything')).toBe('oauth_state_anything');
  });
});

// ──────────────────────────────────────────────────────────
// generateCodeVerifier()
// ──────────────────────────────────────────────────────────
describe('generateCodeVerifier()', () => {
  it('returns a non-empty string', () => {
    expect(generateCodeVerifier().length).toBeGreaterThan(0);
  });

  it('produces URL-safe base64 (no +, /, = characters)', () => {
    expect(generateCodeVerifier()).not.toMatch(/[+/=]/);
  });

  it('generates unique values on each call', () => {
    const verifiers = new Set(Array.from({ length: 20 }, () => generateCodeVerifier()));
    expect(verifiers.size).toBe(20);
  });

  it('has expected length for 32 random bytes in base64url (~43 chars)', () => {
    // 32 bytes → ceil(32/3)*4 = 44 minus padding chars removed
    // base64url of 32 bytes = 43 chars (last group has 1 byte → 2 chars + 2 padding removed)
    expect(generateCodeVerifier().length).toBe(43);
  });
});

// ──────────────────────────────────────────────────────────
// codeChallengeFromVerifier()
// ──────────────────────────────────────────────────────────
describe('codeChallengeFromVerifier()', () => {
  it('returns a non-empty string', () => {
    const verifier = generateCodeVerifier();
    expect(codeChallengeFromVerifier(verifier).length).toBeGreaterThan(0);
  });

  it('produces URL-safe base64 (no +, /, = characters)', () => {
    const challenge = codeChallengeFromVerifier(generateCodeVerifier());
    expect(challenge).not.toMatch(/[+/=]/);
  });

  it('is deterministic for the same verifier', () => {
    const verifier = 'fixedTestVerifier';
    expect(codeChallengeFromVerifier(verifier)).toBe(codeChallengeFromVerifier(verifier));
  });

  it('matches manual SHA-256 computation', () => {
    const verifier = 'hello-world-verifier';
    const expected = createHash('sha256').update(verifier).digest('base64url');
    expect(codeChallengeFromVerifier(verifier)).toBe(expected);
  });

  it('produces different challenges for different verifiers', () => {
    expect(codeChallengeFromVerifier('aaa')).not.toBe(codeChallengeFromVerifier('bbb'));
  });

  it('challenge length is 43 chars (SHA-256 = 32 bytes in base64url)', () => {
    const challenge = codeChallengeFromVerifier(generateCodeVerifier());
    expect(challenge.length).toBe(43);
  });
});

// ──────────────────────────────────────────────────────────
// codeVerifierCookieName()
// ──────────────────────────────────────────────────────────
describe('codeVerifierCookieName()', () => {
  it('returns correct name for canva', () => {
    expect(codeVerifierCookieName('canva')).toBe('oauth_pkce_canva');
  });
  it('returns correct name for youtube', () => {
    expect(codeVerifierCookieName('youtube')).toBe('oauth_pkce_youtube');
  });
  it('handles arbitrary platform string', () => {
    expect(codeVerifierCookieName('anything')).toBe('oauth_pkce_anything');
  });
});
