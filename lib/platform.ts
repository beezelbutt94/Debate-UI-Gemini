import type { Platform } from '@/lib/types';

/**
 * Detects which of the three supported short-form platforms a pasted URL
 * belongs to. Returns null for anything else so the route handler can
 * reject it with a clear 400 instead of silently mis-analyzing it.
 */
export function detectPlatform(rawUrl: string): Platform | null {
  let host: string;
  try {
    host = new URL(rawUrl).hostname.replace(/^www\./, '');
  } catch {
    return null;
  }

  if (host === 'tiktok.com' || host.endsWith('.tiktok.com')) {
    return 'tiktok';
  }

  if (
    (host === 'youtube.com' || host.endsWith('.youtube.com')) && rawUrl.includes('/shorts/')
  ) {
    return 'youtube_shorts';
  }
  if (host === 'youtu.be') {
    return 'youtube_shorts';
  }

  if (
    (host === 'facebook.com' || host.endsWith('.facebook.com') || host === 'fb.watch') &&
    (rawUrl.includes('/reel/') || host === 'fb.watch')
  ) {
    return 'facebook_reels';
  }

  return null;
}
