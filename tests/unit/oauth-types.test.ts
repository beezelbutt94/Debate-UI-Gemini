import { describe, it, expect } from 'vitest';
import { isOAuthPlatform } from '@/lib/oauth/types';

describe('isOAuthPlatform()', () => {
  it('accepts "youtube"', () => {
    expect(isOAuthPlatform('youtube')).toBe(true);
  });

  it('accepts "tiktok"', () => {
    expect(isOAuthPlatform('tiktok')).toBe(true);
  });

  it('accepts "facebook"', () => {
    expect(isOAuthPlatform('facebook')).toBe(true);
  });

  it('accepts "canva"', () => {
    expect(isOAuthPlatform('canva')).toBe(true);
  });

  it('rejects empty string', () => {
    expect(isOAuthPlatform('')).toBe(false);
  });

  it('rejects unknown platform "instagram"', () => {
    expect(isOAuthPlatform('instagram')).toBe(false);
  });

  it('rejects unknown platform "twitter"', () => {
    expect(isOAuthPlatform('twitter')).toBe(false);
  });

  it('rejects uppercase variant "YouTube"', () => {
    expect(isOAuthPlatform('YouTube')).toBe(false);
  });

  it('rejects "TIKTOK"', () => {
    expect(isOAuthPlatform('TIKTOK')).toBe(false);
  });

  it('rejects "facebook_reels" (Platform type, not OAuthPlatform)', () => {
    expect(isOAuthPlatform('facebook_reels')).toBe(false);
  });

  it('rejects "youtube_shorts" (Platform type, not OAuthPlatform)', () => {
    expect(isOAuthPlatform('youtube_shorts')).toBe(false);
  });

  it('rejects a random string', () => {
    expect(isOAuthPlatform('random-platform')).toBe(false);
  });

  it('rejects whitespace', () => {
    expect(isOAuthPlatform(' youtube')).toBe(false);
  });

  it('all four valid platforms return true', () => {
    const platforms = ['youtube', 'tiktok', 'facebook', 'canva'];
    expect(platforms.every(isOAuthPlatform)).toBe(true);
  });
});
