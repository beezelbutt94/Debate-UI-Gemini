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

  it('rejects an empty string', () => {
    expect(isOAuthPlatform('')).toBe(false);
  });

  it('rejects a random string', () => {
    expect(isOAuthPlatform('instagram')).toBe(false);
  });

  it('rejects "Twitter"', () => {
    expect(isOAuthPlatform('Twitter')).toBe(false);
  });

  it('rejects uppercase "YOUTUBE"', () => {
    expect(isOAuthPlatform('YOUTUBE')).toBe(false);
  });

  it('rejects "youtube_shorts" (a Platform, not an OAuthPlatform)', () => {
    expect(isOAuthPlatform('youtube_shorts')).toBe(false);
  });

  it('rejects "facebook_reels"', () => {
    expect(isOAuthPlatform('facebook_reels')).toBe(false);
  });

  it('rejects "tiktok " (trailing space)', () => {
    expect(isOAuthPlatform('tiktok ')).toBe(false);
  });

  it('rejects " tiktok" (leading space)', () => {
    expect(isOAuthPlatform(' tiktok')).toBe(false);
  });

  it('rejects a numeric string', () => {
    expect(isOAuthPlatform('123')).toBe(false);
  });
});
