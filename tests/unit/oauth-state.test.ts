import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  generateState,
  stateCookieName,
  generateCodeVerifier,
  codeChallengeFromVerifier,
  codeVerifierCookieName,
} from '../../lib/oauth/state.ts';
import { createHash } from 'node:crypto';

describe('generateState', () => {
  test('returns a non-empty string', () => {
    const s = generateState();
    assert.ok(typeof s === 'string' && s.length > 0);
  });

  test('returns a base64url string (no +, /, = characters)', () => {
    const s = generateState();
    assert.ok(/^[A-Za-z0-9_-]+$/.test(s), `"${s}" contains invalid base64url chars`);
  });

  test('returns different values on each call (uniqueness)', () => {
    const states = new Set(Array.from({ length: 10 }, () => generateState()));
    assert.equal(states.size, 10, 'Expected 10 unique state values');
  });

  test('has sufficient length (>=24 bytes → >=32 base64url chars)', () => {
    const s = generateState();
    assert.ok(s.length >= 32, `State too short: ${s.length}`);
  });
});

describe('stateCookieName', () => {
  test('returns correct name for youtube', () => {
    assert.equal(stateCookieName('youtube'), 'oauth_state_youtube');
  });

  test('returns correct name for tiktok', () => {
    assert.equal(stateCookieName('tiktok'), 'oauth_state_tiktok');
  });

  test('returns correct name for facebook', () => {
    assert.equal(stateCookieName('facebook'), 'oauth_state_facebook');
  });

  test('returns correct name for canva', () => {
    assert.equal(stateCookieName('canva'), 'oauth_state_canva');
  });

  test('uses the platform verbatim as suffix', () => {
    const platform = 'custom_platform';
    assert.equal(stateCookieName(platform), `oauth_state_${platform}`);
  });
});

describe('generateCodeVerifier', () => {
  test('returns a non-empty string', () => {
    const v = generateCodeVerifier();
    assert.ok(typeof v === 'string' && v.length > 0);
  });

  test('returns a base64url string (no +, /, = characters)', () => {
    const v = generateCodeVerifier();
    assert.ok(/^[A-Za-z0-9_-]+$/.test(v), `"${v}" contains invalid base64url chars`);
  });

  test('returns different values on each call', () => {
    const verifiers = new Set(Array.from({ length: 10 }, () => generateCodeVerifier()));
    assert.equal(verifiers.size, 10, 'Expected 10 unique code verifiers');
  });

  test('has sufficient length (32 bytes → >=43 base64url chars, RFC 7636 min 43)', () => {
    const v = generateCodeVerifier();
    // 32 raw bytes → 43 base64url chars (no padding)
    assert.ok(v.length >= 43, `Verifier too short for PKCE: ${v.length}`);
  });
});

describe('codeChallengeFromVerifier', () => {
  test('returns a non-empty base64url string', () => {
    const verifier = generateCodeVerifier();
    const challenge = codeChallengeFromVerifier(verifier);
    assert.ok(/^[A-Za-z0-9_-]+$/.test(challenge));
  });

  test('produces SHA-256 of the verifier encoded as base64url', () => {
    const verifier = 'test-verifier-value';
    const expected = createHash('sha256').update(verifier).digest('base64url');
    assert.equal(codeChallengeFromVerifier(verifier), expected);
  });

  test('SHA-256 base64url output is always 43 chars (256 bits / 6 = 43)', () => {
    const challenge = codeChallengeFromVerifier(generateCodeVerifier());
    assert.equal(challenge.length, 43, `S256 challenge should be 43 chars, got ${challenge.length}`);
  });

  test('same verifier always produces same challenge (deterministic)', () => {
    const verifier = 'fixed-verifier';
    assert.equal(
      codeChallengeFromVerifier(verifier),
      codeChallengeFromVerifier(verifier)
    );
  });

  test('different verifiers produce different challenges', () => {
    const c1 = codeChallengeFromVerifier('verifier-one');
    const c2 = codeChallengeFromVerifier('verifier-two');
    assert.notEqual(c1, c2);
  });

  test('empty verifier still returns a 43-char challenge', () => {
    const challenge = codeChallengeFromVerifier('');
    assert.equal(challenge.length, 43);
  });
});

describe('codeVerifierCookieName', () => {
  test('returns correct name for canva', () => {
    assert.equal(codeVerifierCookieName('canva'), 'oauth_pkce_canva');
  });

  test('returns correct name for youtube', () => {
    assert.equal(codeVerifierCookieName('youtube'), 'oauth_pkce_youtube');
  });

  test('uses the platform verbatim as suffix', () => {
    const platform = 'test_platform';
    assert.equal(codeVerifierCookieName(platform), `oauth_pkce_${platform}`);
  });
});
