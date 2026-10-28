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

  it('is URL-safe base64 (no +, /, = chars)', () => {
    const state = generateState();
    expect(state).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  it('returns different values on consecutive calls (entropy)', () => {
    const results = new Set(Array.from({ length: 10 }, () => generateState()));
    expect(results.size).toBe(10);
  });

  it('has length consistent with 24 random bytes in base64url (~32 chars)', () => {
    // 24 bytes → 32 base64url chars (no padding)
    const state = generateState();
    expect(state.length).toBe(32);
  });
});

describe('stateCookieName', () => {
  it('returns expected format for youtube', () => {
    expect(stateCookieName('youtube')).toBe('oauth_state_youtube');
  });

  it('returns expected format for tiktok', () => {
    expect(stateCookieName('tiktok')).toBe('oauth_state_tiktok');
  });

  it('returns expected format for facebook', () => {
    expect(stateCookieName('facebook')).toBe('oauth_state_facebook');
  });

  it('returns expected format for canva', () => {
    expect(stateCookieName('canva')).toBe('oauth_state_canva');
  });

  it('handles arbitrary platform strings', () => {
    expect(stateCookieName('myplatform')).toBe('oauth_state_myplatform');
  });
});

describe('generateCodeVerifier', () => {
  it('returns a non-empty string', () => {
    expect(typeof generateCodeVerifier()).toBe('string');
    expect(generateCodeVerifier().length).toBeGreaterThan(0);
  });

  it('is URL-safe base64 (no +, /, = chars)', () => {
    const verifier = generateCodeVerifier();
    expect(verifier).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  it('returns different values on consecutive calls', () => {
    const results = new Set(Array.from({ length: 10 }, () => generateCodeVerifier()));
    expect(results.size).toBe(10);
  });

  it('has length consistent with 32 random bytes in base64url (~43 chars)', () => {
    // 32 bytes → 43 base64url chars (no padding)
    const verifier = generateCodeVerifier();
    expect(verifier.length).toBe(43);
  });
});

describe('codeChallengeFromVerifier', () => {
  it('returns a non-empty string', () => {
    const verifier = generateCodeVerifier();
    expect(typeof codeChallengeFromVerifier(verifier)).toBe('string');
  });

  it('is URL-safe base64', () => {
    const challenge = codeChallengeFromVerifier(generateCodeVerifier());
    expect(challenge).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  it('matches the RFC 7636 SHA-256 base64url of the verifier', () => {
    const verifier = generateCodeVerifier();
    const expected = createHash('sha256').update(verifier).digest('base64url');
    expect(codeChallengeFromVerifier(verifier)).toBe(expected);
  });

  it('is deterministic for the same verifier', () => {
    const verifier = 'static-test-verifier';
    expect(codeChallengeFromVerifier(verifier)).toBe(
      codeChallengeFromVerifier(verifier)
    );
  });

  it('produces different challenges for different verifiers', () => {
    const a = codeChallengeFromVerifier('verifier-a');
    const b = codeChallengeFromVerifier('verifier-b');
    expect(a).not.toBe(b);
  });

  it('SHA-256 of empty string is correct', () => {
    const expected = createHash('sha256').update('').digest('base64url');
    expect(codeChallengeFromVerifier('')).toBe(expected);
  });
});

describe('codeVerifierCookieName', () => {
  it('returns expected format for canva', () => {
    expect(codeVerifierCookieName('canva')).toBe('oauth_pkce_canva');
  });

  it('returns expected format for youtube', () => {
    expect(codeVerifierCookieName('youtube')).toBe('oauth_pkce_youtube');
  });

  it('returns expected format for tiktok', () => {
    expect(codeVerifierCookieName('tiktok')).toBe('oauth_pkce_tiktok');
  });

  it('handles arbitrary strings', () => {
    expect(codeVerifierCookieName('myplatform')).toBe('oauth_pkce_myplatform');
  });
});
