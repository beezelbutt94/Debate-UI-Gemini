import type { OAuthPlatform, OAuthProvider } from './types';
import { youtubeProvider } from './youtube';
import { tiktokProvider } from './tiktok';
import { facebookProvider } from './facebook';
import { canvaProvider } from './canva';

export * from './types';

const providers: Record<OAuthPlatform, OAuthProvider> = {
  youtube: youtubeProvider,
  tiktok: tiktokProvider,
  facebook: facebookProvider,
  canva: canvaProvider,
};

export function getOAuthProvider(platform: OAuthPlatform): OAuthProvider {
  return providers[platform];
}
