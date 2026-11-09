import { describe, it, expect } from 'vitest';
import { isOAuthPlatform } from '@/lib/oauth/types';

describe('isOAuthPlatform', () => {
  it('recognises youtube', () => {
    expect(isOAuthPlatform('youtube')).toBe(true);
  });

  it('recognises tiktok', () => {
    expect(isOAuthPlatform('tiktok')).toBe(true);
  });

  it('recognises facebook', () => {
    expect(isOAuthPlatform('facebook')).toBe(true);
  });

  it('recognises canva', () => {
    expect(isOAuthPlatform('canva')).toBe(true);
  });

  it('rejects instagram (not an OAuth platform)', () => {
    expect(isOAuthPlatform('instagram')).toBe(false);
  });

  it('rejects empty string', () => {
    expect(isOAuthPlatform('')).toBe(false);
  });

  it('rejects Twitter', () => {
    expect(isOAuthPlatform('twitter')).toBe(false);
  });

  it('rejects YOUTUBE (case-sensitive)', () => {
    expect(isOAuthPlatform('YOUTUBE')).toBe(false);
  });

  it('rejects tiktok with trailing space', () => {
    expect(isOAuthPlatform('tiktok ')).toBe(false);
  });

  it('rejects a numeric string', () => {
    expect(isOAuthPlatform('123')).toBe(false);
  });
});
