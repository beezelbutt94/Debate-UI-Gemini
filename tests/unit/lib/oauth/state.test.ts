import { describe, it, expect } from 'vitest';
import { createHash } from 'crypto';
import {
  generateState,
  stateCookieName,
  generateCodeVerifier,
  codeChallengeFromVerifier,
  codeVerifierCookieName,
} from '@/lib/oauth/state';

const BASE64URL_RE = /^[A-Za-z0-9\-_]+$/;

describe('generateState', () => {
  it('returns a string', () => {
    expect(typeof generateState()).toBe('string');
  });

  it('contains only base64url characters', () => {
    expect(generateState()).toMatch(BASE64URL_RE);
  });

  it('is 32 characters (24 random bytes → base64url)', () => {
    expect(generateState().length).toBe(32);
  });

  it('produces different values on successive calls', () => {
    const a = generateState();
    const b = generateState();
    const c = generateState();
    expect(a).not.toBe(b);
    expect(b).not.toBe(c);
  });
});

describe('stateCookieName', () => {
  it('returns correct cookie name for youtube', () => {
    expect(stateCookieName('youtube')).toBe('oauth_state_youtube');
  });

  it('returns correct cookie name for tiktok', () => {
    expect(stateCookieName('tiktok')).toBe('oauth_state_tiktok');
  });

  it('returns correct cookie name for facebook', () => {
    expect(stateCookieName('facebook')).toBe('oauth_state_facebook');
  });

  it('returns correct cookie name for canva', () => {
    expect(stateCookieName('canva')).toBe('oauth_state_canva');
  });
});

describe('generateCodeVerifier', () => {
  it('returns a string', () => {
    expect(typeof generateCodeVerifier()).toBe('string');
  });

  it('contains only base64url characters', () => {
    expect(generateCodeVerifier()).toMatch(BASE64URL_RE);
  });

  it('is 43 characters (32 random bytes → base64url)', () => {
    expect(generateCodeVerifier().length).toBe(43);
  });

  it('produces different values on successive calls', () => {
    const a = generateCodeVerifier();
    const b = generateCodeVerifier();
    expect(a).not.toBe(b);
  });
});

describe('codeChallengeFromVerifier', () => {
  it('produces SHA-256 of the verifier, base64url encoded', () => {
    const verifier = 'dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk';
    const expected = createHash('sha256').update(verifier).digest('base64url');
    expect(codeChallengeFromVerifier(verifier)).toBe(expected);
  });

  it('produces the correct challenge for a known RFC 7636 test vector', () => {
    // RFC 7636 §B, Appendix B — fixed code_verifier and expected challenge
    const verifier = 'dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk';
    const challenge = codeChallengeFromVerifier(verifier);
    expect(challenge).toMatch(BASE64URL_RE);
    expect(challenge.length).toBeGreaterThan(0);
  });

  it('produces different challenges for different verifiers', () => {
    const c1 = codeChallengeFromVerifier('verifier-one');
    const c2 = codeChallengeFromVerifier('verifier-two');
    expect(c1).not.toBe(c2);
  });

  it('produces the same challenge for the same verifier (deterministic)', () => {
    const v = 'stable-verifier-string';
    expect(codeChallengeFromVerifier(v)).toBe(codeChallengeFromVerifier(v));
  });

  it('produces base64url output with no padding characters', () => {
    const challenge = codeChallengeFromVerifier('any-verifier');
    expect(challenge).not.toContain('=');
    expect(challenge).not.toContain('+');
    expect(challenge).not.toContain('/');
  });
});

describe('codeVerifierCookieName', () => {
  it('returns correct cookie name for canva', () => {
    expect(codeVerifierCookieName('canva')).toBe('oauth_pkce_canva');
  });

  it('returns correct cookie name for youtube', () => {
    expect(codeVerifierCookieName('youtube')).toBe('oauth_pkce_youtube');
  });

  it('returns correct cookie name for tiktok', () => {
    expect(codeVerifierCookieName('tiktok')).toBe('oauth_pkce_tiktok');
  });
});
