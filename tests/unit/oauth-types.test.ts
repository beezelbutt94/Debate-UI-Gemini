import { describe, it, expect } from 'vitest';
import { isOAuthPlatform } from '@/lib/oauth/types';

describe('isOAuthPlatform', () => {
  it('accepts youtube', () => {
    expect(isOAuthPlatform('youtube')).toBe(true);
  });

  it('accepts tiktok', () => {
    expect(isOAuthPlatform('tiktok')).toBe(true);
  });

  it('accepts facebook', () => {
    expect(isOAuthPlatform('facebook')).toBe(true);
  });

  it('accepts canva', () => {
    expect(isOAuthPlatform('canva')).toBe(true);
  });

  it('rejects instagram (not an OAuth platform in this app)', () => {
    expect(isOAuthPlatform('instagram')).toBe(false);
  });

  it('rejects empty string', () => {
    expect(isOAuthPlatform('')).toBe(false);
  });

  it('rejects arbitrary strings', () => {
    expect(isOAuthPlatform('twitter')).toBe(false);
  });

  it('rejects capitalized variants (case-sensitive)', () => {
    expect(isOAuthPlatform('YouTube')).toBe(false);
    expect(isOAuthPlatform('TikTok')).toBe(false);
    expect(isOAuthPlatform('Facebook')).toBe(false);
    expect(isOAuthPlatform('Canva')).toBe(false);
  });

  it('rejects partial matches', () => {
    expect(isOAuthPlatform('you')).toBe(false);
    expect(isOAuthPlatform('tik')).toBe(false);
  });
});
