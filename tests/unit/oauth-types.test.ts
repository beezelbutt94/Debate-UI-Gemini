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

  it('rejects empty string', () => {
    expect(isOAuthPlatform('')).toBe(false);
  });

  it('rejects "instagram"', () => {
    expect(isOAuthPlatform('instagram')).toBe(false);
  });

  it('rejects "twitter"', () => {
    expect(isOAuthPlatform('twitter')).toBe(false);
  });

  it('rejects "YOUTUBE" (case-sensitive)', () => {
    expect(isOAuthPlatform('YOUTUBE')).toBe(false);
  });

  it('rejects "TikTok" (mixed case)', () => {
    expect(isOAuthPlatform('TikTok')).toBe(false);
  });

  it('rejects arbitrary strings', () => {
    expect(isOAuthPlatform('random_platform')).toBe(false);
  });

  it('rejects "linkedin"', () => {
    expect(isOAuthPlatform('linkedin')).toBe(false);
  });

  it('rejects "pinterest"', () => {
    expect(isOAuthPlatform('pinterest')).toBe(false);
  });
});
