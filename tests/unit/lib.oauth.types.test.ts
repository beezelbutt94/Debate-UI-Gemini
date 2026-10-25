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

  it('rejects "instagram"', () => {
    expect(isOAuthPlatform('instagram')).toBe(false);
  });

  it('rejects empty string', () => {
    expect(isOAuthPlatform('')).toBe(false);
  });

  it('rejects "YouTube" (case-sensitive)', () => {
    expect(isOAuthPlatform('YouTube')).toBe(false);
  });

  it('rejects "TIKTOK" (case-sensitive)', () => {
    expect(isOAuthPlatform('TIKTOK')).toBe(false);
  });

  it('rejects an arbitrary string', () => {
    expect(isOAuthPlatform('twitter')).toBe(false);
  });

  it('rejects "facebook_reels" (content platform, not OAuth platform)', () => {
    expect(isOAuthPlatform('facebook_reels')).toBe(false);
  });

  it('rejects "youtube_shorts" (content platform, not OAuth platform)', () => {
    expect(isOAuthPlatform('youtube_shorts')).toBe(false);
  });
});
