import type { OAuthPlatform, OAuthProvider } from './types';
import { tiktokProvider } from './tiktok';
import { googleProvider } from './google';

export * from './types';

const providers: Record<OAuthPlatform, OAuthProvider> = {
  tiktok: tiktokProvider,
  google: googleProvider,
};

export function getOAuthProvider(platform: OAuthPlatform): OAuthProvider {
  return providers[platform];
}
