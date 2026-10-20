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
    expect(generateState()).toBeTruthy();
    expect(typeof generateState()).toBe('string');
  });

  it('returns base64url characters only', () => {
    for (let i = 0; i < 20; i++) {
      expect(generateState()).toMatch(/^[A-Za-z0-9_-]+$/);
    }
  });

  it('produces unique values each call', () => {
    const states = new Set(Array.from({ length: 50 }, () => generateState()));
    expect(states.size).toBe(50);
  });

  it('has sufficient length (24 bytes → 32 base64url chars)', () => {
    // 24 random bytes encoded as base64url = ceil(24/3)*4 = 32 chars
    expect(generateState().length).toBe(32);
  });
});

describe('stateCookieName', () => {
  it('prefixes with oauth_state_', () => {
    expect(stateCookieName('youtube')).toBe('oauth_state_youtube');
  });

  it('works for tiktok', () => {
    expect(stateCookieName('tiktok')).toBe('oauth_state_tiktok');
  });

  it('works for facebook', () => {
    expect(stateCookieName('facebook')).toBe('oauth_state_facebook');
  });

  it('works for canva', () => {
    expect(stateCookieName('canva')).toBe('oauth_state_canva');
  });

  it('handles arbitrary platform strings', () => {
    expect(stateCookieName('my-platform')).toBe('oauth_state_my-platform');
  });
});

describe('generateCodeVerifier', () => {
  it('returns a non-empty string', () => {
    expect(generateCodeVerifier()).toBeTruthy();
  });

  it('returns base64url characters only', () => {
    for (let i = 0; i < 20; i++) {
      expect(generateCodeVerifier()).toMatch(/^[A-Za-z0-9_-]+$/);
    }
  });

  it('produces unique values each call', () => {
    const verifiers = new Set(Array.from({ length: 50 }, () => generateCodeVerifier()));
    expect(verifiers.size).toBe(50);
  });

  it('has correct length for 32 bytes (43 base64url chars)', () => {
    // 32 random bytes → base64url = 43 chars (no padding)
    expect(generateCodeVerifier().length).toBe(43);
  });
});

describe('codeChallengeFromVerifier', () => {
  it('returns a string', () => {
    expect(typeof codeChallengeFromVerifier('verifier123')).toBe('string');
  });

  it('matches SHA-256 base64url of the verifier', () => {
    const verifier = 'my-test-verifier';
    const expected = createHash('sha256').update(verifier).digest('base64url');
    expect(codeChallengeFromVerifier(verifier)).toBe(expected);
  });

  it('is deterministic for same input', () => {
    const v = 'deterministic-test';
    expect(codeChallengeFromVerifier(v)).toBe(codeChallengeFromVerifier(v));
  });

  it('produces different output for different verifiers', () => {
    expect(codeChallengeFromVerifier('aaa')).not.toBe(codeChallengeFromVerifier('bbb'));
  });

  it('produces base64url (no + / =) characters', () => {
    const challenge = codeChallengeFromVerifier(generateCodeVerifier());
    expect(challenge).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  it('challenge length is 43 chars (SHA-256 = 32 bytes → 43 base64url)', () => {
    expect(codeChallengeFromVerifier('some-verifier').length).toBe(43);
  });

  it('round-trips: verifier → challenge matches direct SHA-256', () => {
    const verifier = generateCodeVerifier();
    const directHash = createHash('sha256').update(verifier).digest('base64url');
    expect(codeChallengeFromVerifier(verifier)).toBe(directHash);
  });
});

describe('codeVerifierCookieName', () => {
  it('prefixes with oauth_pkce_', () => {
    expect(codeVerifierCookieName('canva')).toBe('oauth_pkce_canva');
  });

  it('works for all platforms', () => {
    expect(codeVerifierCookieName('youtube')).toBe('oauth_pkce_youtube');
    expect(codeVerifierCookieName('tiktok')).toBe('oauth_pkce_tiktok');
    expect(codeVerifierCookieName('facebook')).toBe('oauth_pkce_facebook');
  });

  it('handles arbitrary platform strings', () => {
    expect(codeVerifierCookieName('my-platform')).toBe('oauth_pkce_my-platform');
  });
});
