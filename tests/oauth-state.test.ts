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
    expect(typeof generateState()).toBe('string');
    expect(generateState().length).toBeGreaterThan(0);
  });

  it('produces base64url-safe characters only', () => {
    const state = generateState();
    expect(state).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  it('generates unique values on each call', () => {
    const a = generateState();
    const b = generateState();
    expect(a).not.toBe(b);
  });

  it('has expected entropy length (24 bytes → ~32 base64url chars)', () => {
    // 24 raw bytes → ceil(24/3)*4 = 32 base64 chars (padding-free base64url)
    const state = generateState();
    expect(state.length).toBeGreaterThanOrEqual(30);
    expect(state.length).toBeLessThanOrEqual(36);
  });

  it('does not contain + or / or = (not plain base64)', () => {
    for (let i = 0; i < 10; i++) {
      const s = generateState();
      expect(s).not.toMatch(/[+/=]/);
    }
  });
});

describe('stateCookieName()', () => {
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

  it('is deterministic', () => {
    expect(stateCookieName('youtube')).toBe(stateCookieName('youtube'));
  });

  it('differs per platform', () => {
    expect(stateCookieName('youtube')).not.toBe(stateCookieName('tiktok'));
  });
});

describe('generateCodeVerifier()', () => {
  it('returns a non-empty string', () => {
    expect(generateCodeVerifier().length).toBeGreaterThan(0);
  });

  it('produces base64url-safe characters only', () => {
    const verifier = generateCodeVerifier();
    expect(verifier).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  it('generates unique values on each call', () => {
    const a = generateCodeVerifier();
    const b = generateCodeVerifier();
    expect(a).not.toBe(b);
  });

  it('has sufficient entropy (32 bytes → ~43 base64url chars)', () => {
    const verifier = generateCodeVerifier();
    // 32 bytes → 43 base64url chars
    expect(verifier.length).toBeGreaterThanOrEqual(40);
    expect(verifier.length).toBeLessThanOrEqual(48);
  });

  it('does not contain +, /, or = (PKCE requires base64url, not base64)', () => {
    for (let i = 0; i < 10; i++) {
      expect(generateCodeVerifier()).not.toMatch(/[+/=]/);
    }
  });
});

describe('codeChallengeFromVerifier()', () => {
  it('returns a non-empty string', () => {
    expect(codeChallengeFromVerifier('abc').length).toBeGreaterThan(0);
  });

  it('produces base64url output (no +, /, =)', () => {
    const challenge = codeChallengeFromVerifier('test-verifier');
    expect(challenge).not.toMatch(/[+/=]/);
  });

  it('is a SHA-256 hash of the verifier (RFC 7636 S256)', () => {
    const verifier = 'test-verifier-value';
    const expected = createHash('sha256').update(verifier).digest('base64url');
    expect(codeChallengeFromVerifier(verifier)).toBe(expected);
  });

  it('is deterministic for the same input', () => {
    const verifier = 'some-fixed-verifier';
    expect(codeChallengeFromVerifier(verifier)).toBe(codeChallengeFromVerifier(verifier));
  });

  it('differs for different verifiers', () => {
    expect(codeChallengeFromVerifier('aaa')).not.toBe(codeChallengeFromVerifier('bbb'));
  });

  it('produces a 43-char base64url string for SHA-256 (256 bits / 6 bits = 43)', () => {
    const challenge = codeChallengeFromVerifier('test');
    expect(challenge.length).toBe(43);
  });

  it('handles an empty string verifier', () => {
    const empty = codeChallengeFromVerifier('');
    expect(empty.length).toBe(43);
    const expected = createHash('sha256').update('').digest('base64url');
    expect(empty).toBe(expected);
  });

  it('round-trips with generateCodeVerifier()', () => {
    const verifier = generateCodeVerifier();
    const challenge = codeChallengeFromVerifier(verifier);
    const expected = createHash('sha256').update(verifier).digest('base64url');
    expect(challenge).toBe(expected);
  });
});

describe('codeVerifierCookieName()', () => {
  it('prefixes with oauth_pkce_', () => {
    expect(codeVerifierCookieName('canva')).toBe('oauth_pkce_canva');
  });

  it('works for youtube', () => {
    expect(codeVerifierCookieName('youtube')).toBe('oauth_pkce_youtube');
  });

  it('is deterministic', () => {
    expect(codeVerifierCookieName('canva')).toBe(codeVerifierCookieName('canva'));
  });

  it('differs per platform', () => {
    expect(codeVerifierCookieName('canva')).not.toBe(codeVerifierCookieName('tiktok'));
  });

  it('differs from stateCookieName for same platform', () => {
    expect(codeVerifierCookieName('canva')).not.toBe(stateCookieName('canva'));
  });
});
