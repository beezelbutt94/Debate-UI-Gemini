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

  it('returns a base64url-safe string (no +, /, or = characters)', () => {
    const state = generateState();
    expect(state).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  it('returns different values on successive calls (non-deterministic)', () => {
    const states = new Set(Array.from({ length: 20 }, generateState));
    expect(states.size).toBe(20);
  });

  it('has sufficient entropy (at least 30 chars from 24 random bytes → ~32 base64url chars)', () => {
    expect(generateState().length).toBeGreaterThanOrEqual(30);
  });
});

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

  it('uses the platform arg verbatim as a suffix', () => {
    expect(stateCookieName('arbitrary_platform')).toBe('oauth_state_arbitrary_platform');
  });
});

describe('generateCodeVerifier()', () => {
  it('returns a non-empty string', () => {
    expect(typeof generateCodeVerifier()).toBe('string');
    expect(generateCodeVerifier().length).toBeGreaterThan(0);
  });

  it('returns a base64url-safe string', () => {
    const verifier = generateCodeVerifier();
    expect(verifier).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  it('has at least 43 chars (RFC 7636 minimum for S256 with 32 random bytes)', () => {
    expect(generateCodeVerifier().length).toBeGreaterThanOrEqual(43);
  });

  it('returns different values on successive calls', () => {
    const verifiers = new Set(Array.from({ length: 20 }, generateCodeVerifier));
    expect(verifiers.size).toBe(20);
  });
});

describe('codeChallengeFromVerifier()', () => {
  it('returns a base64url-encoded SHA-256 of the verifier', () => {
    const verifier = 'test-verifier-value';
    const expected = createHash('sha256').update(verifier).digest('base64url');
    expect(codeChallengeFromVerifier(verifier)).toBe(expected);
  });

  it('is deterministic — same verifier always produces the same challenge', () => {
    const verifier = generateCodeVerifier();
    expect(codeChallengeFromVerifier(verifier)).toBe(codeChallengeFromVerifier(verifier));
  });

  it('different verifiers produce different challenges', () => {
    const v1 = generateCodeVerifier();
    const v2 = generateCodeVerifier();
    expect(codeChallengeFromVerifier(v1)).not.toBe(codeChallengeFromVerifier(v2));
  });

  it('result is base64url-safe (no +, /, or =)', () => {
    const challenge = codeChallengeFromVerifier(generateCodeVerifier());
    expect(challenge).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  it('known test vector: RFC 7636 §B example', () => {
    // verifier: dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk
    // challenge: E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM (base64url of sha256)
    const challenge = codeChallengeFromVerifier('dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk');
    expect(challenge).toBe('E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM');
  });
});

describe('codeVerifierCookieName()', () => {
  it('returns correct name for canva', () => {
    expect(codeVerifierCookieName('canva')).toBe('oauth_pkce_canva');
  });

  it('returns correct name for any platform string', () => {
    expect(codeVerifierCookieName('youtube')).toBe('oauth_pkce_youtube');
    expect(codeVerifierCookieName('tiktok')).toBe('oauth_pkce_tiktok');
  });

  it('uses the platform arg verbatim as a suffix', () => {
    expect(codeVerifierCookieName('my_platform')).toBe('oauth_pkce_my_platform');
  });
});
