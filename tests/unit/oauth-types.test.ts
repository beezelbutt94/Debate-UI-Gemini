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

  it('rejects "twitter"', () => {
    expect(isOAuthPlatform('twitter')).toBe(false);
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

  it('rejects "FACEBOOK"', () => {
    expect(isOAuthPlatform('FACEBOOK')).toBe(false);
  });

  it('rejects "CANVA"', () => {
    expect(isOAuthPlatform('CANVA')).toBe(false);
  });

  it('rejects arbitrary string', () => {
    expect(isOAuthPlatform('randomplatform')).toBe(false);
  });

  it('rejects numeric string "123"', () => {
    expect(isOAuthPlatform('123')).toBe(false);
  });

  it('rejects string with whitespace', () => {
    expect(isOAuthPlatform(' youtube')).toBe(false);
  });
});
