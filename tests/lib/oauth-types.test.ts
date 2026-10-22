import { describe, it, expect } from 'vitest';
import { isOAuthPlatform } from '@/lib/oauth/types';

describe('isOAuthPlatform', () => {
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

  it('rejects "instagram"', () => {
    expect(isOAuthPlatform('instagram')).toBe(false);
  });

  it('rejects "twitter"', () => {
    expect(isOAuthPlatform('twitter')).toBe(false);
  });

  it('rejects empty string', () => {
    expect(isOAuthPlatform('')).toBe(false);
  });

  it('rejects uppercase "YouTube"', () => {
    expect(isOAuthPlatform('YouTube')).toBe(false);
  });

  it('rejects "youtube_shorts" (content platform, not OAuth platform)', () => {
    expect(isOAuthPlatform('youtube_shorts')).toBe(false);
  });

  it('rejects "facebook_reels"', () => {
    expect(isOAuthPlatform('facebook_reels')).toBe(false);
  });

  it('rejects arbitrary strings', () => {
    expect(isOAuthPlatform('not_a_platform')).toBe(false);
  });
});
