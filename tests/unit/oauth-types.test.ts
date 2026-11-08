import { describe, it, expect } from 'vitest';
import { isOAuthPlatform } from '@/lib/oauth/types';

describe('isOAuthPlatform', () => {
  it('recognizes youtube', () => {
    expect(isOAuthPlatform('youtube')).toBe(true);
  });

  it('recognizes tiktok', () => {
    expect(isOAuthPlatform('tiktok')).toBe(true);
  });

  it('recognizes facebook', () => {
    expect(isOAuthPlatform('facebook')).toBe(true);
  });

  it('recognizes canva', () => {
    expect(isOAuthPlatform('canva')).toBe(true);
  });

  it('rejects instagram', () => {
    expect(isOAuthPlatform('instagram')).toBe(false);
  });

  it('rejects empty string', () => {
    expect(isOAuthPlatform('')).toBe(false);
  });

  it('rejects uppercase', () => {
    expect(isOAuthPlatform('YouTube')).toBe(false);
  });

  it('rejects arbitrary string', () => {
    expect(isOAuthPlatform('twitter')).toBe(false);
  });

  it('rejects youtube_shorts (not an OAuth platform)', () => {
    expect(isOAuthPlatform('youtube_shorts')).toBe(false);
  });

  it('rejects facebook_reels', () => {
    expect(isOAuthPlatform('facebook_reels')).toBe(false);
  });

  it('rejects numbers cast to string', () => {
    expect(isOAuthPlatform('123')).toBe(false);
  });

  it('rejects whitespace-padded platform name', () => {
    expect(isOAuthPlatform(' youtube')).toBe(false);
    expect(isOAuthPlatform('youtube ')).toBe(false);
  });

  it('rejects platform with extra characters appended', () => {
    expect(isOAuthPlatform('canva2')).toBe(false);
  });

  it('all four recognized platforms pass the guard', () => {
    const platforms = ['youtube', 'tiktok', 'facebook', 'canva'];
    for (const p of platforms) {
      expect(isOAuthPlatform(p)).toBe(true);
    }
  });
});
