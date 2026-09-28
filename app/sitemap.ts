import type { MetadataRoute } from 'next';
import { siteOrigin } from '@/lib/site';

export default function sitemap(): MetadataRoute.Sitemap {
  const origin = siteOrigin();
  return [
    { url: origin, changeFrequency: 'weekly', priority: 1 },
    { url: `${origin}/help`, changeFrequency: 'monthly', priority: 0.6 },
    { url: `${origin}/privacy`, changeFrequency: 'yearly', priority: 0.3 },
    { url: `${origin}/terms`, changeFrequency: 'yearly', priority: 0.3 },
  ];
}
