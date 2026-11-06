import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { getOAuthProvider } from '@/lib/oauth';

// ─── getOAuthProvider ─────────────────────────────────────────────────────────

describe('getOAuthProvider()', () => {
  it('returns a defined provider for youtube', () => {
    expect(getOAuthProvider('youtube')).toBeDefined();
  });

  it('returns a defined provider for tiktok', () => {
    expect(getOAuthProvider('tiktok')).toBeDefined();
  });

  it('returns a defined provider for facebook', () => {
    expect(getOAuthProvider('facebook')).toBeDefined();
  });

  it('returns a defined provider for canva', () => {
    expect(getOAuthProvider('canva')).toBeDefined();
  });

  it('returns different objects for different platforms', () => {
    expect(getOAuthProvider('youtube')).not.toBe(getOAuthProvider('tiktok'));
  });

  it('returns the same object on repeated calls (singleton)', () => {
    expect(getOAuthProvider('youtube')).toBe(getOAuthProvider('youtube'));
  });
});

// ─── requiresPkce flags ───────────────────────────────────────────────────────

describe('requiresPkce flags', () => {
  it('youtube provider does NOT require PKCE', () => {
    expect(getOAuthProvider('youtube').requiresPkce).toBe(false);
  });

  it('tiktok provider does NOT require PKCE', () => {
    expect(getOAuthProvider('tiktok').requiresPkce).toBe(false);
  });

  it('facebook provider does NOT require PKCE', () => {
    expect(getOAuthProvider('facebook').requiresPkce).toBe(false);
  });

  it('canva provider DOES require PKCE', () => {
    expect(getOAuthProvider('canva').requiresPkce).toBe(true);
  });
});

// ─── Shared env-var management ────────────────────────────────────────────────

function withEnv(vars: Record<string, string>) {
  const saved: Record<string, string | undefined> = {};
  beforeEach(() => {
    for (const [k, v] of Object.entries(vars)) {
      saved[k] = process.env[k];
      process.env[k] = v;
    }
  });
  afterEach(() => {
    for (const [k, v] of Object.entries(saved)) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
  });
}

// ─── youtubeProvider.authorizationUrl ────────────────────────────────────────

describe('youtubeProvider.authorizationUrl()', () => {
  withEnv({ YOUTUBE_OAUTH_CLIENT_ID: 'yt-client-id' });

  const params = { state: 'test-state', redirectUri: 'https://example.com/callback' };

  it('returns a URL starting with accounts.google.com', () => {
    const url = getOAuthProvider('youtube').authorizationUrl(params);
    expect(url).toMatch(/^https:\/\/accounts\.google\.com\//);
  });

  it('contains the state parameter', () => {
    const url = getOAuthProvider('youtube').authorizationUrl({ ...params, state: 'my-csrf-token' });
    expect(url).toContain('state=my-csrf-token');
  });

  it('encodes the redirect_uri', () => {
    const url = getOAuthProvider('youtube').authorizationUrl(params);
    expect(url).toContain('redirect_uri=');
    expect(url).toContain(encodeURIComponent('https://example.com/callback'));
  });

  it('requests offline access', () => {
    expect(getOAuthProvider('youtube').authorizationUrl(params)).toContain('access_type=offline');
  });

  it('forces consent prompt', () => {
    expect(getOAuthProvider('youtube').authorizationUrl(params)).toContain('prompt=consent');
  });

  it('includes the youtube.upload scope', () => {
    expect(getOAuthProvider('youtube').authorizationUrl(params)).toContain('youtube.upload');
  });

  it('uses code as the response_type', () => {
    expect(getOAuthProvider('youtube').authorizationUrl(params)).toContain('response_type=code');
  });

  it('throws when YOUTUBE_OAUTH_CLIENT_ID is unset', () => {
    delete process.env.YOUTUBE_OAUTH_CLIENT_ID;
    expect(() => getOAuthProvider('youtube').authorizationUrl(params)).toThrow(/YOUTUBE_OAUTH_CLIENT_ID/);
  });
});

// ─── tiktokProvider.authorizationUrl ─────────────────────────────────────────

describe('tiktokProvider.authorizationUrl()', () => {
  withEnv({ TIKTOK_OAUTH_CLIENT_KEY: 'tiktok-client-key' });

  const params = { state: 'test-state', redirectUri: 'https://example.com/callback' };

  it('returns a URL on tiktok.com', () => {
    expect(getOAuthProvider('tiktok').authorizationUrl(params)).toMatch(/^https:\/\/www\.tiktok\.com\//);
  });

  it('contains the state parameter', () => {
    const url = getOAuthProvider('tiktok').authorizationUrl({ ...params, state: 'csrf-xyz' });
    expect(url).toContain('state=csrf-xyz');
  });

  it('requests video.publish scope', () => {
    expect(getOAuthProvider('tiktok').authorizationUrl(params)).toContain('scope=video.publish');
  });

  it('uses code response_type', () => {
    expect(getOAuthProvider('tiktok').authorizationUrl(params)).toContain('response_type=code');
  });

  it('throws when TIKTOK_OAUTH_CLIENT_KEY is unset', () => {
    delete process.env.TIKTOK_OAUTH_CLIENT_KEY;
    expect(() => getOAuthProvider('tiktok').authorizationUrl(params)).toThrow(/TIKTOK_OAUTH_CLIENT_KEY/);
  });
});

// ─── facebookProvider.authorizationUrl ───────────────────────────────────────

describe('facebookProvider.authorizationUrl()', () => {
  withEnv({ FACEBOOK_APP_ID: 'fb-app-id' });

  const params = { state: 'test-state', redirectUri: 'https://example.com/callback' };

  it('returns a URL on facebook.com', () => {
    expect(getOAuthProvider('facebook').authorizationUrl(params)).toMatch(/^https:\/\/www\.facebook\.com\//);
  });

  it('contains the state parameter', () => {
    const url = getOAuthProvider('facebook').authorizationUrl({ ...params, state: 'fb-csrf' });
    expect(url).toContain('state=fb-csrf');
  });

  it('includes pages_show_list in scope', () => {
    expect(decodeURIComponent(getOAuthProvider('facebook').authorizationUrl(params))).toContain(
      'pages_show_list'
    );
  });

  it('includes pages_manage_posts in scope', () => {
    expect(decodeURIComponent(getOAuthProvider('facebook').authorizationUrl(params))).toContain(
      'pages_manage_posts'
    );
  });

  it('uses code response_type', () => {
    expect(getOAuthProvider('facebook').authorizationUrl(params)).toContain('response_type=code');
  });

  it('throws when FACEBOOK_APP_ID is unset', () => {
    delete process.env.FACEBOOK_APP_ID;
    expect(() => getOAuthProvider('facebook').authorizationUrl(params)).toThrow(/FACEBOOK_APP_ID/);
  });
});

// ─── canvaProvider.authorizationUrl ──────────────────────────────────────────

describe('canvaProvider.authorizationUrl()', () => {
  withEnv({ CANVA_CLIENT_ID: 'canva-client-id' });

  const params = {
    state: 'test-state',
    redirectUri: 'https://example.com/callback',
    codeChallenge: 'test-challenge',
  };

  it('returns a URL on canva.com', () => {
    expect(getOAuthProvider('canva').authorizationUrl(params)).toMatch(/^https:\/\/www\.canva\.com\//);
  });

  it('contains the state parameter', () => {
    const url = getOAuthProvider('canva').authorizationUrl({ ...params, state: 'canva-csrf' });
    expect(url).toContain('state=canva-csrf');
  });

  it('includes the code_challenge', () => {
    const url = getOAuthProvider('canva').authorizationUrl({ ...params, codeChallenge: 'my-challenge' });
    expect(url).toContain('code_challenge=my-challenge');
  });

  it('uses S256 code_challenge_method', () => {
    expect(getOAuthProvider('canva').authorizationUrl(params)).toContain('code_challenge_method=S256');
  });

  it('requests design:content:write scope', () => {
    const url = decodeURIComponent(getOAuthProvider('canva').authorizationUrl(params));
    expect(url).toContain('design:content:write');
  });

  it('requests profile:read scope', () => {
    const url = decodeURIComponent(getOAuthProvider('canva').authorizationUrl(params));
    expect(url).toContain('profile:read');
  });

  it('uses code response_type', () => {
    expect(getOAuthProvider('canva').authorizationUrl(params)).toContain('response_type=code');
  });

  it('throws when CANVA_CLIENT_ID is unset', () => {
    delete process.env.CANVA_CLIENT_ID;
    expect(() => getOAuthProvider('canva').authorizationUrl(params)).toThrow(/CANVA_CLIENT_ID/);
  });
});
