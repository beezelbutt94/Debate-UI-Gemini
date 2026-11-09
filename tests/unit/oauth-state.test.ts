import { describe, it, expect } from 'vitest';
import {
  generateState,
  stateCookieName,
  generateCodeVerifier,
  codeChallengeFromVerifier,
  codeVerifierCookieName,
} from '@/lib/oauth/state';
import { createHash } from 'crypto';

// ─── generateState ───────────────────────────────────────────────────────────

describe('generateState()', () => {
  it('returns a non-empty string', () => {
    expect(typeof generateState()).toBe('string');
    expect(generateState().length).toBeGreaterThan(0);
  });

  it('returns a base64url-safe string (no +, /, or = chars)', () => {
    for (let i = 0; i < 50; i++) {
      const s = generateState();
      expect(s).not.toMatch(/[+/=]/);
    }
  });

  it('produces a string of the expected length for 24 random bytes base64url encoded', () => {
    // 24 bytes → 32 base64url chars (ceil(24/3)*4 = 32)
    expect(generateState()).toHaveLength(32);
  });

  it('generates unique values on each call', () => {
    const values = new Set(Array.from({ length: 100 }, () => generateState()));
    expect(values.size).toBe(100);
  });
});

// ─── stateCookieName ─────────────────────────────────────────────────────────

describe('stateCookieName()', () => {
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

  it('uses the platform name verbatim in the cookie', () => {
    expect(stateCookieName('my-platform')).toBe('oauth_state_my-platform');
  });
});

// ─── generateCodeVerifier ────────────────────────────────────────────────────

describe('generateCodeVerifier()', () => {
  it('returns a non-empty string', () => {
    expect(generateCodeVerifier().length).toBeGreaterThan(0);
  });

  it('returns a base64url-safe string (no +, /, or = chars)', () => {
    for (let i = 0; i < 50; i++) {
      expect(generateCodeVerifier()).not.toMatch(/[+/=]/);
    }
  });

  it('produces a string of the expected length for 32 random bytes base64url encoded', () => {
    // 32 bytes → 43 base64url chars (ceil(32/3)*4=44, minus padding = 43)
    expect(generateCodeVerifier()).toHaveLength(43);
  });

  it('generates unique values on each call', () => {
    const values = new Set(Array.from({ length: 100 }, () => generateCodeVerifier()));
    expect(values.size).toBe(100);
  });
});

// ─── codeChallengeFromVerifier ───────────────────────────────────────────────

describe('codeChallengeFromVerifier()', () => {
  it('returns a non-empty string', () => {
    expect(codeChallengeFromVerifier('verifier123').length).toBeGreaterThan(0);
  });

  it('is deterministic: same verifier → same challenge', () => {
    expect(codeChallengeFromVerifier('abc')).toBe(codeChallengeFromVerifier('abc'));
  });

  it('produces different challenges for different verifiers', () => {
    expect(codeChallengeFromVerifier('aaa')).not.toBe(codeChallengeFromVerifier('bbb'));
  });

  it('matches the RFC 7636 S256 formula: BASE64URL(SHA256(verifier))', () => {
    const verifier = 'test-code-verifier-value';
    const expected = createHash('sha256').update(verifier).digest('base64url');
    expect(codeChallengeFromVerifier(verifier)).toBe(expected);
  });

  it('output is base64url-safe (no +, /, or = chars)', () => {
    for (let i = 0; i < 50; i++) {
      const challenge = codeChallengeFromVerifier(generateCodeVerifier());
      expect(challenge).not.toMatch(/[+/=]/);
    }
  });

  it('round-trips correctly with a real generated verifier', () => {
    const verifier = generateCodeVerifier();
    const challenge = codeChallengeFromVerifier(verifier);
    // Verify by re-computing
    const recomputed = createHash('sha256').update(verifier).digest('base64url');
    expect(challenge).toBe(recomputed);
  });
});

// ─── codeVerifierCookieName ──────────────────────────────────────────────────

describe('codeVerifierCookieName()', () => {
  it('returns expected cookie name for canva', () => {
    expect(codeVerifierCookieName('canva')).toBe('oauth_pkce_canva');
  });

  it('returns expected cookie name for youtube', () => {
    expect(codeVerifierCookieName('youtube')).toBe('oauth_pkce_youtube');
  });

  it('uses the platform name verbatim', () => {
    expect(codeVerifierCookieName('anything')).toBe('oauth_pkce_anything');
  });

  it('is different from the state cookie name for the same platform', () => {
    expect(codeVerifierCookieName('canva')).not.toBe(stateCookieName('canva'));
  });
});
