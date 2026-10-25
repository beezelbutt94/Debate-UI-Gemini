import { describe, it, expect } from 'vitest';
import {
  generateState,
  stateCookieName,
  generateCodeVerifier,
  codeChallengeFromVerifier,
  codeVerifierCookieName,
} from '@/lib/oauth/state';

// ─── generateState ────────────────────────────────────────────────────────────

describe('generateState()', () => {
  it('returns a non-empty string', () => {
    expect(generateState()).toBeTruthy();
  });

  it('produces a base64url string (no +, /, or = characters)', () => {
    const state = generateState();
    expect(state).not.toMatch(/[+/=]/);
  });

  it('is derived from 24 random bytes, so base64url length is 32', () => {
    // 24 bytes → ceil(24 / 3) * 4 = 32 chars in base64url (no padding)
    expect(generateState()).toHaveLength(32);
  });

  it('produces unique values on each call', () => {
    const states = new Set(Array.from({ length: 100 }, () => generateState()));
    expect(states.size).toBe(100);
  });
});

// ─── stateCookieName ──────────────────────────────────────────────────────────

describe('stateCookieName()', () => {
  it('returns the expected cookie name for youtube', () => {
    expect(stateCookieName('youtube')).toBe('oauth_state_youtube');
  });

  it('returns the expected cookie name for tiktok', () => {
    expect(stateCookieName('tiktok')).toBe('oauth_state_tiktok');
  });

  it('returns the expected cookie name for facebook', () => {
    expect(stateCookieName('facebook')).toBe('oauth_state_facebook');
  });

  it('returns the expected cookie name for canva', () => {
    expect(stateCookieName('canva')).toBe('oauth_state_canva');
  });

  it('prefixes with oauth_state_', () => {
    expect(stateCookieName('custom')).toMatch(/^oauth_state_/);
  });

  it('appends the platform name literally', () => {
    const platform = 'my-platform';
    expect(stateCookieName(platform)).toBe(`oauth_state_${platform}`);
  });
});

// ─── generateCodeVerifier ────────────────────────────────────────────────────

describe('generateCodeVerifier()', () => {
  it('returns a non-empty string', () => {
    expect(generateCodeVerifier()).toBeTruthy();
  });

  it('produces a base64url string (no +, /, or = characters)', () => {
    const verifier = generateCodeVerifier();
    expect(verifier).not.toMatch(/[+/=]/);
  });

  it('is derived from 32 bytes, so base64url length is 43', () => {
    // 32 bytes → ceil(32/3)*4 with padding removed = 43 chars
    expect(generateCodeVerifier()).toHaveLength(43);
  });

  it('produces unique values on each call', () => {
    const verifiers = new Set(Array.from({ length: 100 }, () => generateCodeVerifier()));
    expect(verifiers.size).toBe(100);
  });
});

// ─── codeChallengeFromVerifier ───────────────────────────────────────────────

describe('codeChallengeFromVerifier()', () => {
  it('returns a non-empty string', () => {
    expect(codeChallengeFromVerifier('abc123')).toBeTruthy();
  });

  it('is a base64url string (no +, /, or = characters)', () => {
    const challenge = codeChallengeFromVerifier('some-verifier');
    expect(challenge).not.toMatch(/[+/=]/);
  });

  it('is a SHA-256 digest — always 43 chars in base64url', () => {
    // SHA-256 = 32 bytes → 43 chars base64url (no padding)
    expect(codeChallengeFromVerifier('any-verifier')).toHaveLength(43);
  });

  it('produces consistent output for the same verifier', () => {
    const verifier = 'deterministic-test-verifier';
    expect(codeChallengeFromVerifier(verifier)).toBe(codeChallengeFromVerifier(verifier));
  });

  it('produces different challenges for different verifiers', () => {
    expect(codeChallengeFromVerifier('verifier-a')).not.toBe(
      codeChallengeFromVerifier('verifier-b')
    );
  });

  it('matches a known SHA-256 digest (RFC 7636 test vector)', () => {
    // PKCE RFC test vector:
    // verifier = "dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk"
    // challenge = "E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM"
    const verifier = 'dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk';
    const expected = 'E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM';
    expect(codeChallengeFromVerifier(verifier)).toBe(expected);
  });

  it('handles empty string verifier without throwing', () => {
    expect(() => codeChallengeFromVerifier('')).not.toThrow();
  });

  it('produces a valid 43-char base64url for empty verifier', () => {
    expect(codeChallengeFromVerifier('')).toHaveLength(43);
  });

  it('handles unicode verifier string without throwing', () => {
    expect(() => codeChallengeFromVerifier('こんにちは')).not.toThrow();
  });

  it('handles very long verifier strings', () => {
    const long = 'x'.repeat(1000);
    expect(codeChallengeFromVerifier(long)).toHaveLength(43);
  });
});

// ─── codeVerifierCookieName ───────────────────────────────────────────────────

describe('codeVerifierCookieName()', () => {
  it('returns the expected cookie name for canva', () => {
    expect(codeVerifierCookieName('canva')).toBe('oauth_pkce_canva');
  });

  it('returns the expected cookie name for youtube', () => {
    expect(codeVerifierCookieName('youtube')).toBe('oauth_pkce_youtube');
  });

  it('prefixes with oauth_pkce_', () => {
    expect(codeVerifierCookieName('any')).toMatch(/^oauth_pkce_/);
  });

  it('appends the platform name literally', () => {
    const platform = 'my-service';
    expect(codeVerifierCookieName(platform)).toBe(`oauth_pkce_${platform}`);
  });

  it('is distinct from stateCookieName for the same platform', () => {
    expect(codeVerifierCookieName('canva')).not.toBe(stateCookieName('canva'));
  });
});
