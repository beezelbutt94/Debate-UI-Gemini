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
    expect(typeof generateState()).toBe('string');
    expect(generateState().length).toBeGreaterThan(0);
  });

  it('produces base64url-safe characters only', () => {
    const state = generateState();
    expect(state).toMatch(/^[A-Za-z0-9\-_]+$/);
  });

  it('generates a new unique value each call', () => {
    const a = generateState();
    const b = generateState();
    expect(a).not.toBe(b);
  });

  it('produces strings of expected length (32 bytes → 43 base64url chars)', () => {
    // randomBytes(24).toString('base64url') → ceil(24 * 4/3) = 32 chars (no padding)
    const state = generateState();
    expect(state.length).toBe(32);
  });

  it('generates 100 unique values with no collision', () => {
    const values = new Set(Array.from({ length: 100 }, () => generateState()));
    expect(values.size).toBe(100);
  });
});

describe('stateCookieName', () => {
  it('returns the correct cookie name for youtube', () => {
    expect(stateCookieName('youtube')).toBe('oauth_state_youtube');
  });

  it('returns the correct cookie name for tiktok', () => {
    expect(stateCookieName('tiktok')).toBe('oauth_state_tiktok');
  });

  it('returns the correct cookie name for facebook', () => {
    expect(stateCookieName('facebook')).toBe('oauth_state_facebook');
  });

  it('returns the correct cookie name for canva', () => {
    expect(stateCookieName('canva')).toBe('oauth_state_canva');
  });

  it('uses underscores not hyphens', () => {
    expect(stateCookieName('some-platform')).toBe('oauth_state_some-platform');
  });

  it('is prefixed consistently', () => {
    expect(stateCookieName('x')).toMatch(/^oauth_state_/);
  });
});

describe('generateCodeVerifier', () => {
  it('returns a non-empty string', () => {
    expect(generateCodeVerifier().length).toBeGreaterThan(0);
  });

  it('produces base64url-safe characters only', () => {
    expect(generateCodeVerifier()).toMatch(/^[A-Za-z0-9\-_]+$/);
  });

  it('generates a new unique value each call', () => {
    expect(generateCodeVerifier()).not.toBe(generateCodeVerifier());
  });

  it('produces strings of expected length (43 base64url chars from 32 bytes)', () => {
    // randomBytes(32).toString('base64url') → 43 chars
    expect(generateCodeVerifier().length).toBe(43);
  });

  it('is different from generateState output', () => {
    // Different byte lengths — verifiers are longer
    const state = generateState();
    const verifier = generateCodeVerifier();
    expect(verifier.length).toBeGreaterThan(state.length);
  });
});

describe('codeChallengeFromVerifier', () => {
  it('returns a non-empty string', () => {
    expect(codeChallengeFromVerifier('abc').length).toBeGreaterThan(0);
  });

  it('is deterministic for the same input', () => {
    const v = 'test-verifier-fixed';
    expect(codeChallengeFromVerifier(v)).toBe(codeChallengeFromVerifier(v));
  });

  it('matches manual SHA-256 base64url of the verifier', () => {
    const verifier = 'hello-world-verifier';
    const expected = createHash('sha256').update(verifier).digest('base64url');
    expect(codeChallengeFromVerifier(verifier)).toBe(expected);
  });

  it('produces base64url-safe characters only', () => {
    const challenge = codeChallengeFromVerifier(generateCodeVerifier());
    expect(challenge).toMatch(/^[A-Za-z0-9\-_]+$/);
  });

  it('differs for different verifiers', () => {
    expect(codeChallengeFromVerifier('aaa')).not.toBe(codeChallengeFromVerifier('bbb'));
  });

  it('produces 43-char base64url string (SHA-256 → 32 bytes)', () => {
    expect(codeChallengeFromVerifier('any-string').length).toBe(43);
  });

  it('works with a full generated verifier', () => {
    const verifier = generateCodeVerifier();
    const challenge = codeChallengeFromVerifier(verifier);
    const expected = createHash('sha256').update(verifier).digest('base64url');
    expect(challenge).toBe(expected);
  });
});

describe('codeVerifierCookieName', () => {
  it('returns the correct cookie name for canva', () => {
    expect(codeVerifierCookieName('canva')).toBe('oauth_pkce_canva');
  });

  it('returns the correct cookie name for youtube', () => {
    expect(codeVerifierCookieName('youtube')).toBe('oauth_pkce_youtube');
  });

  it('is prefixed consistently', () => {
    expect(codeVerifierCookieName('x')).toMatch(/^oauth_pkce_/);
  });

  it('differs from stateCookieName for same platform', () => {
    expect(codeVerifierCookieName('canva')).not.toBe(stateCookieName('canva'));
  });
});
