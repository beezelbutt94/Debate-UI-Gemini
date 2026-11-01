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
    expect(generateState().length).toBeGreaterThan(0);
  });

  it('is base64url safe (no +, /, or = characters)', () => {
    for (let i = 0; i < 20; i++) {
      const state = generateState();
      expect(state).not.toMatch(/[+/=]/);
    }
  });

  it('returns different values each call', () => {
    const a = generateState();
    const b = generateState();
    expect(a).not.toBe(b);
  });

  it('has length consistent with 24 random bytes base64url encoded (~32 chars)', () => {
    const state = generateState();
    // 24 bytes * 4/3 = 32 chars (base64url, no padding)
    expect(state.length).toBeGreaterThanOrEqual(30);
    expect(state.length).toBeLessThanOrEqual(36);
  });

  it('is URL-safe (can be used as a query param without encoding)', () => {
    for (let i = 0; i < 10; i++) {
      const state = generateState();
      expect(encodeURIComponent(state)).toBe(state);
    }
  });
});

describe('stateCookieName', () => {
  it('returns the correct format for youtube', () => {
    expect(stateCookieName('youtube')).toBe('oauth_state_youtube');
  });

  it('returns the correct format for tiktok', () => {
    expect(stateCookieName('tiktok')).toBe('oauth_state_tiktok');
  });

  it('returns the correct format for facebook', () => {
    expect(stateCookieName('facebook')).toBe('oauth_state_facebook');
  });

  it('returns the correct format for canva', () => {
    expect(stateCookieName('canva')).toBe('oauth_state_canva');
  });

  it('starts with oauth_state_ prefix', () => {
    expect(stateCookieName('any_platform')).toMatch(/^oauth_state_/);
  });

  it('includes the platform name verbatim', () => {
    expect(stateCookieName('my-platform')).toBe('oauth_state_my-platform');
  });
});

describe('generateCodeVerifier', () => {
  it('returns a non-empty string', () => {
    expect(generateCodeVerifier().length).toBeGreaterThan(0);
  });

  it('is base64url safe (no +, /, or = characters)', () => {
    for (let i = 0; i < 20; i++) {
      const v = generateCodeVerifier();
      expect(v).not.toMatch(/[+/=]/);
    }
  });

  it('returns different values each call', () => {
    const a = generateCodeVerifier();
    const b = generateCodeVerifier();
    expect(a).not.toBe(b);
  });

  it('has length consistent with 32 random bytes base64url (~43 chars)', () => {
    const v = generateCodeVerifier();
    // 32 bytes → ~43 chars base64url (no padding)
    expect(v.length).toBeGreaterThanOrEqual(40);
    expect(v.length).toBeLessThanOrEqual(48);
  });

  it('is URL-safe', () => {
    for (let i = 0; i < 10; i++) {
      const v = generateCodeVerifier();
      expect(encodeURIComponent(v)).toBe(v);
    }
  });
});

describe('codeChallengeFromVerifier', () => {
  it('returns a non-empty string', () => {
    expect(codeChallengeFromVerifier('abc').length).toBeGreaterThan(0);
  });

  it('is base64url safe', () => {
    for (let i = 0; i < 5; i++) {
      const verifier = generateCodeVerifier();
      const challenge = codeChallengeFromVerifier(verifier);
      expect(challenge).not.toMatch(/[+/=]/);
    }
  });

  it('matches the RFC 7636 S256 calculation independently', () => {
    const verifier = 'dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk';
    const expected = createHash('sha256').update(verifier).digest('base64url');
    expect(codeChallengeFromVerifier(verifier)).toBe(expected);
  });

  it('is deterministic — same verifier always produces same challenge', () => {
    const verifier = 'some-fixed-verifier-value';
    expect(codeChallengeFromVerifier(verifier)).toBe(codeChallengeFromVerifier(verifier));
  });

  it('produces different challenges for different verifiers', () => {
    expect(codeChallengeFromVerifier('verifier1')).not.toBe(codeChallengeFromVerifier('verifier2'));
  });

  it('challenge is ~43 chars (SHA-256 = 32 bytes → 43 base64url chars)', () => {
    const verifier = generateCodeVerifier();
    const challenge = codeChallengeFromVerifier(verifier);
    expect(challenge.length).toBe(43);
  });
});

describe('codeVerifierCookieName', () => {
  it('returns the correct format for canva', () => {
    expect(codeVerifierCookieName('canva')).toBe('oauth_pkce_canva');
  });

  it('starts with oauth_pkce_ prefix', () => {
    expect(codeVerifierCookieName('youtube')).toMatch(/^oauth_pkce_/);
  });

  it('includes the platform name verbatim', () => {
    expect(codeVerifierCookieName('my-platform')).toBe('oauth_pkce_my-platform');
  });

  it('returns different names for different platforms', () => {
    expect(codeVerifierCookieName('canva')).not.toBe(codeVerifierCookieName('youtube'));
  });
});
