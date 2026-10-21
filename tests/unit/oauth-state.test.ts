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
    expect(generateState()).toBeTruthy();
  });

  it('returns a base64url string (no +, /, or = characters)', () => {
    const state = generateState();
    expect(state).not.toMatch(/[+/=]/);
  });

  it('returns a string of expected length for 24 bytes in base64url (~32 chars)', () => {
    const state = generateState();
    // 24 bytes → 32 base64url chars
    expect(state.length).toBe(32);
  });

  it('returns different values on each call', () => {
    const a = generateState();
    const b = generateState();
    expect(a).not.toBe(b);
  });
});

describe('stateCookieName()', () => {
  it('returns the expected pattern', () => {
    expect(stateCookieName('youtube')).toBe('oauth_state_youtube');
  });

  it('works for any platform string', () => {
    expect(stateCookieName('tiktok')).toBe('oauth_state_tiktok');
    expect(stateCookieName('facebook')).toBe('oauth_state_facebook');
    expect(stateCookieName('canva')).toBe('oauth_state_canva');
  });
});

describe('generateCodeVerifier()', () => {
  it('returns a non-empty string', () => {
    expect(generateCodeVerifier()).toBeTruthy();
  });

  it('returns a base64url string (no +, /, or = characters)', () => {
    const verifier = generateCodeVerifier();
    expect(verifier).not.toMatch(/[+/=]/);
  });

  it('returns a string of expected length for 32 bytes in base64url (~43 chars)', () => {
    const verifier = generateCodeVerifier();
    // 32 bytes → 43 base64url chars
    expect(verifier.length).toBe(43);
  });

  it('returns different values on each call', () => {
    const a = generateCodeVerifier();
    const b = generateCodeVerifier();
    expect(a).not.toBe(b);
  });
});

describe('codeChallengeFromVerifier()', () => {
  it('returns the SHA-256 base64url hash of the verifier', () => {
    const verifier = 'abc123';
    const expected = createHash('sha256').update(verifier).digest('base64url');
    expect(codeChallengeFromVerifier(verifier)).toBe(expected);
  });

  it('is deterministic for the same input', () => {
    const verifier = 'my-test-verifier';
    expect(codeChallengeFromVerifier(verifier)).toBe(codeChallengeFromVerifier(verifier));
  });

  it('produces different hashes for different verifiers', () => {
    expect(codeChallengeFromVerifier('verifier-a')).not.toBe(codeChallengeFromVerifier('verifier-b'));
  });

  it('returns a base64url string (no +, /, or = characters)', () => {
    const challenge = codeChallengeFromVerifier(generateCodeVerifier());
    expect(challenge).not.toMatch(/[+/=]/);
  });

  it('round-trips correctly from a real generated verifier', () => {
    const verifier = generateCodeVerifier();
    const challenge = codeChallengeFromVerifier(verifier);
    const expected = createHash('sha256').update(verifier).digest('base64url');
    expect(challenge).toBe(expected);
  });
});

describe('codeVerifierCookieName()', () => {
  it('returns the expected pattern', () => {
    expect(codeVerifierCookieName('canva')).toBe('oauth_pkce_canva');
  });

  it('works for any platform string', () => {
    expect(codeVerifierCookieName('youtube')).toBe('oauth_pkce_youtube');
    expect(codeVerifierCookieName('tiktok')).toBe('oauth_pkce_tiktok');
  });
});
