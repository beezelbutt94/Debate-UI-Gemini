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

  it('returns a base64url string (no +, /, or = padding)', () => {
    const state = generateState();
    expect(state).toMatch(/^[A-Za-z0-9\-_]+$/);
  });

  it('produces different values on successive calls', () => {
    const a = generateState();
    const b = generateState();
    expect(a).not.toBe(b);
  });

  it('is at least 32 characters long (24 bytes → 32 base64url chars)', () => {
    expect(generateState().length).toBeGreaterThanOrEqual(32);
  });
});

describe('stateCookieName', () => {
  it('returns a name scoped to the platform', () => {
    expect(stateCookieName('youtube')).toBe('oauth_state_youtube');
  });

  it('works for all supported platforms', () => {
    for (const p of ['youtube', 'tiktok', 'facebook', 'canva']) {
      expect(stateCookieName(p)).toBe(`oauth_state_${p}`);
    }
  });

  it('handles arbitrary platform strings without throwing', () => {
    expect(() => stateCookieName('unknown_platform')).not.toThrow();
  });
});

describe('generateCodeVerifier', () => {
  it('returns a non-empty string', () => {
    expect(generateCodeVerifier().length).toBeGreaterThan(0);
  });

  it('returns a base64url string', () => {
    expect(generateCodeVerifier()).toMatch(/^[A-Za-z0-9\-_]+$/);
  });

  it('produces different values on successive calls', () => {
    const a = generateCodeVerifier();
    const b = generateCodeVerifier();
    expect(a).not.toBe(b);
  });

  it('is at least 43 characters (32 bytes → 43 base64url chars, RFC 7636 minimum)', () => {
    expect(generateCodeVerifier().length).toBeGreaterThanOrEqual(43);
  });
});

describe('codeChallengeFromVerifier', () => {
  it('returns a base64url string', () => {
    const verifier = generateCodeVerifier();
    expect(codeChallengeFromVerifier(verifier)).toMatch(/^[A-Za-z0-9\-_]+$/);
  });

  it('is deterministic for the same verifier', () => {
    const verifier = 'abc123';
    expect(codeChallengeFromVerifier(verifier)).toBe(codeChallengeFromVerifier(verifier));
  });

  it('matches a manually computed SHA-256 base64url hash', () => {
    const verifier = 'test-verifier-value';
    const expected = createHash('sha256').update(verifier).digest('base64url');
    expect(codeChallengeFromVerifier(verifier)).toBe(expected);
  });

  it('returns different challenges for different verifiers', () => {
    const a = codeChallengeFromVerifier('verifier-a');
    const b = codeChallengeFromVerifier('verifier-b');
    expect(a).not.toBe(b);
  });

  it('round-trip: verifier from generateCodeVerifier() produces a valid challenge', () => {
    const verifier = generateCodeVerifier();
    const challenge = codeChallengeFromVerifier(verifier);
    const expected = createHash('sha256').update(verifier).digest('base64url');
    expect(challenge).toBe(expected);
  });
});

describe('codeVerifierCookieName', () => {
  it('returns a name scoped to the platform', () => {
    expect(codeVerifierCookieName('canva')).toBe('oauth_pkce_canva');
  });

  it('works for all expected platforms', () => {
    for (const p of ['youtube', 'tiktok', 'facebook', 'canva']) {
      expect(codeVerifierCookieName(p)).toBe(`oauth_pkce_${p}`);
    }
  });

  it('state cookie and verifier cookie names are distinct for the same platform', () => {
    expect(stateCookieName('canva')).not.toBe(codeVerifierCookieName('canva'));
  });
});
