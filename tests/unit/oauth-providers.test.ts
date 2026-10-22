import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { youtubeProvider } from '@/lib/oauth/youtube';
import { tiktokProvider } from '@/lib/oauth/tiktok';
import { facebookProvider } from '@/lib/oauth/facebook';
import { canvaProvider } from '@/lib/oauth/canva';

const origEnv = { ...process.env };

beforeEach(() => {
  // Stub all required env vars for each provider
  process.env.YOUTUBE_OAUTH_CLIENT_ID = 'yt-client-id';
  process.env.YOUTUBE_OAUTH_CLIENT_SECRET = 'yt-client-secret';
  process.env.TIKTOK_OAUTH_CLIENT_KEY = 'tt-client-key';
  process.env.TIKTOK_OAUTH_CLIENT_SECRET = 'tt-client-secret';
  process.env.FACEBOOK_APP_ID = 'fb-app-id';
  process.env.FACEBOOK_APP_SECRET = 'fb-app-secret';
  process.env.CANVA_CLIENT_ID = 'canva-client-id';
  process.env.CANVA_CLIENT_SECRET = 'canva-client-secret';
});

afterEach(() => {
  vi.restoreAllMocks();
  process.env = { ...origEnv };
});

// ── YouTube provider ───────────────────────────────────────────────────────────

describe('youtubeProvider.authorizationUrl', () => {
  it('returns a Google OAuth URL', () => {
    const url = youtubeProvider.authorizationUrl({
      state: 'mystate',
      redirectUri: 'https://app.example.com/callback',
    });
    expect(url).toContain('accounts.google.com');
    expect(url).toContain('state=mystate');
    expect(url).toContain('client_id=yt-client-id');
    expect(url).toContain('response_type=code');
    expect(url).toContain('access_type=offline');
    expect(url).toContain('prompt=consent');
  });

  it('throws when YOUTUBE_OAUTH_CLIENT_ID is missing', () => {
    delete process.env.YOUTUBE_OAUTH_CLIENT_ID;
    expect(() => youtubeProvider.authorizationUrl({ state: 's', redirectUri: 'https://r.com' })).toThrow(
      /YOUTUBE_OAUTH_CLIENT_ID/
    );
  });
});

// ── TikTok provider ───────────────────────────────────────────────────────────

describe('tiktokProvider.authorizationUrl', () => {
  it('returns a TikTok authorization URL', () => {
    const url = tiktokProvider.authorizationUrl({
      state: 'ttstate',
      redirectUri: 'https://app.example.com/callback/tiktok',
    });
    expect(url).toContain('tiktok.com');
    expect(url).toContain('state=ttstate');
    expect(url).toContain('client_key=tt-client-key');
    expect(url).toContain('response_type=code');
  });

  it('throws when TIKTOK_OAUTH_CLIENT_KEY is missing', () => {
    delete process.env.TIKTOK_OAUTH_CLIENT_KEY;
    expect(() =>
      tiktokProvider.authorizationUrl({ state: 's', redirectUri: 'https://r.com' })
    ).toThrow(/TIKTOK_OAUTH_CLIENT_KEY/);
  });
});

// ── Facebook provider ─────────────────────────────────────────────────────────

describe('facebookProvider.authorizationUrl', () => {
  it('returns a Facebook dialog/oauth URL', () => {
    const url = facebookProvider.authorizationUrl({
      state: 'fbstate',
      redirectUri: 'https://app.example.com/callback/facebook',
    });
    expect(url).toContain('facebook.com');
    expect(url).toContain('dialog/oauth');
    expect(url).toContain('state=fbstate');
    expect(url).toContain('client_id=fb-app-id');
    expect(url).toContain('response_type=code');
  });

  it('throws when FACEBOOK_APP_ID is missing', () => {
    delete process.env.FACEBOOK_APP_ID;
    expect(() =>
      facebookProvider.authorizationUrl({ state: 's', redirectUri: 'https://r.com' })
    ).toThrow(/FACEBOOK_APP_ID/);
  });
});

// ── Canva provider ────────────────────────────────────────────────────────────

describe('canvaProvider.authorizationUrl', () => {
  it('returns a Canva authorize URL with PKCE params', () => {
    const url = canvaProvider.authorizationUrl({
      state: 'canvastate',
      redirectUri: 'https://app.example.com/callback/canva',
      codeChallenge: 'mychallenge',
    });
    expect(url).toContain('canva.com');
    expect(url).toContain('state=canvastate');
    expect(url).toContain('client_id=canva-client-id');
    expect(url).toContain('code_challenge=mychallenge');
    expect(url).toContain('code_challenge_method=S256');
  });

  it('requiresPkce is true', () => {
    expect(canvaProvider.requiresPkce).toBe(true);
  });

  it('throws when CANVA_CLIENT_ID is missing', () => {
    delete process.env.CANVA_CLIENT_ID;
    expect(() =>
      canvaProvider.authorizationUrl({ state: 's', redirectUri: 'https://r.com', codeChallenge: 'c' })
    ).toThrow(/CANVA_CLIENT_ID/);
  });
});
