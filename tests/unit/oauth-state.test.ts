import { describe, it, expect } from 'vitest';
import { createHash } from 'crypto';
import {
  generateState,
  generateCodeVerifier,
  codeChallengeFromVerifier,
  stateCookieName,
  codeVerifierCookieName,
} from '@/lib/oauth/state';

const BASE64URL_RE = /^[A-Za-z0-9_-]+$/;

describe('generateState()', () => {
  it('returns a string', () => {
    expect(typeof generateState()).toBe('string');
  });

  it('returns a base64url string (no +, /, or =)', () => {
    expect(generateState()).toMatch(BASE64URL_RE);
  });

  it('returns a string of the correct length (24 bytes → 32 base64url chars)', () => {
    // 24 bytes → ceil(24 * 4/3) = 32 chars (no padding with base64url)
    expect(generateState().length).toBe(32);
  });

  it('generates unique values on each call', () => {
    const values = new Set(Array.from({ length: 100 }, () => generateState()));
    expect(values.size).toBe(100);
  });
});

describe('generateCodeVerifier()', () => {
  it('returns a string', () => {
    expect(typeof generateCodeVerifier()).toBe('string');
  });

  it('returns a base64url string', () => {
    expect(generateCodeVerifier()).toMatch(BASE64URL_RE);
  });

  it('returns a string of the correct length (32 bytes → 43 base64url chars)', () => {
    // 32 bytes → ceil(32 * 4/3) without padding = 43 chars
    expect(generateCodeVerifier().length).toBe(43);
  });

  it('generates unique values on each call', () => {
    const values = new Set(Array.from({ length: 100 }, () => generateCodeVerifier()));
    expect(values.size).toBe(100);
  });
});

describe('codeChallengeFromVerifier()', () => {
  it('returns a base64url string', () => {
    const verifier = generateCodeVerifier();
    expect(codeChallengeFromVerifier(verifier)).toMatch(BASE64URL_RE);
  });

  it('is deterministic for the same verifier', () => {
    const verifier = 'test-verifier-abc123';
    expect(codeChallengeFromVerifier(verifier)).toBe(codeChallengeFromVerifier(verifier));
  });

  it('matches independent SHA-256 base64url computation', () => {
    const verifier = generateCodeVerifier();
    const expected = createHash('sha256').update(verifier).digest('base64url');
    expect(codeChallengeFromVerifier(verifier)).toBe(expected);
  });

  it('produces different challenges for different verifiers', () => {
    const v1 = generateCodeVerifier();
    const v2 = generateCodeVerifier();
    expect(codeChallengeFromVerifier(v1)).not.toBe(codeChallengeFromVerifier(v2));
  });

  it('challenge length is 43 chars (SHA-256 → 32 bytes → base64url)', () => {
    expect(codeChallengeFromVerifier(generateCodeVerifier()).length).toBe(43);
  });

  it('handles a known test vector (RFC 7636 S4.2 example)', () => {
    // RFC 7636 Appendix B: verifier "dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk"
    // challenge: "E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM"
    const verifier = 'dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk';
    const expected = 'E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM';
    expect(codeChallengeFromVerifier(verifier)).toBe(expected);
  });
});

describe('stateCookieName()', () => {
  it('returns the correct prefix pattern', () => {
    expect(stateCookieName('youtube')).toBe('oauth_state_youtube');
  });

  it('works for all oauth platforms', () => {
    const platforms = ['youtube', 'tiktok', 'facebook', 'canva'];
    for (const p of platforms) {
      expect(stateCookieName(p)).toBe(`oauth_state_${p}`);
    }
  });

  it('is deterministic', () => {
    expect(stateCookieName('tiktok')).toBe(stateCookieName('tiktok'));
  });

  it('handles arbitrary platform strings', () => {
    expect(stateCookieName('unknown-platform')).toBe('oauth_state_unknown-platform');
  });
});

describe('codeVerifierCookieName()', () => {
  it('returns the correct prefix pattern', () => {
    expect(codeVerifierCookieName('canva')).toBe('oauth_pkce_canva');
  });

  it('works for all oauth platforms', () => {
    const platforms = ['youtube', 'tiktok', 'facebook', 'canva'];
    for (const p of platforms) {
      expect(codeVerifierCookieName(p)).toBe(`oauth_pkce_${p}`);
    }
  });

  it('is deterministic', () => {
    expect(codeVerifierCookieName('canva')).toBe(codeVerifierCookieName('canva'));
  });

  it('differs from stateCookieName for same platform', () => {
    expect(codeVerifierCookieName('canva')).not.toBe(stateCookieName('canva'));
  });
});
