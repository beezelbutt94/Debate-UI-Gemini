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
    expect(generateState().length).toBeGreaterThan(0);
  });

  it('returns a base64url string (no +, /, or = chars)', () => {
    const state = generateState();
    expect(state).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  it('produces unique values on each call', () => {
    const values = Array.from({ length: 100 }, generateState);
    const unique = new Set(values);
    expect(unique.size).toBe(100);
  });

  it('has sufficient length for CSRF protection (≥32 chars)', () => {
    // 24 random bytes → 32 base64url chars
    expect(generateState().length).toBeGreaterThanOrEqual(32);
  });
});

describe('stateCookieName', () => {
  it('includes the platform name', () => {
    expect(stateCookieName('youtube')).toContain('youtube');
  });

  it('produces distinct names for distinct platforms', () => {
    expect(stateCookieName('youtube')).not.toBe(stateCookieName('tiktok'));
    expect(stateCookieName('tiktok')).not.toBe(stateCookieName('facebook'));
    expect(stateCookieName('facebook')).not.toBe(stateCookieName('canva'));
  });

  it('is stable for the same platform', () => {
    expect(stateCookieName('youtube')).toBe(stateCookieName('youtube'));
  });

  it('matches the expected format oauth_state_<platform>', () => {
    expect(stateCookieName('canva')).toBe('oauth_state_canva');
  });
});

describe('generateCodeVerifier', () => {
  it('returns a base64url string', () => {
    expect(generateCodeVerifier()).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  it('has minimum 43 chars (RFC 7636 min)', () => {
    // 32 random bytes → 43 base64url chars (43.something, rounded down)
    expect(generateCodeVerifier().length).toBeGreaterThanOrEqual(43);
  });

  it('does not exceed 128 chars (RFC 7636 max)', () => {
    expect(generateCodeVerifier().length).toBeLessThanOrEqual(128);
  });

  it('produces unique values on each call', () => {
    const values = Array.from({ length: 50 }, generateCodeVerifier);
    const unique = new Set(values);
    expect(unique.size).toBe(50);
  });
});

describe('codeChallengeFromVerifier', () => {
  it('produces a base64url string', () => {
    const challenge = codeChallengeFromVerifier('some-verifier-value');
    expect(challenge).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  it('matches SHA-256 of the verifier, base64url encoded', () => {
    const verifier = 'test-verifier-abc-123';
    const expected = createHash('sha256').update(verifier).digest('base64url');
    expect(codeChallengeFromVerifier(verifier)).toBe(expected);
  });

  it('is deterministic — same verifier produces same challenge', () => {
    const v = 'stable-verifier-value';
    expect(codeChallengeFromVerifier(v)).toBe(codeChallengeFromVerifier(v));
  });

  it('produces different challenges for different verifiers', () => {
    expect(codeChallengeFromVerifier('abc')).not.toBe(codeChallengeFromVerifier('xyz'));
  });

  it('round-trips: generateCodeVerifier → codeChallengeFromVerifier produces valid base64url', () => {
    const verifier = generateCodeVerifier();
    const challenge = codeChallengeFromVerifier(verifier);
    expect(challenge).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(challenge.length).toBeGreaterThan(0);
  });
});

describe('codeVerifierCookieName', () => {
  it('includes the platform name', () => {
    expect(codeVerifierCookieName('canva')).toContain('canva');
  });

  it('produces distinct names for distinct platforms', () => {
    expect(codeVerifierCookieName('canva')).not.toBe(codeVerifierCookieName('youtube'));
  });

  it('is stable for the same platform', () => {
    expect(codeVerifierCookieName('canva')).toBe(codeVerifierCookieName('canva'));
  });

  it('matches the expected format oauth_pkce_<platform>', () => {
    expect(codeVerifierCookieName('canva')).toBe('oauth_pkce_canva');
  });
});
