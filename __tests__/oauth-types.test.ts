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

  it('rejects uppercase "YOUTUBE"', () => {
    expect(isOAuthPlatform('YOUTUBE')).toBe(false);
  });

  it('rejects mixed-case "TikTok"', () => {
    expect(isOAuthPlatform('TikTok')).toBe(false);
  });

  it('rejects "twitter"', () => {
    expect(isOAuthPlatform('twitter')).toBe(false);
  });

  it('rejects "youtube_shorts"', () => {
    expect(isOAuthPlatform('youtube_shorts')).toBe(false);
  });

  it('rejects a platform with leading/trailing space', () => {
    expect(isOAuthPlatform(' youtube ')).toBe(false);
  });

  it('rejects a random string', () => {
    expect(isOAuthPlatform('notaplatform')).toBe(false);
  });
});
