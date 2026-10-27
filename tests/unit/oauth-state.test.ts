import { describe, it, expect } from 'vitest';
import {
  generateState,
  stateCookieName,
  generateCodeVerifier,
  codeChallengeFromVerifier,
  codeVerifierCookieName,
} from '@/lib/oauth/state';
import { createHash } from 'crypto';

// ---------------------------------------------------------------------------
// generateState
// ---------------------------------------------------------------------------
describe('generateState()', () => {
  it('returns a non-empty string', () => {
    expect(generateState().length).toBeGreaterThan(0);
  });

  it('uses base64url alphabet only (no + / =)', () => {
    const state = generateState();
    expect(state).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  it('generates unique values each call', () => {
    const a = generateState();
    const b = generateState();
    expect(a).not.toBe(b);
  });

  it('produces 24 source bytes → 32 base64url chars', () => {
    // randomBytes(24).toString('base64url') → Math.ceil(24 * 4/3) = 32 chars
    expect(generateState().length).toBe(32);
  });
});

// ---------------------------------------------------------------------------
// stateCookieName
// ---------------------------------------------------------------------------
describe('stateCookieName()', () => {
  it('returns expected prefix + platform', () => {
    expect(stateCookieName('youtube')).toBe('oauth_state_youtube');
  });

  it('handles tiktok', () => {
    expect(stateCookieName('tiktok')).toBe('oauth_state_tiktok');
  });

  it('handles facebook', () => {
    expect(stateCookieName('facebook')).toBe('oauth_state_facebook');
  });

  it('handles canva', () => {
    expect(stateCookieName('canva')).toBe('oauth_state_canva');
  });

  it('handles arbitrary string values', () => {
    expect(stateCookieName('newplatform')).toBe('oauth_state_newplatform');
  });
});

// ---------------------------------------------------------------------------
// generateCodeVerifier
// ---------------------------------------------------------------------------
describe('generateCodeVerifier()', () => {
  it('returns a non-empty string', () => {
    expect(generateCodeVerifier().length).toBeGreaterThan(0);
  });

  it('uses base64url alphabet only', () => {
    expect(generateCodeVerifier()).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  it('generates unique values each call', () => {
    const a = generateCodeVerifier();
    const b = generateCodeVerifier();
    expect(a).not.toBe(b);
  });

  it('produces 32 source bytes → ~43 base64url chars', () => {
    // randomBytes(32).toString('base64url') → Math.ceil(32 * 4/3) = 43 chars
    expect(generateCodeVerifier().length).toBe(43);
  });
});

// ---------------------------------------------------------------------------
// codeChallengeFromVerifier
// ---------------------------------------------------------------------------
describe('codeChallengeFromVerifier()', () => {
  it('returns a non-empty string', () => {
    expect(codeChallengeFromVerifier('testverifier').length).toBeGreaterThan(0);
  });

  it('uses base64url alphabet only (RFC 7636 S256)', () => {
    const challenge = codeChallengeFromVerifier('hello');
    expect(challenge).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  it('is deterministic for same input', () => {
    const v = 'my-test-verifier-abc123';
    expect(codeChallengeFromVerifier(v)).toBe(codeChallengeFromVerifier(v));
  });

  it('matches manual SHA-256 base64url computation', () => {
    const verifier = 'test-verifier-string';
    const expected = createHash('sha256').update(verifier).digest('base64url');
    expect(codeChallengeFromVerifier(verifier)).toBe(expected);
  });

  it('differs for different verifiers', () => {
    expect(codeChallengeFromVerifier('abc')).not.toBe(codeChallengeFromVerifier('xyz'));
  });

  it('round-trips: verifier → challenge is always 43 chars (SHA-256 in base64url)', () => {
    // SHA-256 → 32 bytes → ceil(32*4/3) = 43 base64url chars
    expect(codeChallengeFromVerifier('anything').length).toBe(43);
  });

  it('full PKCE flow: challenge derived from a generated verifier passes regex', () => {
    const verifier = generateCodeVerifier();
    const challenge = codeChallengeFromVerifier(verifier);
    expect(challenge).toMatch(/^[A-Za-z0-9_-]+$/);
  });
});

// ---------------------------------------------------------------------------
// codeVerifierCookieName
// ---------------------------------------------------------------------------
describe('codeVerifierCookieName()', () => {
  it('returns expected prefix + platform', () => {
    expect(codeVerifierCookieName('canva')).toBe('oauth_pkce_canva');
  });

  it('handles all four platforms', () => {
    for (const p of ['youtube', 'tiktok', 'facebook', 'canva']) {
      expect(codeVerifierCookieName(p)).toBe(`oauth_pkce_${p}`);
    }
  });
});
