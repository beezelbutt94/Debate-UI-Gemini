import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { getOAuthProvider } from '@/lib/oauth';

// Store and restore env vars around each test
const originalEnv = { ...process.env };
afterEach(() => {
  Object.assign(process.env, originalEnv);
  // Remove any keys that were added in a test but not in original
  for (const key of Object.keys(process.env)) {
    if (!(key in originalEnv)) delete process.env[key];
  }
  vi.unstubAllEnvs();
});

function setYouTubeEnv() {
  process.env.YOUTUBE_OAUTH_CLIENT_ID = 'yt_client_id';
  process.env.YOUTUBE_OAUTH_CLIENT_SECRET = 'yt_client_secret';
}

function setTikTokEnv() {
  process.env.TIKTOK_OAUTH_CLIENT_KEY = 'tt_client_key';
  process.env.TIKTOK_OAUTH_CLIENT_SECRET = 'tt_client_secret';
}

function setFacebookEnv() {
  process.env.FACEBOOK_APP_ID = 'fb_app_id';
  process.env.FACEBOOK_APP_SECRET = 'fb_app_secret';
}

function setCanvaEnv() {
  process.env.CANVA_CLIENT_ID = 'canva_client_id';
  process.env.CANVA_CLIENT_SECRET = 'canva_client_secret';
}

describe('youtubeProvider.authorizationUrl', () => {
  beforeEach(setYouTubeEnv);

  it('returns a valid URL', () => {
    const provider = getOAuthProvider('youtube');
    const url = provider.authorizationUrl({ state: 'my_state', redirectUri: 'https://app.example.com/callback' });
    expect(() => new URL(url)).not.toThrow();
  });

  it('targets Google accounts endpoint', () => {
    const url = getOAuthProvider('youtube').authorizationUrl({ state: 's', redirectUri: 'https://r.example.com' });
    expect(url).toContain('accounts.google.com');
  });

  it('includes client_id from env', () => {
    const url = getOAuthProvider('youtube').authorizationUrl({ state: 's', redirectUri: 'https://r.example.com' });
    expect(url).toContain('yt_client_id');
  });

  it('sets response_type=code', () => {
    const url = getOAuthProvider('youtube').authorizationUrl({ state: 's', redirectUri: 'https://r.example.com' });
    expect(url).toContain('response_type=code');
  });

  it('requests offline access (for refresh token)', () => {
    const url = getOAuthProvider('youtube').authorizationUrl({ state: 's', redirectUri: 'https://r.example.com' });
    expect(url).toContain('access_type=offline');
  });

  it('forces consent prompt', () => {
    const url = getOAuthProvider('youtube').authorizationUrl({ state: 's', redirectUri: 'https://r.example.com' });
    expect(url).toContain('prompt=consent');
  });

  it('includes the state parameter', () => {
    const url = getOAuthProvider('youtube').authorizationUrl({ state: 'unique_state_123', redirectUri: 'https://r.example.com' });
    expect(url).toContain('unique_state_123');
  });

  it('includes the redirect_uri', () => {
    const url = getOAuthProvider('youtube').authorizationUrl({ state: 's', redirectUri: 'https://redirect.example.com/cb' });
    expect(url).toContain(encodeURIComponent('https://redirect.example.com/cb'));
  });

  it('includes the YouTube upload scope', () => {
    const url = getOAuthProvider('youtube').authorizationUrl({ state: 's', redirectUri: 'https://r.example.com' });
    expect(url).toContain('youtube.upload');
  });

  it('throws when YOUTUBE_OAUTH_CLIENT_ID is missing', () => {
    delete process.env.YOUTUBE_OAUTH_CLIENT_ID;
    expect(() =>
      getOAuthProvider('youtube').authorizationUrl({ state: 's', redirectUri: 'https://r.example.com' })
    ).toThrow('YOUTUBE_OAUTH_CLIENT_ID');
  });
});

describe('tiktokProvider.authorizationUrl', () => {
  beforeEach(setTikTokEnv);

  it('returns a valid URL', () => {
    const url = getOAuthProvider('tiktok').authorizationUrl({ state: 's', redirectUri: 'https://r.example.com' });
    expect(() => new URL(url)).not.toThrow();
  });

  it('targets TikTok authorization endpoint', () => {
    const url = getOAuthProvider('tiktok').authorizationUrl({ state: 's', redirectUri: 'https://r.example.com' });
    expect(url).toContain('tiktok.com');
  });

  it('includes the client_key', () => {
    const url = getOAuthProvider('tiktok').authorizationUrl({ state: 's', redirectUri: 'https://r.example.com' });
    expect(url).toContain('tt_client_key');
  });

  it('requests video.publish scope', () => {
    const url = getOAuthProvider('tiktok').authorizationUrl({ state: 's', redirectUri: 'https://r.example.com' });
    expect(url).toContain('video.publish');
  });

  it('includes state', () => {
    const url = getOAuthProvider('tiktok').authorizationUrl({ state: 'tiktok_state', redirectUri: 'https://r.example.com' });
    expect(url).toContain('tiktok_state');
  });

  it('throws when TIKTOK_OAUTH_CLIENT_KEY is missing', () => {
    delete process.env.TIKTOK_OAUTH_CLIENT_KEY;
    expect(() =>
      getOAuthProvider('tiktok').authorizationUrl({ state: 's', redirectUri: 'https://r.example.com' })
    ).toThrow('TIKTOK_OAUTH_CLIENT_KEY');
  });
});

describe('facebookProvider.authorizationUrl', () => {
  beforeEach(setFacebookEnv);

  it('returns a valid URL', () => {
    const url = getOAuthProvider('facebook').authorizationUrl({ state: 's', redirectUri: 'https://r.example.com' });
    expect(() => new URL(url)).not.toThrow();
  });

  it('targets Facebook OAuth endpoint', () => {
    const url = getOAuthProvider('facebook').authorizationUrl({ state: 's', redirectUri: 'https://r.example.com' });
    expect(url).toContain('facebook.com');
  });

  it('includes the app id', () => {
    const url = getOAuthProvider('facebook').authorizationUrl({ state: 's', redirectUri: 'https://r.example.com' });
    expect(url).toContain('fb_app_id');
  });

  it('requests page-related scopes', () => {
    const url = getOAuthProvider('facebook').authorizationUrl({ state: 's', redirectUri: 'https://r.example.com' });
    expect(url).toContain('pages_show_list');
  });

  it('includes state', () => {
    const url = getOAuthProvider('facebook').authorizationUrl({ state: 'fb_state_xyz', redirectUri: 'https://r.example.com' });
    expect(url).toContain('fb_state_xyz');
  });

  it('sets response_type=code', () => {
    const url = getOAuthProvider('facebook').authorizationUrl({ state: 's', redirectUri: 'https://r.example.com' });
    expect(url).toContain('response_type=code');
  });

  it('throws when FACEBOOK_APP_ID is missing', () => {
    delete process.env.FACEBOOK_APP_ID;
    expect(() =>
      getOAuthProvider('facebook').authorizationUrl({ state: 's', redirectUri: 'https://r.example.com' })
    ).toThrow('FACEBOOK_APP_ID');
  });
});

describe('canvaProvider.authorizationUrl', () => {
  beforeEach(setCanvaEnv);

  it('returns a valid URL', () => {
    const url = getOAuthProvider('canva').authorizationUrl({
      state: 's',
      redirectUri: 'https://r.example.com',
      codeChallenge: 'challenge_abc',
    });
    expect(() => new URL(url)).not.toThrow();
  });

  it('targets Canva OAuth endpoint', () => {
    const url = getOAuthProvider('canva').authorizationUrl({
      state: 's',
      redirectUri: 'https://r.example.com',
      codeChallenge: 'ch',
    });
    expect(url).toContain('canva.com');
  });

  it('includes the client_id', () => {
    const url = getOAuthProvider('canva').authorizationUrl({
      state: 's',
      redirectUri: 'https://r.example.com',
      codeChallenge: 'ch',
    });
    expect(url).toContain('canva_client_id');
  });

  it('sets code_challenge_method=S256', () => {
    const url = getOAuthProvider('canva').authorizationUrl({
      state: 's',
      redirectUri: 'https://r.example.com',
      codeChallenge: 'my_challenge',
    });
    expect(url).toContain('code_challenge_method=S256');
  });

  it('includes the code_challenge', () => {
    const url = getOAuthProvider('canva').authorizationUrl({
      state: 's',
      redirectUri: 'https://r.example.com',
      codeChallenge: 'my_challenge_value',
    });
    expect(url).toContain('my_challenge_value');
  });

  it('includes scope with design:content:write', () => {
    const url = getOAuthProvider('canva').authorizationUrl({
      state: 's',
      redirectUri: 'https://r.example.com',
      codeChallenge: 'ch',
    });
    expect(url).toContain('design%3Acontent%3Awrite');
  });

  it('includes state', () => {
    const url = getOAuthProvider('canva').authorizationUrl({
      state: 'canva_unique_state',
      redirectUri: 'https://r.example.com',
      codeChallenge: 'ch',
    });
    expect(url).toContain('canva_unique_state');
  });

  it('throws when CANVA_CLIENT_ID is missing', () => {
    delete process.env.CANVA_CLIENT_ID;
    expect(() =>
      getOAuthProvider('canva').authorizationUrl({ state: 's', redirectUri: 'https://r.example.com', codeChallenge: 'ch' })
    ).toThrow('CANVA_CLIENT_ID');
  });
});
