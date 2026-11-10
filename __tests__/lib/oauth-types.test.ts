import { describe, it, expect } from 'vitest';
import { isOAuthPlatform } from '@/lib/oauth/types';

describe('isOAuthPlatform', () => {
  it('returns true for "youtube"', () => {
    expect(isOAuthPlatform('youtube')).toBe(true);
  });

  it('returns true for "tiktok"', () => {
    expect(isOAuthPlatform('tiktok')).toBe(true);
  });

  it('returns true for "facebook"', () => {
    expect(isOAuthPlatform('facebook')).toBe(true);
  });

  it('returns true for "canva"', () => {
    expect(isOAuthPlatform('canva')).toBe(true);
  });

  it('returns false for "instagram" (not a connectable OAuth platform)', () => {
    expect(isOAuthPlatform('instagram')).toBe(false);
  });

  it('returns false for empty string', () => {
    expect(isOAuthPlatform('')).toBe(false);
  });

  it('returns false for a random string', () => {
    expect(isOAuthPlatform('twitter')).toBe(false);
  });

  it('returns false for "YouTube" (case-sensitive)', () => {
    expect(isOAuthPlatform('YouTube')).toBe(false);
  });

  it('returns false for "TIKTOK"', () => {
    expect(isOAuthPlatform('TIKTOK')).toBe(false);
  });

  it('returns false for "facebook " (trailing space)', () => {
    expect(isOAuthPlatform('facebook ')).toBe(false);
  });

  it('returns false for "canva1"', () => {
    expect(isOAuthPlatform('canva1')).toBe(false);
  });

  it('returns false for leading space', () => {
    expect(isOAuthPlatform(' youtube')).toBe(false);
  });

  it('returns false for a platform with hyphen injected', () => {
    expect(isOAuthPlatform('you-tube')).toBe(false);
  });

  it('returns true for all four valid platforms exhaustively', () => {
    const valid = ['youtube', 'tiktok', 'facebook', 'canva'] as const;
    for (const p of valid) {
      expect(isOAuthPlatform(p)).toBe(true);
    }
  });

  it('returns false for all plausible near-miss strings', () => {
    const nearMisses = ['youtubes', 'tiktoks', 'facebooks', 'canvas', 'youtube.', '.tiktok'];
    for (const s of nearMisses) {
      expect(isOAuthPlatform(s)).toBe(false);
    }
  });
});
