import { describe, it, expect } from 'vitest';
import {
  generateState,
  stateCookieName,
  generateCodeVerifier,
  codeChallengeFromVerifier,
  codeVerifierCookieName,
} from '@/lib/oauth/state';
import { createHash } from 'crypto';

describe('generateState()', () => {
  it('returns a non-empty string', () => {
    expect(generateState().length).toBeGreaterThan(0);
  });

  it('produces URL-safe base64 (no +, /, =)', () => {
    for (let i = 0; i < 20; i++) {
      const s = generateState();
      expect(s).not.toMatch(/[+/=]/);
    }
  });

  it('produces unique values across calls', () => {
    const values = new Set(Array.from({ length: 100 }, generateState));
    expect(values.size).toBe(100);
  });

  it('produces 32-char base64url from 24 random bytes', () => {
    // 24 bytes → 32 base64url chars
    expect(generateState().length).toBe(32);
  });
});

describe('stateCookieName()', () => {
  it('prefixes the platform with oauth_state_', () => {
    expect(stateCookieName('youtube')).toBe('oauth_state_youtube');
  });

  it('works for every platform', () => {
    for (const platform of ['youtube', 'tiktok', 'facebook', 'canva']) {
      expect(stateCookieName(platform)).toBe(`oauth_state_${platform}`);
    }
  });
});

describe('generateCodeVerifier()', () => {
  it('returns a URL-safe base64 string with no padding', () => {
    for (let i = 0; i < 10; i++) {
      expect(generateCodeVerifier()).not.toMatch(/[+/=]/);
    }
  });

  it('produces unique values', () => {
    const values = new Set(Array.from({ length: 50 }, generateCodeVerifier));
    expect(values.size).toBe(50);
  });

  it('produces 43-char base64url from 32 random bytes', () => {
    // 32 bytes → 43 base64url chars (no padding)
    expect(generateCodeVerifier().length).toBe(43);
  });
});

describe('codeChallengeFromVerifier()', () => {
  it('returns SHA-256 base64url of the verifier', () => {
    const verifier = 'test-verifier-string';
    const expected = createHash('sha256').update(verifier).digest('base64url');
    expect(codeChallengeFromVerifier(verifier)).toBe(expected);
  });

  it('is deterministic — same input → same output', () => {
    const verifier = generateCodeVerifier();
    expect(codeChallengeFromVerifier(verifier)).toBe(codeChallengeFromVerifier(verifier));
  });

  it('produces URL-safe output with no + / =', () => {
    for (let i = 0; i < 20; i++) {
      const challenge = codeChallengeFromVerifier(generateCodeVerifier());
      expect(challenge).not.toMatch(/[+/=]/);
    }
  });

  it('produces 43-char SHA-256 base64url (256 bits = 32 bytes)', () => {
    expect(codeChallengeFromVerifier('anything').length).toBe(43);
  });

  it('different verifiers produce different challenges', () => {
    const a = codeChallengeFromVerifier('aaa');
    const b = codeChallengeFromVerifier('bbb');
    expect(a).not.toBe(b);
  });
});

describe('codeVerifierCookieName()', () => {
  it('prefixes the platform with oauth_pkce_', () => {
    expect(codeVerifierCookieName('canva')).toBe('oauth_pkce_canva');
  });

  it('works for all platforms', () => {
    for (const platform of ['youtube', 'tiktok', 'facebook', 'canva']) {
      expect(codeVerifierCookieName(platform)).toBe(`oauth_pkce_${platform}`);
    }
  });
});
