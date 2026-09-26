import type { Metadata } from 'next';
import { ClerkProvider } from '@clerk/nextjs';
import './globals.css';

export const metadata: Metadata = {
  title: { default: 'Viral Trending', template: '%s · Viral Trending' },
  description:
    'Score your TikTok, YouTube Shorts and Facebook Reels against viral benchmarks, get a timestamped fix list, write scripts and schedule posts.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <ClerkProvider>
      <html lang="en">
        <body>{children}</body>
      </html>
    </ClerkProvider>
  );
}
