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
    expect(generateState()).toBeTruthy();
  });

  it('returns a base64url-safe string (no +, /, or =)', () => {
    for (let i = 0; i < 20; i++) {
      const state = generateState();
      expect(state).not.toMatch(/[+/=]/);
    }
  });

  it('generates 24 random bytes → 32 base64url chars', () => {
    // 24 bytes → ceil(24 * 4/3) = 32 chars in base64url (no padding)
    const state = generateState();
    expect(state.length).toBe(32);
  });

  it('produces different values on each call', () => {
    const states = new Set(Array.from({ length: 10 }, generateState));
    expect(states.size).toBe(10);
  });
});

describe('stateCookieName', () => {
  it('returns expected cookie name for youtube', () => {
    expect(stateCookieName('youtube')).toBe('oauth_state_youtube');
  });

  it('returns expected cookie name for tiktok', () => {
    expect(stateCookieName('tiktok')).toBe('oauth_state_tiktok');
  });

  it('returns expected cookie name for facebook', () => {
    expect(stateCookieName('facebook')).toBe('oauth_state_facebook');
  });

  it('returns expected cookie name for canva', () => {
    expect(stateCookieName('canva')).toBe('oauth_state_canva');
  });

  it('uses the platform name verbatim (no escaping)', () => {
    expect(stateCookieName('my-platform')).toBe('oauth_state_my-platform');
  });
});

describe('generateCodeVerifier', () => {
  it('returns a non-empty string', () => {
    expect(generateCodeVerifier()).toBeTruthy();
  });

  it('is base64url-safe (no +, /, or =)', () => {
    for (let i = 0; i < 20; i++) {
      const v = generateCodeVerifier();
      expect(v).not.toMatch(/[+/=]/);
    }
  });

  it('generates 32 random bytes → 43 base64url chars', () => {
    // 32 bytes → ceil(32 * 4/3) = 43 chars (base64url, no padding)
    const v = generateCodeVerifier();
    expect(v.length).toBe(43);
  });

  it('satisfies RFC 7636 minimum length (43+ chars)', () => {
    expect(generateCodeVerifier().length).toBeGreaterThanOrEqual(43);
  });

  it('produces different values on each call', () => {
    const verifiers = new Set(Array.from({ length: 10 }, generateCodeVerifier));
    expect(verifiers.size).toBe(10);
  });
});

describe('codeChallengeFromVerifier', () => {
  it('returns a base64url string', () => {
    const challenge = codeChallengeFromVerifier('someverifier');
    expect(challenge).not.toMatch(/[+/=]/);
  });

  it('produces the correct SHA-256 base64url digest', () => {
    const verifier = 'dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk';
    const expected = createHash('sha256').update(verifier).digest('base64url');
    expect(codeChallengeFromVerifier(verifier)).toBe(expected);
  });

  it('is deterministic for the same input', () => {
    const v = generateCodeVerifier();
    expect(codeChallengeFromVerifier(v)).toBe(codeChallengeFromVerifier(v));
  });

  it('produces different output for different verifiers', () => {
    const a = generateCodeVerifier();
    const b = generateCodeVerifier();
    expect(codeChallengeFromVerifier(a)).not.toBe(codeChallengeFromVerifier(b));
  });

  it('round-trips through a real PKCE flow (S256 standard)', () => {
    const verifier = generateCodeVerifier();
    const challenge = codeChallengeFromVerifier(verifier);
    const recomputed = createHash('sha256').update(verifier).digest('base64url');
    expect(challenge).toBe(recomputed);
  });

  it('produces 43-char output for typical verifier', () => {
    // SHA-256 = 32 bytes → 43 base64url chars (no padding)
    expect(codeChallengeFromVerifier('test').length).toBe(43);
  });
});

describe('codeVerifierCookieName', () => {
  it('returns expected cookie name for canva', () => {
    expect(codeVerifierCookieName('canva')).toBe('oauth_pkce_canva');
  });

  it('returns expected cookie name for youtube', () => {
    expect(codeVerifierCookieName('youtube')).toBe('oauth_pkce_youtube');
  });

  it('uses the platform name verbatim', () => {
    expect(codeVerifierCookieName('my-platform')).toBe('oauth_pkce_my-platform');
  });
});
