import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { getOAuthProvider } from '@/lib/oauth/index';

// Save and restore env vars around tests that need them
function withEnv(vars: Record<string, string>, fn: () => void) {
  const original: Record<string, string | undefined> = {};
  for (const [k, v] of Object.entries(vars)) {
    original[k] = process.env[k];
    process.env[k] = v;
  }
  try {
    fn();
  } finally {
    for (const k of Object.keys(vars)) {
      if (original[k] === undefined) {
        delete process.env[k];
      } else {
        process.env[k] = original[k];
      }
    }
  }
}

describe('getOAuthProvider', () => {
  it('returns a provider object for youtube', () => {
    const p = getOAuthProvider('youtube');
    expect(p).toBeDefined();
    expect(typeof p.authorizationUrl).toBe('function');
    expect(typeof p.exchangeCode).toBe('function');
    expect(typeof p.refreshAccessToken).toBe('function');
  });

  it('returns a provider for tiktok', () => {
    const p = getOAuthProvider('tiktok');
    expect(p).toBeDefined();
  });

  it('returns a provider for facebook', () => {
    const p = getOAuthProvider('facebook');
    expect(p).toBeDefined();
  });

  it('returns a provider for canva', () => {
    const p = getOAuthProvider('canva');
    expect(p).toBeDefined();
  });
});

describe('youtubeProvider', () => {
  const env = {
    YOUTUBE_OAUTH_CLIENT_ID: 'yt-client-id',
    YOUTUBE_OAUTH_CLIENT_SECRET: 'yt-client-secret',
  };

  it('requiresPkce is false', () => {
    const p = getOAuthProvider('youtube');
    expect(p.requiresPkce).toBe(false);
  });

  it('authorizationUrl returns a valid URL', () => {
    withEnv(env, () => {
      const p = getOAuthProvider('youtube');
      const url = p.authorizationUrl({ state: 'test-state', redirectUri: 'https://example.com/callback' });
      expect(() => new URL(url)).not.toThrow();
    });
  });

  it('authorizationUrl points at Google accounts', () => {
    withEnv(env, () => {
      const p = getOAuthProvider('youtube');
      const url = p.authorizationUrl({ state: 'test-state', redirectUri: 'https://example.com/callback' });
      expect(url).toContain('accounts.google.com');
    });
  });

  it('authorizationUrl includes state param', () => {
    withEnv(env, () => {
      const p = getOAuthProvider('youtube');
      const url = new URL(p.authorizationUrl({ state: 'my-state', redirectUri: 'https://app.example/cb' }));
      expect(url.searchParams.get('state')).toBe('my-state');
    });
  });

  it('authorizationUrl includes offline access_type', () => {
    withEnv(env, () => {
      const p = getOAuthProvider('youtube');
      const url = new URL(p.authorizationUrl({ state: 'st', redirectUri: 'https://app.example/cb' }));
      expect(url.searchParams.get('access_type')).toBe('offline');
    });
  });

  it('authorizationUrl includes prompt=consent', () => {
    withEnv(env, () => {
      const p = getOAuthProvider('youtube');
      const url = new URL(p.authorizationUrl({ state: 'st', redirectUri: 'https://app.example/cb' }));
      expect(url.searchParams.get('prompt')).toBe('consent');
    });
  });

  it('authorizationUrl includes YouTube upload scope', () => {
    withEnv(env, () => {
      const p = getOAuthProvider('youtube');
      const url = new URL(p.authorizationUrl({ state: 'st', redirectUri: 'https://app.example/cb' }));
      expect(url.searchParams.get('scope')).toContain('youtube.upload');
    });
  });

  it('authorizationUrl includes client_id from env', () => {
    withEnv(env, () => {
      const p = getOAuthProvider('youtube');
      const url = new URL(p.authorizationUrl({ state: 'st', redirectUri: 'https://app.example/cb' }));
      expect(url.searchParams.get('client_id')).toBe('yt-client-id');
    });
  });

  it('authorizationUrl includes redirect_uri', () => {
    withEnv(env, () => {
      const p = getOAuthProvider('youtube');
      const url = new URL(p.authorizationUrl({ state: 'st', redirectUri: 'https://app.example/cb' }));
      expect(url.searchParams.get('redirect_uri')).toBe('https://app.example/cb');
    });
  });

  it('authorizationUrl throws when YOUTUBE_OAUTH_CLIENT_ID is missing', () => {
    const saved = process.env['YOUTUBE_OAUTH_CLIENT_ID'];
    delete process.env['YOUTUBE_OAUTH_CLIENT_ID'];
    const p = getOAuthProvider('youtube');
    expect(() => p.authorizationUrl({ state: 'st', redirectUri: 'https://example.com/cb' })).toThrow(/YOUTUBE_OAUTH_CLIENT_ID/);
    if (saved !== undefined) process.env['YOUTUBE_OAUTH_CLIENT_ID'] = saved;
  });
});

describe('tiktokProvider', () => {
  const env = {
    TIKTOK_OAUTH_CLIENT_KEY: 'tt-client-key',
    TIKTOK_OAUTH_CLIENT_SECRET: 'tt-client-secret',
  };

  it('requiresPkce is false', () => {
    expect(getOAuthProvider('tiktok').requiresPkce).toBe(false);
  });

  it('authorizationUrl returns valid URL pointing at tiktok.com', () => {
    withEnv(env, () => {
      const p = getOAuthProvider('tiktok');
      const url = p.authorizationUrl({ state: 'my-state', redirectUri: 'https://example.com/cb' });
      const parsed = new URL(url);
      expect(parsed.hostname).toBe('www.tiktok.com');
    });
  });

  it('authorizationUrl includes state', () => {
    withEnv(env, () => {
      const p = getOAuthProvider('tiktok');
      const url = new URL(p.authorizationUrl({ state: 'tiktok-state', redirectUri: 'https://example.com/cb' }));
      expect(url.searchParams.get('state')).toBe('tiktok-state');
    });
  });

  it('authorizationUrl includes video.publish scope', () => {
    withEnv(env, () => {
      const p = getOAuthProvider('tiktok');
      const url = new URL(p.authorizationUrl({ state: 'st', redirectUri: 'https://example.com/cb' }));
      expect(url.searchParams.get('scope')).toContain('video.publish');
    });
  });

  it('authorizationUrl uses code response_type', () => {
    withEnv(env, () => {
      const p = getOAuthProvider('tiktok');
      const url = new URL(p.authorizationUrl({ state: 'st', redirectUri: 'https://example.com/cb' }));
      expect(url.searchParams.get('response_type')).toBe('code');
    });
  });

  it('authorizationUrl includes client_key', () => {
    withEnv(env, () => {
      const p = getOAuthProvider('tiktok');
      const url = new URL(p.authorizationUrl({ state: 'st', redirectUri: 'https://example.com/cb' }));
      expect(url.searchParams.get('client_key')).toBe('tt-client-key');
    });
  });

  it('authorizationUrl throws when TIKTOK_OAUTH_CLIENT_KEY is missing', () => {
    const saved = process.env['TIKTOK_OAUTH_CLIENT_KEY'];
    delete process.env['TIKTOK_OAUTH_CLIENT_KEY'];
    const p = getOAuthProvider('tiktok');
    expect(() => p.authorizationUrl({ state: 'st', redirectUri: 'https://example.com/cb' })).toThrow(/TIKTOK_OAUTH_CLIENT_KEY/);
    if (saved !== undefined) process.env['TIKTOK_OAUTH_CLIENT_KEY'] = saved;
  });
});

describe('facebookProvider', () => {
  const env = {
    FACEBOOK_APP_ID: 'fb-app-id',
    FACEBOOK_APP_SECRET: 'fb-app-secret',
  };

  it('requiresPkce is false', () => {
    expect(getOAuthProvider('facebook').requiresPkce).toBe(false);
  });

  it('authorizationUrl returns a valid URL pointing at facebook.com', () => {
    withEnv(env, () => {
      const p = getOAuthProvider('facebook');
      const url = p.authorizationUrl({ state: 'st', redirectUri: 'https://example.com/cb' });
      const parsed = new URL(url);
      expect(parsed.hostname).toBe('www.facebook.com');
    });
  });

  it('authorizationUrl includes state', () => {
    withEnv(env, () => {
      const p = getOAuthProvider('facebook');
      const url = new URL(p.authorizationUrl({ state: 'fb-state', redirectUri: 'https://example.com/cb' }));
      expect(url.searchParams.get('state')).toBe('fb-state');
    });
  });

  it('authorizationUrl includes pages_manage_posts scope', () => {
    withEnv(env, () => {
      const p = getOAuthProvider('facebook');
      const url = new URL(p.authorizationUrl({ state: 'st', redirectUri: 'https://example.com/cb' }));
      expect(url.searchParams.get('scope')).toContain('pages_manage_posts');
    });
  });

  it('authorizationUrl includes pages_show_list scope', () => {
    withEnv(env, () => {
      const p = getOAuthProvider('facebook');
      const url = new URL(p.authorizationUrl({ state: 'st', redirectUri: 'https://example.com/cb' }));
      expect(url.searchParams.get('scope')).toContain('pages_show_list');
    });
  });

  it('authorizationUrl uses code response_type', () => {
    withEnv(env, () => {
      const p = getOAuthProvider('facebook');
      const url = new URL(p.authorizationUrl({ state: 'st', redirectUri: 'https://example.com/cb' }));
      expect(url.searchParams.get('response_type')).toBe('code');
    });
  });

  it('authorizationUrl includes client_id from env', () => {
    withEnv(env, () => {
      const p = getOAuthProvider('facebook');
      const url = new URL(p.authorizationUrl({ state: 'st', redirectUri: 'https://example.com/cb' }));
      expect(url.searchParams.get('client_id')).toBe('fb-app-id');
    });
  });

  it('authorizationUrl throws when FACEBOOK_APP_ID is missing', () => {
    const saved = process.env['FACEBOOK_APP_ID'];
    delete process.env['FACEBOOK_APP_ID'];
    const p = getOAuthProvider('facebook');
    expect(() => p.authorizationUrl({ state: 'st', redirectUri: 'https://example.com/cb' })).toThrow(/FACEBOOK_APP_ID/);
    if (saved !== undefined) process.env['FACEBOOK_APP_ID'] = saved;
  });
});

describe('canvaProvider', () => {
  const env = {
    CANVA_CLIENT_ID: 'canva-client-id',
    CANVA_CLIENT_SECRET: 'canva-client-secret',
  };

  it('requiresPkce is true', () => {
    expect(getOAuthProvider('canva').requiresPkce).toBe(true);
  });

  it('authorizationUrl returns a valid URL pointing at canva.com', () => {
    withEnv(env, () => {
      const p = getOAuthProvider('canva');
      const url = p.authorizationUrl({ state: 'st', redirectUri: 'https://example.com/cb', codeChallenge: 'challenge123' });
      const parsed = new URL(url);
      expect(parsed.hostname).toBe('www.canva.com');
    });
  });

  it('authorizationUrl includes state', () => {
    withEnv(env, () => {
      const p = getOAuthProvider('canva');
      const url = new URL(p.authorizationUrl({ state: 'canva-state', redirectUri: 'https://example.com/cb', codeChallenge: 'ch' }));
      expect(url.searchParams.get('state')).toBe('canva-state');
    });
  });

  it('authorizationUrl includes code_challenge', () => {
    withEnv(env, () => {
      const p = getOAuthProvider('canva');
      const url = new URL(p.authorizationUrl({ state: 'st', redirectUri: 'https://example.com/cb', codeChallenge: 'my-challenge' }));
      expect(url.searchParams.get('code_challenge')).toBe('my-challenge');
    });
  });

  it('authorizationUrl uses S256 code_challenge_method', () => {
    withEnv(env, () => {
      const p = getOAuthProvider('canva');
      const url = new URL(p.authorizationUrl({ state: 'st', redirectUri: 'https://example.com/cb', codeChallenge: 'ch' }));
      expect(url.searchParams.get('code_challenge_method')).toBe('S256');
    });
  });

  it('authorizationUrl includes design:content:write scope', () => {
    withEnv(env, () => {
      const p = getOAuthProvider('canva');
      const url = new URL(p.authorizationUrl({ state: 'st', redirectUri: 'https://example.com/cb', codeChallenge: 'ch' }));
      expect(url.searchParams.get('scope')).toContain('design:content:write');
    });
  });

  it('authorizationUrl includes profile:read scope', () => {
    withEnv(env, () => {
      const p = getOAuthProvider('canva');
      const url = new URL(p.authorizationUrl({ state: 'st', redirectUri: 'https://example.com/cb', codeChallenge: 'ch' }));
      expect(url.searchParams.get('scope')).toContain('profile:read');
    });
  });

  it('authorizationUrl includes client_id', () => {
    withEnv(env, () => {
      const p = getOAuthProvider('canva');
      const url = new URL(p.authorizationUrl({ state: 'st', redirectUri: 'https://example.com/cb', codeChallenge: 'ch' }));
      expect(url.searchParams.get('client_id')).toBe('canva-client-id');
    });
  });

  it('authorizationUrl throws when CANVA_CLIENT_ID is missing', () => {
    const saved = process.env['CANVA_CLIENT_ID'];
    delete process.env['CANVA_CLIENT_ID'];
    const p = getOAuthProvider('canva');
    expect(() => p.authorizationUrl({ state: 'st', redirectUri: 'https://example.com/cb', codeChallenge: 'ch' })).toThrow(/CANVA_CLIENT_ID/);
    if (saved !== undefined) process.env['CANVA_CLIENT_ID'] = saved;
  });
});
