import { describe, it, expect } from 'vitest';
import { isOAuthPlatform } from '@/lib/oauth/types';

describe('isOAuthPlatform()', () => {
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

  it('returns false for "instagram"', () => {
    expect(isOAuthPlatform('instagram')).toBe(false);
  });

  it('returns false for "twitter"', () => {
    expect(isOAuthPlatform('twitter')).toBe(false);
  });

  it('returns false for an empty string', () => {
    expect(isOAuthPlatform('')).toBe(false);
  });

  it('returns false for uppercase "YouTube"', () => {
    expect(isOAuthPlatform('YouTube')).toBe(false);
  });

  it('returns false for a string with trailing space', () => {
    expect(isOAuthPlatform('youtube ')).toBe(false);
  });

  it('returns false for a numeric string', () => {
    expect(isOAuthPlatform('123')).toBe(false);
  });

  it('returns false for a partial match like "you"', () => {
    expect(isOAuthPlatform('you')).toBe(false);
  });

  it('returns false for "YOUTUBE" (case-sensitive check)', () => {
    expect(isOAuthPlatform('YOUTUBE')).toBe(false);
  });

  it('returns false for "TIKTOK"', () => {
    expect(isOAuthPlatform('TIKTOK')).toBe(false);
  });

  it('returns false for "FACEBOOK"', () => {
    expect(isOAuthPlatform('FACEBOOK')).toBe(false);
  });

  it('returns false for "CANVA"', () => {
    expect(isOAuthPlatform('CANVA')).toBe(false);
  });

  it('returns false for a SQL-injection-style string', () => {
    expect(isOAuthPlatform("'; DROP TABLE users; --")).toBe(false);
  });

  it('returns false for a JSON string', () => {
    expect(isOAuthPlatform('{"platform":"youtube"}')).toBe(false);
  });

  it('returns false for a string with a leading newline', () => {
    expect(isOAuthPlatform('\nyoutube')).toBe(false);
  });

  it('all four valid platforms return true', () => {
    for (const p of ['youtube', 'tiktok', 'facebook', 'canva'] as const) {
      expect(isOAuthPlatform(p)).toBe(true);
    }
  });
});
