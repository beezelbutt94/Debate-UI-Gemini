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
    expect(generateState()).toBeTruthy();
  });

  it('returns a base64url-safe string (no +, /, or = chars)', () => {
    for (let i = 0; i < 20; i++) {
      const state = generateState();
      expect(state).not.toMatch(/[+/=]/);
    }
  });

  it('returns different values on each call', () => {
    const a = generateState();
    const b = generateState();
    expect(a).not.toBe(b);
  });

  it('returns a string of expected minimum length (32 chars for 24 random bytes base64url)', () => {
    // 24 bytes → ceil(24 * 4/3) = 32 chars (base64url, no padding)
    expect(generateState().length).toBeGreaterThanOrEqual(32);
  });
});

describe('stateCookieName', () => {
  it('returns expected format for youtube', () => {
    expect(stateCookieName('youtube')).toBe('oauth_state_youtube');
  });

  it('returns expected format for tiktok', () => {
    expect(stateCookieName('tiktok')).toBe('oauth_state_tiktok');
  });

  it('returns expected format for facebook', () => {
    expect(stateCookieName('facebook')).toBe('oauth_state_facebook');
  });

  it('returns expected format for canva', () => {
    expect(stateCookieName('canva')).toBe('oauth_state_canva');
  });

  it('uses the platform as the suffix', () => {
    const platform = 'my_custom_platform';
    expect(stateCookieName(platform)).toBe(`oauth_state_${platform}`);
  });
});

describe('generateCodeVerifier', () => {
  it('returns a non-empty string', () => {
    expect(generateCodeVerifier()).toBeTruthy();
  });

  it('returns a base64url-safe string (no +, /, or =)', () => {
    for (let i = 0; i < 20; i++) {
      const verifier = generateCodeVerifier();
      expect(verifier).not.toMatch(/[+/=]/);
    }
  });

  it('returns different values on each call', () => {
    const a = generateCodeVerifier();
    const b = generateCodeVerifier();
    expect(a).not.toBe(b);
  });

  it('returns at least 43 chars (RFC 7636 minimum; 32 bytes base64url ≈ 43 chars)', () => {
    // 32 bytes → ceil(32 * 4/3) = 43 chars without padding
    expect(generateCodeVerifier().length).toBeGreaterThanOrEqual(43);
  });
});

describe('codeChallengeFromVerifier', () => {
  it('returns a base64url-safe string', () => {
    const challenge = codeChallengeFromVerifier(generateCodeVerifier());
    expect(challenge).not.toMatch(/[+/=]/);
  });

  it('produces the correct SHA-256 base64url digest (RFC 7636 S256)', () => {
    const verifier = 'dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk';
    const expected = createHash('sha256').update(verifier).digest('base64url');
    expect(codeChallengeFromVerifier(verifier)).toBe(expected);
  });

  it('is deterministic: same verifier → same challenge', () => {
    const verifier = generateCodeVerifier();
    expect(codeChallengeFromVerifier(verifier)).toBe(codeChallengeFromVerifier(verifier));
  });

  it('different verifiers produce different challenges', () => {
    const v1 = generateCodeVerifier();
    const v2 = generateCodeVerifier();
    expect(codeChallengeFromVerifier(v1)).not.toBe(codeChallengeFromVerifier(v2));
  });

  it('produces 43-char output for a 32-byte verifier (SHA-256 always 32 bytes → 43 base64url chars)', () => {
    const verifier = generateCodeVerifier();
    // SHA-256 output is always 32 bytes → 43 base64url chars (no padding)
    expect(codeChallengeFromVerifier(verifier)).toHaveLength(43);
  });
});

describe('codeVerifierCookieName', () => {
  it('returns expected format for canva', () => {
    expect(codeVerifierCookieName('canva')).toBe('oauth_pkce_canva');
  });

  it('returns expected format for youtube', () => {
    expect(codeVerifierCookieName('youtube')).toBe('oauth_pkce_youtube');
  });

  it('uses the platform as suffix', () => {
    const platform = 'some_platform';
    expect(codeVerifierCookieName(platform)).toBe(`oauth_pkce_${platform}`);
  });
});
