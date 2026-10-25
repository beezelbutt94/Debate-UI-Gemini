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

describe('generateState()', () => {
  test('returns a string', () => {
    assert.equal(typeof generateState(), 'string');
  });

  test('returns a non-empty string', () => {
    assert.ok(generateState().length > 0);
  });

  test('returns a base64url-safe string (no +, /, or =)', () => {
    const state = generateState();
    assert.ok(!/[+/=]/.test(state), `Expected base64url safe string, got: ${state}`);
  });

  test('returns unique values on successive calls', () => {
    const a = generateState();
    const b = generateState();
    assert.notEqual(a, b);
  });

  test('returns a string of reasonable length (32 bytes → ~43 chars in base64url)', () => {
    const state = generateState();
    // 24 bytes base64url → 32 chars
    assert.ok(state.length >= 30 && state.length <= 50, `Length ${state.length} out of expected range`);
  });
});

describe('stateCookieName()', () => {
  test('returns oauth_state_ prefixed string for youtube', () => {
    assert.equal(stateCookieName('youtube'), 'oauth_state_youtube');
  });

  test('returns oauth_state_ prefixed string for tiktok', () => {
    assert.equal(stateCookieName('tiktok'), 'oauth_state_tiktok');
  });

  test('returns oauth_state_ prefixed string for facebook', () => {
    assert.equal(stateCookieName('facebook'), 'oauth_state_facebook');
  });

  test('returns oauth_state_ prefixed string for canva', () => {
    assert.equal(stateCookieName('canva'), 'oauth_state_canva');
  });

  test('includes the platform name in the cookie name', () => {
    const name = stateCookieName('someplatform');
    assert.ok(name.includes('someplatform'), name);
  });
});

describe('generateCodeVerifier()', () => {
  test('returns a non-empty string', () => {
    assert.ok(generateCodeVerifier().length > 0);
  });

  test('returns a base64url-safe string (no +, /, or =)', () => {
    const verifier = generateCodeVerifier();
    assert.ok(!/[+/=]/.test(verifier), `Expected base64url safe string, got: ${verifier}`);
  });

  test('returns unique values on successive calls', () => {
    const a = generateCodeVerifier();
    const b = generateCodeVerifier();
    assert.notEqual(a, b);
  });

  test('length appropriate for 32 random bytes in base64url (~43 chars)', () => {
    const verifier = generateCodeVerifier();
    assert.ok(verifier.length >= 40 && verifier.length <= 50, `Length ${verifier.length} out of expected range`);
  });
});

describe('codeChallengeFromVerifier()', () => {
  test('produces consistent SHA-256 base64url digest of the verifier', () => {
    const verifier = 'test_verifier_string';
    const expected = createHash('sha256').update(verifier).digest('base64url');
    assert.equal(codeChallengeFromVerifier(verifier), expected);
  });

  test('returns a non-empty string', () => {
    assert.ok(codeChallengeFromVerifier('anything').length > 0);
  });

  test('same input always produces same output (deterministic)', () => {
    const v = 'deterministic_test';
    assert.equal(codeChallengeFromVerifier(v), codeChallengeFromVerifier(v));
  });

  test('different inputs produce different outputs', () => {
    assert.notEqual(
      codeChallengeFromVerifier('verifier_a'),
      codeChallengeFromVerifier('verifier_b')
    );
  });

  test('output is base64url-safe (no +, /, or =)', () => {
    const challenge = codeChallengeFromVerifier(generateCodeVerifier());
    assert.ok(!/[+/=]/.test(challenge), `Expected base64url safe string, got: ${challenge}`);
  });

  test('roundtrips correctly for a real PKCE verifier', () => {
    const verifier = generateCodeVerifier();
    const challenge = codeChallengeFromVerifier(verifier);
    const independent = createHash('sha256').update(verifier).digest('base64url');
    assert.equal(challenge, independent);
  });
});

describe('codeVerifierCookieName()', () => {
  test('returns oauth_pkce_ prefixed string for canva', () => {
    assert.equal(codeVerifierCookieName('canva'), 'oauth_pkce_canva');
  });

  test('returns oauth_pkce_ prefixed string for youtube', () => {
    assert.equal(codeVerifierCookieName('youtube'), 'oauth_pkce_youtube');
  });

  test('includes the platform name', () => {
    const name = codeVerifierCookieName('myplatform');
    assert.ok(name.includes('myplatform'), name);
  });

  test('is different from state cookie name for same platform', () => {
    assert.notEqual(stateCookieName('canva'), codeVerifierCookieName('canva'));
  });
});
