import type { OAuthPlatform, OAuthProvider } from './types.ts';
import { youtubeProvider } from './youtube.ts';
import { tiktokProvider } from './tiktok.ts';
import { facebookProvider } from './facebook.ts';
import { canvaProvider } from './canva.ts';

export * from './types.ts';

const providers: Record<OAuthPlatform, OAuthProvider> = {
  youtube: youtubeProvider,
  tiktok: tiktokProvider,
  facebook: facebookProvider,
  canva: canvaProvider,
};

export function getOAuthProvider(platform: OAuthPlatform): OAuthProvider {
  return providers[platform];
}
