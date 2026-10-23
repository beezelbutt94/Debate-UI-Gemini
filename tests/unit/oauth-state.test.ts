import { describe, it, expect } from 'vitest';
import { createHash } from 'crypto';
import {
  generateState,
  stateCookieName,
  generateCodeVerifier,
  codeChallengeFromVerifier,
  codeVerifierCookieName,
} from '@/lib/oauth/state';

// ─── generateState ────────────────────────────────────────────────────────────

describe('generateState', () => {
  it('returns a non-empty string', () => {
    expect(typeof generateState()).toBe('string');
    expect(generateState().length).toBeGreaterThan(0);
  });

  it('returns a base64url string (no +, /, or = characters)', () => {
    const state = generateState();
    expect(state).not.toMatch(/[+/=]/);
  });

  it('returns a string of the correct length (24 bytes => 32 base64url chars)', () => {
    // 24 bytes base64url-encoded: Math.ceil(24 * 4/3) = 32, no padding
    expect(generateState()).toHaveLength(32);
  });

  it('produces a different value on each call', () => {
    const states = new Set(Array.from({ length: 20 }, () => generateState()));
    expect(states.size).toBe(20);
  });

  it('contains only base64url-safe characters', () => {
    for (let i = 0; i < 50; i++) {
      expect(generateState()).toMatch(/^[A-Za-z0-9_-]+$/);
    }
  });
});

// ─── stateCookieName ─────────────────────────────────────────────────────────

describe('stateCookieName', () => {
  it('returns oauth_state_youtube for "youtube"', () => {
    expect(stateCookieName('youtube')).toBe('oauth_state_youtube');
  });

  it('returns oauth_state_tiktok for "tiktok"', () => {
    expect(stateCookieName('tiktok')).toBe('oauth_state_tiktok');
  });

  it('returns oauth_state_facebook for "facebook"', () => {
    expect(stateCookieName('facebook')).toBe('oauth_state_facebook');
  });

  it('returns oauth_state_canva for "canva"', () => {
    expect(stateCookieName('canva')).toBe('oauth_state_canva');
  });

  it('handles arbitrary platform string', () => {
    expect(stateCookieName('someplatform')).toBe('oauth_state_someplatform');
  });

  it('handles empty string platform', () => {
    expect(stateCookieName('')).toBe('oauth_state_');
  });
});

// ─── generateCodeVerifier ─────────────────────────────────────────────────────

describe('generateCodeVerifier', () => {
  it('returns a non-empty string', () => {
    expect(typeof generateCodeVerifier()).toBe('string');
    expect(generateCodeVerifier().length).toBeGreaterThan(0);
  });

  it('returns a base64url string (no +, /, or = characters)', () => {
    expect(generateCodeVerifier()).not.toMatch(/[+/=]/);
  });

  it('returns a string of the correct length (32 bytes => 43 base64url chars)', () => {
    // 32 bytes base64url-encoded: Math.ceil(32 * 4/3) = 43 chars (no padding)
    expect(generateCodeVerifier()).toHaveLength(43);
  });

  it('produces a different value on each call', () => {
    const verifiers = new Set(Array.from({ length: 20 }, () => generateCodeVerifier()));
    expect(verifiers.size).toBe(20);
  });

  it('contains only base64url-safe characters', () => {
    for (let i = 0; i < 50; i++) {
      expect(generateCodeVerifier()).toMatch(/^[A-Za-z0-9_-]+$/);
    }
  });
});

// ─── codeChallengeFromVerifier ────────────────────────────────────────────────

describe('codeChallengeFromVerifier', () => {
  it('returns a non-empty string', () => {
    expect(codeChallengeFromVerifier('test-verifier')).toBeTruthy();
  });

  it('produces a base64url-safe string', () => {
    const challenge = codeChallengeFromVerifier('test-verifier-abc');
    expect(challenge).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  it('matches expected SHA-256 base64url value', () => {
    const verifier = 'hello-world';
    const expected = createHash('sha256').update(verifier).digest('base64url');
    expect(codeChallengeFromVerifier(verifier)).toBe(expected);
  });

  it('is deterministic — same verifier always produces same challenge', () => {
    const v = 'consistent-verifier';
    expect(codeChallengeFromVerifier(v)).toBe(codeChallengeFromVerifier(v));
  });

  it('produces different challenges for different verifiers', () => {
    expect(codeChallengeFromVerifier('verifier-a')).not.toBe(codeChallengeFromVerifier('verifier-b'));
  });

  it('produces a 43-char output (SHA-256 = 32 bytes, base64url = 43 chars without padding)', () => {
    expect(codeChallengeFromVerifier('any-verifier')).toHaveLength(43);
  });

  it('handles long verifier input', () => {
    const longVerifier = 'a'.repeat(256);
    expect(codeChallengeFromVerifier(longVerifier)).toMatch(/^[A-Za-z0-9_-]{43}$/);
  });

  it('handles empty string verifier', () => {
    const challenge = codeChallengeFromVerifier('');
    expect(typeof challenge).toBe('string');
    expect(challenge.length).toBe(43);
  });

  it('works with a real generated code verifier (round-trip)', () => {
    const verifier = generateCodeVerifier();
    const challenge = codeChallengeFromVerifier(verifier);
    const expected = createHash('sha256').update(verifier).digest('base64url');
    expect(challenge).toBe(expected);
  });
});

// ─── codeVerifierCookieName ───────────────────────────────────────────────────

describe('codeVerifierCookieName', () => {
  it('returns oauth_pkce_youtube for "youtube"', () => {
    expect(codeVerifierCookieName('youtube')).toBe('oauth_pkce_youtube');
  });

  it('returns oauth_pkce_tiktok for "tiktok"', () => {
    expect(codeVerifierCookieName('tiktok')).toBe('oauth_pkce_tiktok');
  });

  it('returns oauth_pkce_facebook for "facebook"', () => {
    expect(codeVerifierCookieName('facebook')).toBe('oauth_pkce_facebook');
  });

  it('returns oauth_pkce_canva for "canva"', () => {
    expect(codeVerifierCookieName('canva')).toBe('oauth_pkce_canva');
  });

  it('handles arbitrary platform string', () => {
    expect(codeVerifierCookieName('someplatform')).toBe('oauth_pkce_someplatform');
  });

  it('handles empty string platform', () => {
    expect(codeVerifierCookieName('')).toBe('oauth_pkce_');
  });
});
