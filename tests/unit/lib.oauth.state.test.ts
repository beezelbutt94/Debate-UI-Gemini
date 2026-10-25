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

  it('is URL-safe base64 (no +, /, = characters)', () => {
    const state = generateState();
    expect(state).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  it('produces unique values on each call', () => {
    const states = new Set(Array.from({ length: 20 }, () => generateState()));
    expect(states.size).toBe(20);
  });

  it('is at least 32 chars (24 bytes → base64url)', () => {
    expect(generateState().length).toBeGreaterThanOrEqual(32);
  });
});

describe('stateCookieName()', () => {
  it('returns oauth_state_<platform>', () => {
    expect(stateCookieName('youtube')).toBe('oauth_state_youtube');
  });

  it('works for all four platforms', () => {
    for (const p of ['youtube', 'tiktok', 'facebook', 'canva']) {
      expect(stateCookieName(p)).toBe(`oauth_state_${p}`);
    }
  });

  it('works for an arbitrary string', () => {
    expect(stateCookieName('custom_platform')).toBe('oauth_state_custom_platform');
  });
});

describe('generateCodeVerifier()', () => {
  it('returns a non-empty string', () => {
    expect(generateCodeVerifier().length).toBeGreaterThan(0);
  });

  it('is URL-safe base64 (no +, /, = characters)', () => {
    const verifier = generateCodeVerifier();
    expect(verifier).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  it('produces unique values on each call', () => {
    const verifiers = new Set(Array.from({ length: 20 }, () => generateCodeVerifier()));
    expect(verifiers.size).toBe(20);
  });

  it('is at least 43 chars (32 bytes → base64url, RFC 7636 minimum)', () => {
    expect(generateCodeVerifier().length).toBeGreaterThanOrEqual(43);
  });
});

describe('codeChallengeFromVerifier()', () => {
  it('returns a URL-safe base64 string', () => {
    const challenge = codeChallengeFromVerifier('test-verifier');
    expect(challenge).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  it('matches the expected S256 output', () => {
    const verifier = 'dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk';
    const expected = createHash('sha256').update(verifier).digest('base64url');
    expect(codeChallengeFromVerifier(verifier)).toBe(expected);
  });

  it('is deterministic — same verifier always produces the same challenge', () => {
    const v = 'stable-verifier-value';
    expect(codeChallengeFromVerifier(v)).toBe(codeChallengeFromVerifier(v));
  });

  it('produces different challenges for different verifiers', () => {
    const c1 = codeChallengeFromVerifier('verifier-one');
    const c2 = codeChallengeFromVerifier('verifier-two');
    expect(c1).not.toBe(c2);
  });

  it('round-trips: a real generateCodeVerifier() value can be hashed', () => {
    const verifier = generateCodeVerifier();
    const challenge = codeChallengeFromVerifier(verifier);
    const expected = createHash('sha256').update(verifier).digest('base64url');
    expect(challenge).toBe(expected);
  });
});

describe('codeVerifierCookieName()', () => {
  it('returns oauth_pkce_<platform>', () => {
    expect(codeVerifierCookieName('canva')).toBe('oauth_pkce_canva');
  });

  it('works for all four platforms', () => {
    for (const p of ['youtube', 'tiktok', 'facebook', 'canva']) {
      expect(codeVerifierCookieName(p)).toBe(`oauth_pkce_${p}`);
    }
  });

  it('differs from stateCookieName for the same platform', () => {
    expect(codeVerifierCookieName('canva')).not.toBe(stateCookieName('canva'));
  });
});
