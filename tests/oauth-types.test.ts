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

  it('rejects random strings', () => {
    expect(isOAuthPlatform('snapchat')).toBe(false);
    expect(isOAuthPlatform('pinterest')).toBe(false);
    expect(isOAuthPlatform('foobar')).toBe(false);
  });

  it('rejects partial matches', () => {
    expect(isOAuthPlatform('you')).toBe(false);
    expect(isOAuthPlatform('tik')).toBe(false);
  });
});
