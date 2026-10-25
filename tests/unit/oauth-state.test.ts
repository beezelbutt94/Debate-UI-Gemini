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
    expect(generateState()).toBeTruthy();
    expect(typeof generateState()).toBe('string');
  });

  it('generates base64url-safe characters only', () => {
    for (let i = 0; i < 50; i++) {
      const state = generateState();
      expect(state).toMatch(/^[A-Za-z0-9_-]+$/);
    }
  });

  it('produces unique values across calls', () => {
    const states = new Set(Array.from({ length: 100 }, generateState));
    expect(states.size).toBe(100);
  });

  it('has a reasonable length (32 bytes → ~43 base64url chars)', () => {
    // 24 bytes → ceil(24 * 4/3) = 32 base64url chars (no padding)
    const state = generateState();
    expect(state.length).toBeGreaterThanOrEqual(30);
    expect(state.length).toBeLessThanOrEqual(36);
  });

  it('does not contain standard base64 padding characters', () => {
    for (let i = 0; i < 20; i++) {
      expect(generateState()).not.toContain('=');
      expect(generateState()).not.toContain('+');
      expect(generateState()).not.toContain('/');
    }
  });
});

describe('stateCookieName()', () => {
  it('returns expected cookie name for tiktok', () => {
    expect(stateCookieName('tiktok')).toBe('oauth_state_tiktok');
  });

  it('returns expected cookie name for youtube', () => {
    expect(stateCookieName('youtube')).toBe('oauth_state_youtube');
  });

  it('returns expected cookie name for facebook', () => {
    expect(stateCookieName('facebook')).toBe('oauth_state_facebook');
  });

  it('returns expected cookie name for canva', () => {
    expect(stateCookieName('canva')).toBe('oauth_state_canva');
  });

  it('is deterministic for the same platform', () => {
    expect(stateCookieName('youtube')).toBe(stateCookieName('youtube'));
  });

  it('produces different names for different platforms', () => {
    expect(stateCookieName('tiktok')).not.toBe(stateCookieName('youtube'));
  });
});

describe('generateCodeVerifier()', () => {
  it('returns a non-empty string', () => {
    expect(generateCodeVerifier()).toBeTruthy();
    expect(typeof generateCodeVerifier()).toBe('string');
  });

  it('generates base64url-safe characters only', () => {
    for (let i = 0; i < 50; i++) {
      const verifier = generateCodeVerifier();
      expect(verifier).toMatch(/^[A-Za-z0-9_-]+$/);
    }
  });

  it('produces unique values across calls', () => {
    const verifiers = new Set(Array.from({ length: 100 }, generateCodeVerifier));
    expect(verifiers.size).toBe(100);
  });

  it('has minimum 43 characters (RFC 7636 minimum)', () => {
    // 32 bytes → 43 base64url chars — well above RFC minimum of 43
    for (let i = 0; i < 20; i++) {
      expect(generateCodeVerifier().length).toBeGreaterThanOrEqual(43);
    }
  });

  it('does not contain forbidden base64 characters', () => {
    for (let i = 0; i < 20; i++) {
      const v = generateCodeVerifier();
      expect(v).not.toContain('=');
      expect(v).not.toContain('+');
      expect(v).not.toContain('/');
    }
  });
});

describe('codeChallengeFromVerifier()', () => {
  it('returns a non-empty base64url string', () => {
    const challenge = codeChallengeFromVerifier('my-verifier');
    expect(challenge).toBeTruthy();
    expect(challenge).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  it('is deterministic for the same input', () => {
    const verifier = 'test-verifier-abc';
    expect(codeChallengeFromVerifier(verifier)).toBe(codeChallengeFromVerifier(verifier));
  });

  it('produces different challenges for different verifiers', () => {
    expect(codeChallengeFromVerifier('aaa')).not.toBe(codeChallengeFromVerifier('bbb'));
  });

  it('matches SHA-256 base64url of the verifier (RFC 7636)', () => {
    const verifier = 'hello-world-pkce-test-verifier-1234';
    const expected = createHash('sha256').update(verifier).digest('base64url');
    expect(codeChallengeFromVerifier(verifier)).toBe(expected);
  });

  it('produces a 43-character challenge for any verifier (SHA-256 → 32 bytes → 43 base64url)', () => {
    for (const v of ['short', 'medium-length-verifier', generateCodeVerifier()]) {
      expect(codeChallengeFromVerifier(v).length).toBe(43);
    }
  });

  it('does not contain padding characters', () => {
    for (let i = 0; i < 20; i++) {
      const challenge = codeChallengeFromVerifier(generateCodeVerifier());
      expect(challenge).not.toContain('=');
    }
  });

  it('challenge of a real generated verifier passes the round-trip SHA-256 check', () => {
    const verifier = generateCodeVerifier();
    const challenge = codeChallengeFromVerifier(verifier);
    const expected = createHash('sha256').update(verifier).digest('base64url');
    expect(challenge).toBe(expected);
  });
});

describe('codeVerifierCookieName()', () => {
  it('returns expected cookie name for canva', () => {
    expect(codeVerifierCookieName('canva')).toBe('oauth_pkce_canva');
  });

  it('returns expected cookie name for youtube', () => {
    expect(codeVerifierCookieName('youtube')).toBe('oauth_pkce_youtube');
  });

  it('returns expected cookie name for tiktok', () => {
    expect(codeVerifierCookieName('tiktok')).toBe('oauth_pkce_tiktok');
  });

  it('returns expected cookie name for facebook', () => {
    expect(codeVerifierCookieName('facebook')).toBe('oauth_pkce_facebook');
  });

  it('is distinct from stateCookieName for the same platform', () => {
    expect(codeVerifierCookieName('canva')).not.toBe(stateCookieName('canva'));
  });
});
