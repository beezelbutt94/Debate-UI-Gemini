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

  it('returns a base64url string (no +, /, = chars)', () => {
    const state = generateState();
    expect(state).toMatch(/^[A-Za-z0-9\-_]+$/);
  });

  it('returns different values on each call (not deterministic)', () => {
    const a = generateState();
    const b = generateState();
    expect(a).not.toBe(b);
  });

  it('produces 32 bytes encoded as base64url (~43 chars)', () => {
    // randomBytes(24) → 24 bytes → 32 base64url chars
    const state = generateState();
    expect(state.length).toBe(32);
  });
});

describe('stateCookieName()', () => {
  it('prefixes with oauth_state_', () => {
    expect(stateCookieName('youtube')).toBe('oauth_state_youtube');
  });

  it('works for every supported platform', () => {
    for (const p of ['youtube', 'tiktok', 'facebook', 'canva']) {
      expect(stateCookieName(p)).toBe(`oauth_state_${p}`);
    }
  });

  it('passes through arbitrary platform strings unchanged', () => {
    expect(stateCookieName('newplatform')).toBe('oauth_state_newplatform');
  });
});

describe('generateCodeVerifier()', () => {
  it('returns a non-empty string', () => {
    expect(generateCodeVerifier().length).toBeGreaterThan(0);
  });

  it('returns a base64url string (no +, /, = chars)', () => {
    const v = generateCodeVerifier();
    expect(v).toMatch(/^[A-Za-z0-9\-_]+$/);
  });

  it('returns different values on each call', () => {
    const a = generateCodeVerifier();
    const b = generateCodeVerifier();
    expect(a).not.toBe(b);
  });

  it('is long enough for RFC 7636 (>= 43 chars)', () => {
    // randomBytes(32) → 43 base64url chars; RFC minimum is 43
    const v = generateCodeVerifier();
    expect(v.length).toBeGreaterThanOrEqual(43);
  });
});

describe('codeChallengeFromVerifier()', () => {
  it('returns a non-empty base64url string', () => {
    const challenge = codeChallengeFromVerifier('someVerifier');
    expect(challenge).toMatch(/^[A-Za-z0-9\-_]+$/);
  });

  it('is deterministic for the same verifier', () => {
    const v = 'fixed-verifier-string';
    expect(codeChallengeFromVerifier(v)).toBe(codeChallengeFromVerifier(v));
  });

  it('matches a manual SHA-256 base64url computation', () => {
    const verifier = 'test-verifier-abc123';
    const expected = createHash('sha256').update(verifier).digest('base64url');
    expect(codeChallengeFromVerifier(verifier)).toBe(expected);
  });

  it('returns different challenges for different verifiers', () => {
    expect(codeChallengeFromVerifier('aaa')).not.toBe(codeChallengeFromVerifier('bbb'));
  });

  it('round-trip: generateCodeVerifier + codeChallengeFromVerifier yields 43-char base64url', () => {
    const verifier = generateCodeVerifier();
    const challenge = codeChallengeFromVerifier(verifier);
    // SHA-256 → 32 bytes → 43 base64url chars (no padding)
    expect(challenge.length).toBe(43);
    expect(challenge).toMatch(/^[A-Za-z0-9\-_]+$/);
  });
});

describe('codeVerifierCookieName()', () => {
  it('prefixes with oauth_pkce_', () => {
    expect(codeVerifierCookieName('canva')).toBe('oauth_pkce_canva');
  });

  it('works for every supported platform', () => {
    for (const p of ['youtube', 'tiktok', 'facebook', 'canva']) {
      expect(codeVerifierCookieName(p)).toBe(`oauth_pkce_${p}`);
    }
  });

  it('passes through arbitrary platform strings unchanged', () => {
    expect(codeVerifierCookieName('other')).toBe('oauth_pkce_other');
  });
});
