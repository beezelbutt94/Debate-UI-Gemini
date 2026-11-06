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

  it('returns a base64url-safe string (no +, /, =)', () => {
    const state = generateState();
    expect(state).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  it('produces different values on each call', () => {
    const a = generateState();
    const b = generateState();
    expect(a).not.toBe(b);
  });

  it('is at least 24 chars long (192 bits → 32 base64url chars)', () => {
    // 24 random bytes → at least 32 base64url chars
    expect(generateState().length).toBeGreaterThanOrEqual(30);
  });
});

describe('stateCookieName()', () => {
  it('returns expected prefix + platform', () => {
    expect(stateCookieName('youtube')).toBe('oauth_state_youtube');
  });

  it('returns expected prefix + platform for tiktok', () => {
    expect(stateCookieName('tiktok')).toBe('oauth_state_tiktok');
  });

  it('returns expected prefix + platform for facebook', () => {
    expect(stateCookieName('facebook')).toBe('oauth_state_facebook');
  });

  it('returns expected prefix + platform for canva', () => {
    expect(stateCookieName('canva')).toBe('oauth_state_canva');
  });
});

describe('generateCodeVerifier()', () => {
  it('returns a non-empty string', () => {
    expect(generateCodeVerifier().length).toBeGreaterThan(0);
  });

  it('is base64url-safe', () => {
    expect(generateCodeVerifier()).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  it('produces unique values', () => {
    expect(generateCodeVerifier()).not.toBe(generateCodeVerifier());
  });

  it('is at least 43 chars (RFC 7636 minimum for 32-byte verifier)', () => {
    expect(generateCodeVerifier().length).toBeGreaterThanOrEqual(43);
  });
});

describe('codeChallengeFromVerifier()', () => {
  it('returns a base64url string', () => {
    const verifier = generateCodeVerifier();
    expect(codeChallengeFromVerifier(verifier)).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  it('is deterministic for the same verifier', () => {
    const v = generateCodeVerifier();
    expect(codeChallengeFromVerifier(v)).toBe(codeChallengeFromVerifier(v));
  });

  it('produces different challenges for different verifiers', () => {
    expect(codeChallengeFromVerifier(generateCodeVerifier())).not.toBe(
      codeChallengeFromVerifier(generateCodeVerifier())
    );
  });

  it('matches the expected SHA-256 base64url calculation', () => {
    const verifier = 'hello-world-test-verifier-12345';
    const expected = createHash('sha256').update(verifier).digest('base64url');
    expect(codeChallengeFromVerifier(verifier)).toBe(expected);
  });

  it('never includes padding characters (=)', () => {
    const challenge = codeChallengeFromVerifier(generateCodeVerifier());
    expect(challenge).not.toContain('=');
  });
});

describe('codeVerifierCookieName()', () => {
  it('returns expected prefix + platform for canva', () => {
    expect(codeVerifierCookieName('canva')).toBe('oauth_pkce_canva');
  });

  it('returns expected prefix + platform for youtube', () => {
    expect(codeVerifierCookieName('youtube')).toBe('oauth_pkce_youtube');
  });
});
