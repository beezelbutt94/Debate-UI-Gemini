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

  it('is case-sensitive — rejects "YouTube"', () => {
    expect(isOAuthPlatform('YouTube')).toBe(false);
  });

  it('is case-sensitive — rejects "TikTok"', () => {
    expect(isOAuthPlatform('TikTok')).toBe(false);
  });

  it('is case-sensitive — rejects "Facebook"', () => {
    expect(isOAuthPlatform('Facebook')).toBe(false);
  });

  it('is case-sensitive — rejects "Canva"', () => {
    expect(isOAuthPlatform('Canva')).toBe(false);
  });

  it('rejects a random string', () => {
    expect(isOAuthPlatform('snapchat')).toBe(false);
  });

  it('rejects "youtube_shorts" (not a valid OAuth platform)', () => {
    expect(isOAuthPlatform('youtube_shorts')).toBe(false);
  });
});
