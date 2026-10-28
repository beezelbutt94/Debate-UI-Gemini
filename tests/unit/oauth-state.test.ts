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

  it('produces a base64url-encoded value (no +/=)', () => {
    const state = generateState();
    expect(state).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  it('returns a unique value on each call', () => {
    const states = new Set(Array.from({ length: 20 }, () => generateState()));
    expect(states.size).toBe(20);
  });

  it('has sufficient length (24 random bytes → ~32 base64url chars)', () => {
    // 24 bytes → 32 base64url chars (no padding)
    expect(generateState().length).toBe(32);
  });
});

describe('stateCookieName()', () => {
  it('returns the correct cookie name for youtube', () => {
    expect(stateCookieName('youtube')).toBe('oauth_state_youtube');
  });

  it('returns the correct cookie name for tiktok', () => {
    expect(stateCookieName('tiktok')).toBe('oauth_state_tiktok');
  });

  it('returns the correct cookie name for facebook', () => {
    expect(stateCookieName('facebook')).toBe('oauth_state_facebook');
  });

  it('returns the correct cookie name for canva', () => {
    expect(stateCookieName('canva')).toBe('oauth_state_canva');
  });

  it('uses the platform name verbatim in the suffix', () => {
    expect(stateCookieName('any_platform')).toBe('oauth_state_any_platform');
  });
});

describe('generateCodeVerifier()', () => {
  it('returns a non-empty string', () => {
    expect(typeof generateCodeVerifier()).toBe('string');
    expect(generateCodeVerifier().length).toBeGreaterThan(0);
  });

  it('produces a base64url-encoded value (no +/=)', () => {
    const verifier = generateCodeVerifier();
    expect(verifier).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  it('has sufficient length (32 random bytes → ~43 base64url chars)', () => {
    // 32 bytes → 43 base64url chars (no padding)
    expect(generateCodeVerifier().length).toBe(43);
  });

  it('returns a unique value on each call', () => {
    const verifiers = new Set(Array.from({ length: 20 }, () => generateCodeVerifier()));
    expect(verifiers.size).toBe(20);
  });
});

describe('codeChallengeFromVerifier()', () => {
  it('returns a base64url-encoded string', () => {
    const challenge = codeChallengeFromVerifier('test-verifier');
    expect(challenge).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  it('matches the SHA-256 hash of the verifier in base64url', () => {
    const verifier = 'hello-world-verifier';
    const expected = createHash('sha256').update(verifier).digest('base64url');
    expect(codeChallengeFromVerifier(verifier)).toBe(expected);
  });

  it('is deterministic for the same input', () => {
    const v = 'stable-verifier';
    expect(codeChallengeFromVerifier(v)).toBe(codeChallengeFromVerifier(v));
  });

  it('produces different challenges for different verifiers', () => {
    const c1 = codeChallengeFromVerifier('verifier-one');
    const c2 = codeChallengeFromVerifier('verifier-two');
    expect(c1).not.toBe(c2);
  });

  it('produces a 43-char output for a SHA-256 hash (256 bits → 32 bytes → 43 base64url chars)', () => {
    expect(codeChallengeFromVerifier('any-input').length).toBe(43);
  });

  it('round-trips correctly: challenge derived from generateCodeVerifier() is valid base64url', () => {
    const verifier = generateCodeVerifier();
    const challenge = codeChallengeFromVerifier(verifier);
    expect(challenge).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(challenge.length).toBe(43);
  });
});

describe('codeVerifierCookieName()', () => {
  it('returns the correct cookie name for canva', () => {
    expect(codeVerifierCookieName('canva')).toBe('oauth_pkce_canva');
  });

  it('returns the correct cookie name for youtube', () => {
    expect(codeVerifierCookieName('youtube')).toBe('oauth_pkce_youtube');
  });

  it('uses the platform name verbatim in the suffix', () => {
    expect(codeVerifierCookieName('any_platform')).toBe('oauth_pkce_any_platform');
  });
});
