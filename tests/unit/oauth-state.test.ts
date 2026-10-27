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

  it('is base64url safe (no +, /, =)', () => {
    for (let i = 0; i < 20; i++) {
      const s = generateState();
      expect(s).not.toMatch(/[+/=]/);
    }
  });

  it('is sufficiently long for CSRF protection (>= 24 chars)', () => {
    // 24 random bytes → 32 base64url chars
    expect(generateState().length).toBeGreaterThanOrEqual(24);
  });

  it('generates unique values each call', () => {
    const states = new Set(Array.from({ length: 50 }, () => generateState()));
    expect(states.size).toBe(50);
  });
});

describe('stateCookieName', () => {
  it('returns oauth_state_ prefixed name', () => {
    expect(stateCookieName('tiktok')).toBe('oauth_state_tiktok');
  });

  it('works for all platforms', () => {
    expect(stateCookieName('youtube')).toBe('oauth_state_youtube');
    expect(stateCookieName('facebook')).toBe('oauth_state_facebook');
    expect(stateCookieName('canva')).toBe('oauth_state_canva');
  });

  it('is deterministic', () => {
    expect(stateCookieName('tiktok')).toBe(stateCookieName('tiktok'));
  });
});

describe('generateCodeVerifier', () => {
  it('returns a non-empty string', () => {
    expect(typeof generateCodeVerifier()).toBe('string');
    expect(generateCodeVerifier().length).toBeGreaterThan(0);
  });

  it('is base64url safe (no +, /, =)', () => {
    for (let i = 0; i < 20; i++) {
      const v = generateCodeVerifier();
      expect(v).not.toMatch(/[+/=]/);
    }
  });

  it('is sufficiently long (>= 43 chars per RFC 7636)', () => {
    // 32 random bytes → 43 base64url chars
    expect(generateCodeVerifier().length).toBeGreaterThanOrEqual(43);
  });

  it('generates unique values each call', () => {
    const verifiers = new Set(Array.from({ length: 50 }, () => generateCodeVerifier()));
    expect(verifiers.size).toBe(50);
  });
});

describe('codeChallengeFromVerifier', () => {
  it('returns a base64url string', () => {
    const challenge = codeChallengeFromVerifier('testverifier');
    expect(challenge).not.toMatch(/[+/=]/);
    expect(challenge.length).toBeGreaterThan(0);
  });

  it('produces expected SHA-256 base64url for known input', () => {
    const verifier = 'dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk';
    const expected = createHash('sha256').update(verifier).digest('base64url');
    expect(codeChallengeFromVerifier(verifier)).toBe(expected);
  });

  it('is deterministic (same verifier → same challenge)', () => {
    const v = generateCodeVerifier();
    expect(codeChallengeFromVerifier(v)).toBe(codeChallengeFromVerifier(v));
  });

  it('different verifiers produce different challenges', () => {
    const v1 = generateCodeVerifier();
    const v2 = generateCodeVerifier();
    expect(codeChallengeFromVerifier(v1)).not.toBe(codeChallengeFromVerifier(v2));
  });

  it('challenge is 43 chars long (SHA-256 → 32 bytes → base64url)', () => {
    // base64url of 32 bytes = 43 chars (no padding)
    expect(codeChallengeFromVerifier('anything').length).toBe(43);
  });
});

describe('codeVerifierCookieName', () => {
  it('returns oauth_pkce_ prefixed name', () => {
    expect(codeVerifierCookieName('canva')).toBe('oauth_pkce_canva');
  });

  it('works for all platforms', () => {
    expect(codeVerifierCookieName('youtube')).toBe('oauth_pkce_youtube');
    expect(codeVerifierCookieName('tiktok')).toBe('oauth_pkce_tiktok');
    expect(codeVerifierCookieName('facebook')).toBe('oauth_pkce_facebook');
  });

  it('is deterministic', () => {
    expect(codeVerifierCookieName('canva')).toBe(codeVerifierCookieName('canva'));
  });
});
