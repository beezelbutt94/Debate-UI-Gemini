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

  it('returns a base64url-safe string (no +, /, = chars)', () => {
    for (let i = 0; i < 20; i++) {
      const state = generateState();
      expect(state).not.toMatch(/[+/=]/);
    }
  });

  it('returns different values on each call', () => {
    const a = generateState();
    const b = generateState();
    expect(a).not.toBe(b);
  });

  it('has expected length for 24 random bytes in base64url (32 chars)', () => {
    // 24 bytes → base64url → 32 characters
    const state = generateState();
    expect(state.length).toBe(32);
  });
});

describe('stateCookieName', () => {
  it('builds correct cookie name for youtube', () => {
    expect(stateCookieName('youtube')).toBe('oauth_state_youtube');
  });

  it('builds correct cookie name for tiktok', () => {
    expect(stateCookieName('tiktok')).toBe('oauth_state_tiktok');
  });

  it('builds correct cookie name for facebook', () => {
    expect(stateCookieName('facebook')).toBe('oauth_state_facebook');
  });

  it('builds correct cookie name for canva', () => {
    expect(stateCookieName('canva')).toBe('oauth_state_canva');
  });

  it('is deterministic — same input same output', () => {
    expect(stateCookieName('foo')).toBe(stateCookieName('foo'));
  });
});

describe('generateCodeVerifier', () => {
  it('returns a non-empty string', () => {
    const v = generateCodeVerifier();
    expect(typeof v).toBe('string');
    expect(v.length).toBeGreaterThan(0);
  });

  it('returns a base64url-safe string (no +, /, = chars)', () => {
    for (let i = 0; i < 20; i++) {
      const v = generateCodeVerifier();
      expect(v).not.toMatch(/[+/=]/);
    }
  });

  it('returns different values on each call', () => {
    const a = generateCodeVerifier();
    const b = generateCodeVerifier();
    expect(a).not.toBe(b);
  });

  it('has expected length for 32 random bytes in base64url (43 chars)', () => {
    // 32 bytes → base64url → 43 characters
    const v = generateCodeVerifier();
    expect(v.length).toBe(43);
  });
});

describe('codeChallengeFromVerifier', () => {
  it('returns a non-empty string', () => {
    const challenge = codeChallengeFromVerifier('some-verifier');
    expect(typeof challenge).toBe('string');
    expect(challenge.length).toBeGreaterThan(0);
  });

  it('matches manual SHA-256 base64url calculation', () => {
    const verifier = 'test-verifier-string';
    const expected = createHash('sha256').update(verifier).digest('base64url');
    expect(codeChallengeFromVerifier(verifier)).toBe(expected);
  });

  it('returns base64url-safe output (no +, /, = chars)', () => {
    for (let i = 0; i < 20; i++) {
      const v = generateCodeVerifier();
      const c = codeChallengeFromVerifier(v);
      expect(c).not.toMatch(/[+/=]/);
    }
  });

  it('is deterministic for the same verifier', () => {
    const v = 'static-verifier';
    expect(codeChallengeFromVerifier(v)).toBe(codeChallengeFromVerifier(v));
  });

  it('produces different challenges for different verifiers', () => {
    const c1 = codeChallengeFromVerifier('verifier-A');
    const c2 = codeChallengeFromVerifier('verifier-B');
    expect(c1).not.toBe(c2);
  });

  it('challenge is 43 chars (SHA-256 → 32 bytes → base64url)', () => {
    const challenge = codeChallengeFromVerifier(generateCodeVerifier());
    expect(challenge.length).toBe(43);
  });
});

describe('codeVerifierCookieName', () => {
  it('builds correct cookie name for canva', () => {
    expect(codeVerifierCookieName('canva')).toBe('oauth_pkce_canva');
  });

  it('builds correct cookie name for youtube', () => {
    expect(codeVerifierCookieName('youtube')).toBe('oauth_pkce_youtube');
  });

  it('is deterministic', () => {
    expect(codeVerifierCookieName('tiktok')).toBe(codeVerifierCookieName('tiktok'));
  });
});
