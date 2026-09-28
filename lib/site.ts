/**
 * Public-site settings shared by the marketing pages, robots.txt, the
 * sitemap and ads.txt. Pure: no framework imports, so tests/unit can load it.
 */

const DEFAULT_ORIGIN = 'https://www.viraltrending.online';

/** The canonical public origin: NEXT_PUBLIC_APP_URL without a trailing slash. */
export function siteOrigin(value: string | undefined = process.env.NEXT_PUBLIC_APP_URL): string {
  const configured = value?.trim().replace(/\/+$/, '');
  return configured || DEFAULT_ORIGIN;
}

const ADSENSE_CLIENT = /^ca-pub-\d{10,20}$/;

/** A valid AdSense publisher ID (ca-pub-…) from ADSENSE_CLIENT_ID, or null. */
export function adsenseClient(value: string | undefined = process.env.ADSENSE_CLIENT_ID): string | null {
  const id = value?.trim();
  return id && ADSENSE_CLIENT.test(id) ? id : null;
}

/** Google's ads.txt record for a publisher ID. */
export function adsTxt(client: string): string {
  return `google.com, ${client.replace(/^ca-/, '')}, DIRECT, f08c47fec0942fa0\n`;
}

/** Where users write about their data and account, or null when unset. */
export function supportEmail(value: string | undefined = process.env.NEXT_PUBLIC_SUPPORT_EMAIL): string | null {
  const email = value?.trim();
  return email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : null;
}

/** StudioForge AI, the sister audio app on the same domain. */
export const STUDIOFORGE_URL = 'https://studio.viraltrending.online';
