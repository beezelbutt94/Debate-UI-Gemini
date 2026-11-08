import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { youtubeProvider } from '@/lib/oauth/youtube';
import { tiktokProvider } from '@/lib/oauth/tiktok';
import { facebookProvider } from '@/lib/oauth/facebook';
import { canvaProvider } from '@/lib/oauth/canva';
import { getOAuthProvider } from '@/lib/oauth/index';

// Store originals so we can restore them after each test
const originalEnv: Record<string, string | undefined> = {};

function setEnv(key: string, value: string) {
  originalEnv[key] = process.env[key];
  process.env[key] = value;
}

function restoreEnv() {
  for (const [key, value] of Object.entries(originalEnv)) {
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }
  Object.keys(originalEnv).forEach((k) => delete originalEnv[k]);
}

afterEach(restoreEnv);

describe('youtubeProvider', () => {
  beforeEach(() => {
    setEnv('YOUTUBE_OAUTH_CLIENT_ID', 'yt-client-id');
  });

  it('requiresPkce is false', () => {
    expect(youtubeProvider.requiresPkce).toBe(false);
  });

  it('builds a valid authorization URL', () => {
    const url = youtubeProvider.authorizationUrl({
      state: 'test-state',
      redirectUri: 'https://app.example.com/oauth/youtube/callback',
    });
    expect(url).toContain('accounts.google.com');
    expect(url).toContain('client_id=yt-client-id');
    expect(url).toContain('state=test-state');
    expect(url).toContain('response_type=code');
    expect(url).toContain('access_type=offline');
    expect(url).toContain('prompt=consent');
  });

  it('URL contains redirect_uri', () => {
    const redirectUri = 'https://app.example.com/oauth/youtube/callback';
    const url = youtubeProvider.authorizationUrl({ state: 's', redirectUri });
    expect(url).toContain(encodeURIComponent(redirectUri));
  });

  it('URL contains youtube.upload scope', () => {
    const url = youtubeProvider.authorizationUrl({ state: 's', redirectUri: 'https://r.test/cb' });
    expect(url).toContain('youtube.upload');
  });

  it('throws when env var is missing', () => {
    delete process.env.YOUTUBE_OAUTH_CLIENT_ID;
    expect(() =>
      youtubeProvider.authorizationUrl({ state: 's', redirectUri: 'https://r.test/cb' })
    ).toThrow('YOUTUBE_OAUTH_CLIENT_ID');
  });
});

describe('tiktokProvider', () => {
  beforeEach(() => {
    setEnv('TIKTOK_OAUTH_CLIENT_KEY', 'tt-client-key');
  });

  it('requiresPkce is false', () => {
    expect(tiktokProvider.requiresPkce).toBe(false);
  });

  it('builds a valid authorization URL', () => {
    const url = tiktokProvider.authorizationUrl({
      state: 'test-state',
      redirectUri: 'https://app.example.com/oauth/tiktok/callback',
    });
    expect(url).toContain('tiktok.com');
    expect(url).toContain('client_key=tt-client-key');
    expect(url).toContain('state=test-state');
    expect(url).toContain('response_type=code');
    expect(url).toContain('video.publish');
  });

  it('URL contains redirect_uri', () => {
    const redirectUri = 'https://app.example.com/oauth/tiktok/callback';
    const url = tiktokProvider.authorizationUrl({ state: 's', redirectUri });
    expect(url).toContain(encodeURIComponent(redirectUri));
  });

  it('throws when env var is missing', () => {
    delete process.env.TIKTOK_OAUTH_CLIENT_KEY;
    expect(() =>
      tiktokProvider.authorizationUrl({ state: 's', redirectUri: 'https://r.test/cb' })
    ).toThrow('TIKTOK_OAUTH_CLIENT_KEY');
  });
});

describe('facebookProvider', () => {
  beforeEach(() => {
    setEnv('FACEBOOK_APP_ID', 'fb-app-id');
  });

  it('requiresPkce is false', () => {
    expect(facebookProvider.requiresPkce).toBe(false);
  });

  it('builds a valid authorization URL', () => {
    const url = facebookProvider.authorizationUrl({
      state: 'test-state',
      redirectUri: 'https://app.example.com/oauth/facebook/callback',
    });
    expect(url).toContain('facebook.com');
    expect(url).toContain('client_id=fb-app-id');
    expect(url).toContain('state=test-state');
    expect(url).toContain('response_type=code');
    expect(url).toContain('pages_show_list');
    expect(url).toContain('pages_manage_posts');
  });

  it('URL contains redirect_uri', () => {
    const redirectUri = 'https://app.example.com/oauth/facebook/callback';
    const url = facebookProvider.authorizationUrl({ state: 's', redirectUri });
    expect(url).toContain(encodeURIComponent(redirectUri));
  });

  it('throws when env var is missing', () => {
    delete process.env.FACEBOOK_APP_ID;
    expect(() =>
      facebookProvider.authorizationUrl({ state: 's', redirectUri: 'https://r.test/cb' })
    ).toThrow('FACEBOOK_APP_ID');
  });
});

describe('canvaProvider', () => {
  beforeEach(() => {
    setEnv('CANVA_CLIENT_ID', 'canva-client-id');
  });

  it('requiresPkce is true', () => {
    expect(canvaProvider.requiresPkce).toBe(true);
  });

  it('builds a valid authorization URL with codeChallenge', () => {
    const url = canvaProvider.authorizationUrl({
      state: 'test-state',
      redirectUri: 'https://app.example.com/oauth/canva/callback',
      codeChallenge: 'my-challenge',
    });
    expect(url).toContain('canva.com');
    expect(url).toContain('client_id=canva-client-id');
    expect(url).toContain('state=test-state');
    expect(url).toContain('response_type=code');
    expect(url).toContain('code_challenge=my-challenge');
    expect(url).toContain('code_challenge_method=S256');
  });

  it('includes design and profile scopes', () => {
    const url = canvaProvider.authorizationUrl({
      state: 's',
      redirectUri: 'https://r.test/cb',
      codeChallenge: 'challenge',
    });
    expect(url).toContain('design');
    expect(url).toContain('profile');
  });

  it('throws when env var is missing', () => {
    delete process.env.CANVA_CLIENT_ID;
    expect(() =>
      canvaProvider.authorizationUrl({ state: 's', redirectUri: 'https://r.test/cb', codeChallenge: 'c' })
    ).toThrow('CANVA_CLIENT_ID');
  });
});

describe('getOAuthProvider', () => {
  it('returns youtubeProvider for youtube', () => {
    expect(getOAuthProvider('youtube')).toBe(youtubeProvider);
  });

  it('returns tiktokProvider for tiktok', () => {
    expect(getOAuthProvider('tiktok')).toBe(tiktokProvider);
  });

  it('returns facebookProvider for facebook', () => {
    expect(getOAuthProvider('facebook')).toBe(facebookProvider);
  });

  it('returns canvaProvider for canva', () => {
    expect(getOAuthProvider('canva')).toBe(canvaProvider);
  });

  it('each provider is a distinct object', () => {
    const providers = ['youtube', 'tiktok', 'facebook', 'canva'] as const;
    const instances = providers.map((p) => getOAuthProvider(p));
    const unique = new Set(instances);
    expect(unique.size).toBe(4);
  });
});

describe('youtubeProvider — extra URL detail checks', () => {
  beforeEach(() => {
    setEnv('YOUTUBE_OAUTH_CLIENT_ID', 'yt-id');
  });

  it('URL base is accounts.google.com with /v2/auth path', () => {
    const url = youtubeProvider.authorizationUrl({ state: 's', redirectUri: 'https://r.test/cb' });
    expect(url).toContain('accounts.google.com/o/oauth2/v2/auth');
  });

  it('URL contains both access_type=offline and prompt=consent', () => {
    const url = youtubeProvider.authorizationUrl({ state: 's', redirectUri: 'https://r.test/cb' });
    expect(url).toContain('access_type=offline');
    expect(url).toContain('prompt=consent');
  });

  it('URL contains googleapis.com scope', () => {
    const url = youtubeProvider.authorizationUrl({ state: 's', redirectUri: 'https://r.test/cb' });
    expect(url).toContain('googleapis.com%2Fauth%2Fyoutube.upload');
  });
});

describe('tiktokProvider — extra URL detail checks', () => {
  beforeEach(() => {
    setEnv('TIKTOK_OAUTH_CLIENT_KEY', 'tt-key');
  });

  it('URL base is tiktok.com v2 auth endpoint', () => {
    const url = tiktokProvider.authorizationUrl({ state: 's', redirectUri: 'https://r.test/cb' });
    expect(url).toContain('tiktok.com/v2/auth/authorize');
  });

  it('scope contains video.publish', () => {
    const url = tiktokProvider.authorizationUrl({ state: 's', redirectUri: 'https://r.test/cb' });
    expect(url).toContain('video.publish');
  });
});

describe('facebookProvider — extra URL detail checks', () => {
  beforeEach(() => {
    setEnv('FACEBOOK_APP_ID', 'fb-id');
  });

  it('URL contains graph API version v21.0', () => {
    const url = facebookProvider.authorizationUrl({ state: 's', redirectUri: 'https://r.test/cb' });
    expect(url).toContain('v21.0');
  });

  it('URL contains all three page scopes', () => {
    const url = facebookProvider.authorizationUrl({ state: 's', redirectUri: 'https://r.test/cb' });
    expect(url).toContain('pages_show_list');
    expect(url).toContain('pages_read_engagement');
    expect(url).toContain('pages_manage_posts');
  });

  it('URL base is facebook.com dialog/oauth', () => {
    const url = facebookProvider.authorizationUrl({ state: 's', redirectUri: 'https://r.test/cb' });
    expect(url).toContain('facebook.com');
    expect(url).toContain('dialog/oauth');
  });
});

describe('canvaProvider — extra URL detail checks', () => {
  beforeEach(() => {
    setEnv('CANVA_CLIENT_ID', 'canva-id');
  });

  it('URL base is canva.com api/oauth/authorize', () => {
    const url = canvaProvider.authorizationUrl({ state: 's', redirectUri: 'https://r.test/cb', codeChallenge: 'c' });
    expect(url).toContain('canva.com/api/oauth/authorize');
  });

  it('without codeChallenge arg, code_challenge param is empty', () => {
    const url = canvaProvider.authorizationUrl({ state: 's', redirectUri: 'https://r.test/cb' });
    expect(url).toContain('code_challenge=');
    expect(url).toContain('code_challenge_method=S256');
  });

  it('codeChallenge value appears verbatim in URL', () => {
    const url = canvaProvider.authorizationUrl({ state: 's', redirectUri: 'https://r.test/cb', codeChallenge: 'abc123XYZ' });
    expect(url).toContain('code_challenge=abc123XYZ');
  });
});
