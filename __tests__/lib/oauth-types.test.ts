import { describe, it, expect } from 'vitest';
import { isOAuthPlatform } from '@/lib/oauth/types';

describe('isOAuthPlatform', () => {
  it('returns true for youtube', () => {
    expect(isOAuthPlatform('youtube')).toBe(true);
  });

  it('returns true for tiktok', () => {
    expect(isOAuthPlatform('tiktok')).toBe(true);
  });

  it('returns true for facebook', () => {
    expect(isOAuthPlatform('facebook')).toBe(true);
  });

  it('returns true for canva', () => {
    expect(isOAuthPlatform('canva')).toBe(true);
  });

  it('returns false for instagram (not an OAuthPlatform)', () => {
    expect(isOAuthPlatform('instagram')).toBe(false);
  });

  it('returns false for empty string', () => {
    expect(isOAuthPlatform('')).toBe(false);
  });

  it('returns false for uppercase YOUTUBE', () => {
    expect(isOAuthPlatform('YOUTUBE')).toBe(false);
  });

  it('returns false for partial match "you"', () => {
    expect(isOAuthPlatform('you')).toBe(false);
  });

  it('returns false for youtube_shorts (content platform, not OAuth platform)', () => {
    expect(isOAuthPlatform('youtube_shorts')).toBe(false);
  });

  it('returns false for facebook_reels (content platform, not OAuth platform)', () => {
    expect(isOAuthPlatform('facebook_reels')).toBe(false);
  });

  it('returns false for random arbitrary string', () => {
    expect(isOAuthPlatform('twitter')).toBe(false);
  });

  it('returns false for string with leading whitespace', () => {
    expect(isOAuthPlatform(' youtube')).toBe(false);
  });
});
