import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { isOAuthPlatform } from '@/lib/oauth/types';
import {
  generateState,
  stateCookieName,
  generateCodeVerifier,
  codeChallengeFromVerifier,
  codeVerifierCookieName,
} from '@/lib/oauth/state';
import { getOAuthProvider } from '@/lib/oauth';
import { createHash } from 'crypto';

// ─── isOAuthPlatform ─────────────────────────────────────────────────────────

describe('isOAuthPlatform', () => {
  it('accepts "youtube"', () => expect(isOAuthPlatform('youtube')).toBe(true));
  it('accepts "tiktok"', () => expect(isOAuthPlatform('tiktok')).toBe(true));
  it('accepts "facebook"', () => expect(isOAuthPlatform('facebook')).toBe(true));
  it('accepts "canva"', () => expect(isOAuthPlatform('canva')).toBe(true));

  it('rejects "instagram"', () => expect(isOAuthPlatform('instagram')).toBe(false));
  it('rejects "twitter"', () => expect(isOAuthPlatform('twitter')).toBe(false));
  it('rejects "youtube_shorts"', () => expect(isOAuthPlatform('youtube_shorts')).toBe(false));
  it('rejects "facebook_reels"', () => expect(isOAuthPlatform('facebook_reels')).toBe(false));
  it('rejects empty string', () => expect(isOAuthPlatform('')).toBe(false));
  it('rejects random string', () => expect(isOAuthPlatform('notaplatform')).toBe(false));
  it('is case-sensitive — rejects "YouTube"', () => expect(isOAuthPlatform('YouTube')).toBe(false));
  it('is case-sensitive — rejects "TIKTOK"', () => expect(isOAuthPlatform('TIKTOK')).toBe(false));
});

// ─── generateState ────────────────────────────────────────────────────────────

describe('generateState', () => {
  it('returns a non-empty string', () => {
    expect(typeof generateState()).toBe('string');
    expect(generateState().length).toBeGreaterThan(0);
  });

  it('produces base64url characters only (no +, /, =)', () => {
    const state = generateState();
    expect(state).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  it('produces a string of length 32 (24 random bytes → base64url)', () => {
    // 24 bytes → ceil(24 * 4/3) = 32 chars in base64url (no padding)
    expect(generateState()).toHaveLength(32);
  });

  it('generates unique values on every call', () => {
    const states = Array.from({ length: 50 }, generateState);
    const unique = new Set(states);
    expect(unique.size).toBe(50);
  });
});

// ─── stateCookieName ─────────────────────────────────────────────────────────

describe('stateCookieName', () => {
  it('returns the expected cookie name pattern', () => {
    expect(stateCookieName('youtube')).toBe('oauth_state_youtube');
    expect(stateCookieName('tiktok')).toBe('oauth_state_tiktok');
    expect(stateCookieName('facebook')).toBe('oauth_state_facebook');
    expect(stateCookieName('canva')).toBe('oauth_state_canva');
  });

  it('works with arbitrary platform strings', () => {
    expect(stateCookieName('newplatform')).toBe('oauth_state_newplatform');
  });
});

// ─── generateCodeVerifier ────────────────────────────────────────────────────

describe('generateCodeVerifier', () => {
  it('returns a non-empty string', () => {
    expect(typeof generateCodeVerifier()).toBe('string');
    expect(generateCodeVerifier().length).toBeGreaterThan(0);
  });

  it('produces base64url characters only', () => {
    expect(generateCodeVerifier()).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  it('produces a string of length 43 (32 random bytes → base64url)', () => {
    // 32 bytes → 43 chars in base64url (floor(32 * 4/3) = 42, ceil = 43)
    expect(generateCodeVerifier()).toHaveLength(43);
  });

  it('generates unique values on every call', () => {
    const verifiers = Array.from({ length: 50 }, generateCodeVerifier);
    const unique = new Set(verifiers);
    expect(unique.size).toBe(50);
  });
});

// ─── codeChallengeFromVerifier ───────────────────────────────────────────────

describe('codeChallengeFromVerifier', () => {
  it('returns a non-empty string', () => {
    expect(typeof codeChallengeFromVerifier('verifier123')).toBe('string');
  });

  it('returns a base64url-encoded SHA-256 hash', () => {
    const verifier = 'myTestVerifier';
    const expected = createHash('sha256').update(verifier).digest('base64url');
    expect(codeChallengeFromVerifier(verifier)).toBe(expected);
  });

  it('is deterministic — same input always gives same output', () => {
    const v = 'aFixedVerifier_xyz';
    expect(codeChallengeFromVerifier(v)).toBe(codeChallengeFromVerifier(v));
  });

  it('produces different hashes for different inputs', () => {
    expect(codeChallengeFromVerifier('aaa')).not.toBe(codeChallengeFromVerifier('bbb'));
  });

  it('output is 43 chars (SHA-256 = 32 bytes → base64url without padding)', () => {
    expect(codeChallengeFromVerifier(generateCodeVerifier())).toHaveLength(43);
  });

  it('round-trip: verifier → challenge can be verified by a SHA-256 check', () => {
    const verifier = generateCodeVerifier();
    const challenge = codeChallengeFromVerifier(verifier);
    const recomputed = createHash('sha256').update(verifier).digest('base64url');
    expect(challenge).toBe(recomputed);
  });

  it('produces base64url characters only', () => {
    const challenge = codeChallengeFromVerifier(generateCodeVerifier());
    expect(challenge).toMatch(/^[A-Za-z0-9_-]+$/);
  });
});

// ─── codeVerifierCookieName ──────────────────────────────────────────────────

describe('codeVerifierCookieName', () => {
  it('returns the expected cookie name pattern', () => {
    expect(codeVerifierCookieName('canva')).toBe('oauth_pkce_canva');
    expect(codeVerifierCookieName('youtube')).toBe('oauth_pkce_youtube');
    expect(codeVerifierCookieName('tiktok')).toBe('oauth_pkce_tiktok');
  });

  it('works with arbitrary platform strings', () => {
    expect(codeVerifierCookieName('test')).toBe('oauth_pkce_test');
  });
});

// ─── getOAuthProvider ─────────────────────────────────────────────────────────

describe('getOAuthProvider', () => {
  it('returns a provider for "youtube"', () => {
    const p = getOAuthProvider('youtube');
    expect(p).toBeDefined();
    expect(typeof p.authorizationUrl).toBe('function');
    expect(typeof p.exchangeCode).toBe('function');
    expect(typeof p.refreshAccessToken).toBe('function');
  });

  it('returns a provider for "tiktok"', () => {
    const p = getOAuthProvider('tiktok');
    expect(p).toBeDefined();
    expect(typeof p.authorizationUrl).toBe('function');
  });

  it('returns a provider for "facebook"', () => {
    const p = getOAuthProvider('facebook');
    expect(p).toBeDefined();
    expect(typeof p.authorizationUrl).toBe('function');
  });

  it('returns a provider for "canva"', () => {
    const p = getOAuthProvider('canva');
    expect(p).toBeDefined();
    expect(typeof p.authorizationUrl).toBe('function');
  });

  it('canva provider requires PKCE', () => {
    expect(getOAuthProvider('canva').requiresPkce).toBe(true);
  });

  it('youtube provider does not require PKCE', () => {
    expect(getOAuthProvider('youtube').requiresPkce).toBe(false);
  });

  it('tiktok provider does not require PKCE', () => {
    expect(getOAuthProvider('tiktok').requiresPkce).toBe(false);
  });

  it('facebook provider does not require PKCE', () => {
    expect(getOAuthProvider('facebook').requiresPkce).toBe(false);
  });
});

// ─── authorizationUrl helpers ─────────────────────────────────────────────────

describe('provider.authorizationUrl', () => {
  const REDIRECT = 'https://app.example.com/api/oauth/callback';
  const STATE = 'teststate123';

  beforeEach(() => {
    process.env.YOUTUBE_OAUTH_CLIENT_ID = 'yt-client-id';
    process.env.YOUTUBE_OAUTH_CLIENT_SECRET = 'yt-secret';
    process.env.TIKTOK_OAUTH_CLIENT_KEY = 'tt-client-key';
    process.env.TIKTOK_OAUTH_CLIENT_SECRET = 'tt-secret';
    process.env.FACEBOOK_APP_ID = 'fb-app-id';
    process.env.FACEBOOK_APP_SECRET = 'fb-app-secret';
    process.env.CANVA_CLIENT_ID = 'canva-client-id';
    process.env.CANVA_CLIENT_SECRET = 'canva-secret';
  });

  afterEach(() => {
    delete process.env.YOUTUBE_OAUTH_CLIENT_ID;
    delete process.env.YOUTUBE_OAUTH_CLIENT_SECRET;
    delete process.env.TIKTOK_OAUTH_CLIENT_KEY;
    delete process.env.TIKTOK_OAUTH_CLIENT_SECRET;
    delete process.env.FACEBOOK_APP_ID;
    delete process.env.FACEBOOK_APP_SECRET;
    delete process.env.CANVA_CLIENT_ID;
    delete process.env.CANVA_CLIENT_SECRET;
  });

  describe('YouTube', () => {
    it('returns a URL pointing to Google accounts', () => {
      const url = getOAuthProvider('youtube').authorizationUrl({ state: STATE, redirectUri: REDIRECT });
      expect(url).toContain('accounts.google.com');
    });

    it('includes client_id param', () => {
      const url = getOAuthProvider('youtube').authorizationUrl({ state: STATE, redirectUri: REDIRECT });
      expect(url).toContain('client_id=yt-client-id');
    });

    it('includes the state param', () => {
      const url = getOAuthProvider('youtube').authorizationUrl({ state: STATE, redirectUri: REDIRECT });
      expect(url).toContain(`state=${STATE}`);
    });

    it('includes access_type=offline for refresh token', () => {
      const url = getOAuthProvider('youtube').authorizationUrl({ state: STATE, redirectUri: REDIRECT });
      expect(url).toContain('access_type=offline');
    });

    it('includes prompt=consent', () => {
      const url = getOAuthProvider('youtube').authorizationUrl({ state: STATE, redirectUri: REDIRECT });
      expect(url).toContain('prompt=consent');
    });

    it('includes scope with youtube.upload', () => {
      const url = getOAuthProvider('youtube').authorizationUrl({ state: STATE, redirectUri: REDIRECT });
      expect(url).toContain('youtube.upload');
    });

    it('includes redirect_uri', () => {
      const url = getOAuthProvider('youtube').authorizationUrl({ state: STATE, redirectUri: REDIRECT });
      expect(url).toContain(encodeURIComponent(REDIRECT));
    });

    it('throws if YOUTUBE_OAUTH_CLIENT_ID is missing', () => {
      delete process.env.YOUTUBE_OAUTH_CLIENT_ID;
      expect(() => getOAuthProvider('youtube').authorizationUrl({ state: STATE, redirectUri: REDIRECT }))
        .toThrow('YOUTUBE_OAUTH_CLIENT_ID');
    });
  });

  describe('TikTok', () => {
    it('returns a URL pointing to TikTok', () => {
      const url = getOAuthProvider('tiktok').authorizationUrl({ state: STATE, redirectUri: REDIRECT });
      expect(url).toContain('tiktok.com');
    });

    it('includes client_key param', () => {
      const url = getOAuthProvider('tiktok').authorizationUrl({ state: STATE, redirectUri: REDIRECT });
      expect(url).toContain('client_key=tt-client-key');
    });

    it('includes scope=video.publish', () => {
      const url = getOAuthProvider('tiktok').authorizationUrl({ state: STATE, redirectUri: REDIRECT });
      expect(url).toContain('video.publish');
    });

    it('includes the state param', () => {
      const url = getOAuthProvider('tiktok').authorizationUrl({ state: STATE, redirectUri: REDIRECT });
      expect(url).toContain(`state=${STATE}`);
    });

    it('throws if TIKTOK_OAUTH_CLIENT_KEY is missing', () => {
      delete process.env.TIKTOK_OAUTH_CLIENT_KEY;
      expect(() => getOAuthProvider('tiktok').authorizationUrl({ state: STATE, redirectUri: REDIRECT }))
        .toThrow('TIKTOK_OAUTH_CLIENT_KEY');
    });
  });

  describe('Facebook', () => {
    it('returns a URL pointing to Facebook dialog/oauth', () => {
      const url = getOAuthProvider('facebook').authorizationUrl({ state: STATE, redirectUri: REDIRECT });
      expect(url).toContain('facebook.com');
      expect(url).toContain('dialog/oauth');
    });

    it('includes client_id param', () => {
      const url = getOAuthProvider('facebook').authorizationUrl({ state: STATE, redirectUri: REDIRECT });
      expect(url).toContain('client_id=fb-app-id');
    });

    it('includes the state param', () => {
      const url = getOAuthProvider('facebook').authorizationUrl({ state: STATE, redirectUri: REDIRECT });
      expect(url).toContain(`state=${STATE}`);
    });

    it('includes pages_manage_posts scope', () => {
      const url = getOAuthProvider('facebook').authorizationUrl({ state: STATE, redirectUri: REDIRECT });
      expect(url).toContain('pages_manage_posts');
    });

    it('throws if FACEBOOK_APP_ID is missing', () => {
      delete process.env.FACEBOOK_APP_ID;
      expect(() => getOAuthProvider('facebook').authorizationUrl({ state: STATE, redirectUri: REDIRECT }))
        .toThrow('FACEBOOK_APP_ID');
    });
  });

  describe('Canva', () => {
    const CHALLENGE = 'E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM';

    it('returns a URL pointing to Canva', () => {
      const url = getOAuthProvider('canva').authorizationUrl({
        state: STATE,
        redirectUri: REDIRECT,
        codeChallenge: CHALLENGE,
      });
      expect(url).toContain('canva.com');
    });

    it('includes client_id param', () => {
      const url = getOAuthProvider('canva').authorizationUrl({
        state: STATE,
        redirectUri: REDIRECT,
        codeChallenge: CHALLENGE,
      });
      expect(url).toContain('client_id=canva-client-id');
    });

    it('includes the code_challenge param', () => {
      const url = getOAuthProvider('canva').authorizationUrl({
        state: STATE,
        redirectUri: REDIRECT,
        codeChallenge: CHALLENGE,
      });
      expect(url).toContain(`code_challenge=${CHALLENGE}`);
    });

    it('includes code_challenge_method=S256', () => {
      const url = getOAuthProvider('canva').authorizationUrl({
        state: STATE,
        redirectUri: REDIRECT,
        codeChallenge: CHALLENGE,
      });
      expect(url).toContain('code_challenge_method=S256');
    });

    it('sets code_challenge to empty string when not provided', () => {
      const url = getOAuthProvider('canva').authorizationUrl({ state: STATE, redirectUri: REDIRECT });
      expect(url).toContain('code_challenge=');
    });

    it('throws if CANVA_CLIENT_ID is missing', () => {
      delete process.env.CANVA_CLIENT_ID;
      expect(() =>
        getOAuthProvider('canva').authorizationUrl({ state: STATE, redirectUri: REDIRECT, codeChallenge: CHALLENGE })
      ).toThrow('CANVA_CLIENT_ID');
    });
  });
});
