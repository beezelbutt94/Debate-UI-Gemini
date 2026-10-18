import { describe, it, expect } from 'vitest';
import { createHash } from 'crypto';
import {
  generateState,
  stateCookieName,
  generateCodeVerifier,
  codeChallengeFromVerifier,
  codeVerifierCookieName,
} from '@/lib/oauth/state';

describe('generateState()', () => {
  it('returns a non-empty string', () => {
    expect(generateState().length).toBeGreaterThan(0);
  });

  it('returns a base64url-safe string (no +, /, =)', () => {
    const state = generateState();
    expect(state).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  it('produces unique values on each call', () => {
    const states = new Set(Array.from({ length: 100 }, generateState));
    expect(states.size).toBe(100);
  });

  it('produces strings of expected length (32 random bytes → ~43 base64url chars)', () => {
    // randomBytes(24) → 24 bytes, base64url → Math.ceil(24 * 4/3) = 32 chars (no padding)
    const state = generateState();
    expect(state.length).toBe(32);
  });
});

describe('stateCookieName()', () => {
  it('prepends oauth_state_ to the platform', () => {
    expect(stateCookieName('youtube')).toBe('oauth_state_youtube');
  });

  it('works for all supported platforms', () => {
    for (const p of ['youtube', 'tiktok', 'facebook', 'canva']) {
      expect(stateCookieName(p)).toBe(`oauth_state_${p}`);
    }
  });

  it('handles an arbitrary string passthrough', () => {
    expect(stateCookieName('custom_platform')).toBe('oauth_state_custom_platform');
  });
});

describe('generateCodeVerifier()', () => {
  it('returns a non-empty base64url string', () => {
    const v = generateCodeVerifier();
    expect(v).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  it('produces unique verifiers on each call', () => {
    const verifiers = new Set(Array.from({ length: 100 }, generateCodeVerifier));
    expect(verifiers.size).toBe(100);
  });

  it('produces strings of the expected length (32 random bytes → 43 base64url chars)', () => {
    // randomBytes(32) → 32 bytes → ceil(32*4/3)=43 base64url chars (no padding)
    const v = generateCodeVerifier();
    expect(v.length).toBe(43);
  });
});

describe('codeChallengeFromVerifier()', () => {
  it('returns a non-empty base64url string', () => {
    const challenge = codeChallengeFromVerifier('someVerifier');
    expect(challenge).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  it('is deterministic: same verifier → same challenge', () => {
    const v = 'stable-verifier-input';
    expect(codeChallengeFromVerifier(v)).toBe(codeChallengeFromVerifier(v));
  });

  it('matches a manually computed SHA-256 base64url', () => {
    const verifier = 'test-verifier-string';
    const expected = createHash('sha256').update(verifier).digest('base64url');
    expect(codeChallengeFromVerifier(verifier)).toBe(expected);
  });

  it('produces different challenges for different verifiers', () => {
    expect(codeChallengeFromVerifier('verifier-a')).not.toBe(codeChallengeFromVerifier('verifier-b'));
  });

  it('handles an empty string verifier', () => {
    const challenge = codeChallengeFromVerifier('');
    expect(challenge.length).toBeGreaterThan(0);
  });
});

describe('codeVerifierCookieName()', () => {
  it('prepends oauth_pkce_ to the platform', () => {
    expect(codeVerifierCookieName('canva')).toBe('oauth_pkce_canva');
  });

  it('works for all supported platforms', () => {
    for (const p of ['youtube', 'tiktok', 'facebook', 'canva']) {
      expect(codeVerifierCookieName(p)).toBe(`oauth_pkce_${p}`);
    }
  });
});
