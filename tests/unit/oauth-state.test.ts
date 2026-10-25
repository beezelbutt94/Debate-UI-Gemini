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

  it('returns a base64url string (no +, /, or = characters)', () => {
    const state = generateState();
    expect(state).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  it('generates different values on each call', () => {
    const a = generateState();
    const b = generateState();
    expect(a).not.toBe(b);
  });

  it('returns a string of sufficient entropy length (32 chars+)', () => {
    // 24 random bytes → base64url encodes to 32 chars
    expect(generateState().length).toBeGreaterThanOrEqual(32);
  });
});

describe('stateCookieName()', () => {
  it('prefixes with oauth_state_', () => {
    expect(stateCookieName('youtube')).toBe('oauth_state_youtube');
  });

  it('works for all supported platforms', () => {
    for (const p of ['tiktok', 'facebook', 'canva', 'youtube']) {
      expect(stateCookieName(p)).toBe(`oauth_state_${p}`);
    }
  });

  it('includes arbitrary platform strings unchanged', () => {
    expect(stateCookieName('my-platform')).toBe('oauth_state_my-platform');
  });
});

describe('generateCodeVerifier()', () => {
  it('returns a non-empty string', () => {
    expect(generateCodeVerifier().length).toBeGreaterThan(0);
  });

  it('returns a base64url string', () => {
    expect(generateCodeVerifier()).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  it('generates different values on each call', () => {
    const a = generateCodeVerifier();
    const b = generateCodeVerifier();
    expect(a).not.toBe(b);
  });

  it('is at least 43 characters (PKCE minimum after base64url encoding 32 bytes)', () => {
    expect(generateCodeVerifier().length).toBeGreaterThanOrEqual(43);
  });
});

describe('codeChallengeFromVerifier()', () => {
  it('returns a base64url string', () => {
    const verifier = generateCodeVerifier();
    expect(codeChallengeFromVerifier(verifier)).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  it('produces the correct SHA-256 base64url hash', () => {
    const verifier = 'test-verifier-string';
    const expected = createHash('sha256').update(verifier).digest('base64url');
    expect(codeChallengeFromVerifier(verifier)).toBe(expected);
  });

  it('is deterministic for the same input', () => {
    const v = 'fixed-verifier';
    expect(codeChallengeFromVerifier(v)).toBe(codeChallengeFromVerifier(v));
  });

  it('produces different challenges for different verifiers', () => {
    const c1 = codeChallengeFromVerifier(generateCodeVerifier());
    const c2 = codeChallengeFromVerifier(generateCodeVerifier());
    expect(c1).not.toBe(c2);
  });

  it('matches the generated verifier when derived from it', () => {
    const verifier = generateCodeVerifier();
    const challenge = codeChallengeFromVerifier(verifier);
    // The challenge should be the SHA-256 base64url of the verifier
    const manual = createHash('sha256').update(verifier).digest('base64url');
    expect(challenge).toBe(manual);
  });
});

describe('codeVerifierCookieName()', () => {
  it('prefixes with oauth_pkce_', () => {
    expect(codeVerifierCookieName('canva')).toBe('oauth_pkce_canva');
  });

  it('works for all supported platforms', () => {
    for (const p of ['tiktok', 'facebook', 'canva', 'youtube']) {
      expect(codeVerifierCookieName(p)).toBe(`oauth_pkce_${p}`);
    }
  });

  it('includes arbitrary platform strings unchanged', () => {
    expect(codeVerifierCookieName('some-other-platform')).toBe('oauth_pkce_some-other-platform');
  });
});
