import { describe, it, expect } from 'vitest';
import { createHash } from 'crypto';
import {
  generateState,
  stateCookieName,
  generateCodeVerifier,
  codeChallengeFromVerifier,
  codeVerifierCookieName,
} from '@/lib/oauth/state';

describe('generateState', () => {
  it('returns a non-empty string', () => {
    expect(typeof generateState()).toBe('string');
    expect(generateState().length).toBeGreaterThan(0);
  });

  it('produces a URL-safe base64url string (no +, /, =)', () => {
    for (let i = 0; i < 20; i++) {
      const state = generateState();
      expect(state).not.toMatch(/[+/=]/);
    }
  });

  it('produces unique values across calls', () => {
    const values = new Set(Array.from({ length: 100 }, () => generateState()));
    expect(values.size).toBe(100);
  });

  it('is at least 32 characters long (24 bytes base64url)', () => {
    expect(generateState().length).toBeGreaterThanOrEqual(32);
  });
});

describe('stateCookieName', () => {
  it('returns expected prefix + platform', () => {
    expect(stateCookieName('youtube')).toBe('oauth_state_youtube');
  });

  it('works for all supported platforms', () => {
    expect(stateCookieName('tiktok')).toBe('oauth_state_tiktok');
    expect(stateCookieName('facebook')).toBe('oauth_state_facebook');
    expect(stateCookieName('canva')).toBe('oauth_state_canva');
  });

  it('is deterministic for the same platform', () => {
    expect(stateCookieName('youtube')).toBe(stateCookieName('youtube'));
  });

  it('handles arbitrary platform strings without throwing', () => {
    expect(stateCookieName('unknown')).toBe('oauth_state_unknown');
  });
});

describe('generateCodeVerifier', () => {
  it('returns a non-empty string', () => {
    expect(generateCodeVerifier().length).toBeGreaterThan(0);
  });

  it('is URL-safe base64url (no +, /, =)', () => {
    for (let i = 0; i < 20; i++) {
      expect(generateCodeVerifier()).not.toMatch(/[+/=]/);
    }
  });

  it('produces unique values', () => {
    const values = new Set(Array.from({ length: 100 }, () => generateCodeVerifier()));
    expect(values.size).toBe(100);
  });

  it('is at least 43 characters (32 bytes base64url min per RFC 7636)', () => {
    expect(generateCodeVerifier().length).toBeGreaterThanOrEqual(43);
  });
});

describe('codeChallengeFromVerifier', () => {
  it('returns a non-empty string', () => {
    expect(codeChallengeFromVerifier('someVerifier').length).toBeGreaterThan(0);
  });

  it('is URL-safe base64url (no +, /, =)', () => {
    for (let i = 0; i < 20; i++) {
      const verifier = generateCodeVerifier();
      expect(codeChallengeFromVerifier(verifier)).not.toMatch(/[+/=]/);
    }
  });

  it('is deterministic: same verifier → same challenge', () => {
    const v = generateCodeVerifier();
    expect(codeChallengeFromVerifier(v)).toBe(codeChallengeFromVerifier(v));
  });

  it('matches RFC 7636 S256 derivation: base64url(sha256(verifier))', () => {
    const verifier = 'test-verifier-string-for-pkce';
    const expected = createHash('sha256').update(verifier).digest('base64url');
    expect(codeChallengeFromVerifier(verifier)).toBe(expected);
  });

  it('produces different challenges for different verifiers', () => {
    const a = codeChallengeFromVerifier('verifier-a');
    const b = codeChallengeFromVerifier('verifier-b');
    expect(a).not.toBe(b);
  });

  it('round-trips with generateCodeVerifier without collision', () => {
    const challenges = new Set(
      Array.from({ length: 50 }, () => codeChallengeFromVerifier(generateCodeVerifier()))
    );
    expect(challenges.size).toBe(50);
  });
});

describe('codeVerifierCookieName', () => {
  it('returns expected prefix + platform', () => {
    expect(codeVerifierCookieName('canva')).toBe('oauth_pkce_canva');
  });

  it('works for all supported platforms', () => {
    expect(codeVerifierCookieName('youtube')).toBe('oauth_pkce_youtube');
    expect(codeVerifierCookieName('tiktok')).toBe('oauth_pkce_tiktok');
    expect(codeVerifierCookieName('facebook')).toBe('oauth_pkce_facebook');
  });

  it('is deterministic', () => {
    expect(codeVerifierCookieName('canva')).toBe(codeVerifierCookieName('canva'));
  });
});
