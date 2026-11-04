import { describe, it, expect } from 'vitest';
import { getOAuthProvider } from '@/lib/oauth/index';
import { youtubeProvider } from '@/lib/oauth/youtube';
import { tiktokProvider } from '@/lib/oauth/tiktok';
import { facebookProvider } from '@/lib/oauth/facebook';
import { canvaProvider } from '@/lib/oauth/canva';

describe('getOAuthProvider', () => {
  it('returns the youtube provider for "youtube"', () => {
    expect(getOAuthProvider('youtube')).toBe(youtubeProvider);
  });

  it('returns the tiktok provider for "tiktok"', () => {
    expect(getOAuthProvider('tiktok')).toBe(tiktokProvider);
  });

  it('returns the facebook provider for "facebook"', () => {
    expect(getOAuthProvider('facebook')).toBe(facebookProvider);
  });

  it('returns the canva provider for "canva"', () => {
    expect(getOAuthProvider('canva')).toBe(canvaProvider);
  });

  it('each provider exposes authorizationUrl, exchangeCode, refreshAccessToken', () => {
    for (const platform of ['youtube', 'tiktok', 'facebook', 'canva'] as const) {
      const provider = getOAuthProvider(platform);
      expect(typeof provider.authorizationUrl).toBe('function');
      expect(typeof provider.exchangeCode).toBe('function');
      expect(typeof provider.refreshAccessToken).toBe('function');
    }
  });

  it('each provider exposes the requiresPkce boolean', () => {
    for (const platform of ['youtube', 'tiktok', 'facebook', 'canva'] as const) {
      const provider = getOAuthProvider(platform);
      expect(typeof provider.requiresPkce).toBe('boolean');
    }
  });

  it('only canva requires PKCE', () => {
    expect(getOAuthProvider('canva').requiresPkce).toBe(true);
    expect(getOAuthProvider('youtube').requiresPkce).toBe(false);
    expect(getOAuthProvider('tiktok').requiresPkce).toBe(false);
    expect(getOAuthProvider('facebook').requiresPkce).toBe(false);
  });
});
