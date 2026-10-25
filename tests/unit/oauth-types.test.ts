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

  it('returns false for unknown platform', () => {
    expect(isOAuthPlatform('instagram')).toBe(false);
  });

  it('returns false for empty string', () => {
    expect(isOAuthPlatform('')).toBe(false);
  });

  it('returns false for partial match', () => {
    expect(isOAuthPlatform('you')).toBe(false);
  });

  it('returns false for uppercase variant', () => {
    expect(isOAuthPlatform('YouTube')).toBe(false);
  });

  it('returns false for whitespace-padded string', () => {
    expect(isOAuthPlatform(' tiktok ')).toBe(false);
  });

  it('returns false for arbitrary string', () => {
    expect(isOAuthPlatform('twitter')).toBe(false);
  });

  it('returns false for null-like string', () => {
    expect(isOAuthPlatform('null')).toBe(false);
  });
});
