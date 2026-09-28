import type { Metadata } from 'next';
import Script from 'next/script';
import { ClerkProvider } from '@clerk/nextjs';
import { adsenseClient } from '@/lib/site';
import './globals.css';

export const metadata: Metadata = {
  title: { default: 'Viral Trending', template: '%s · Viral Trending' },
  description:
    'Score your TikTok, YouTube Shorts and Facebook Reels against viral benchmarks, get a timestamped fix list, write scripts and schedule posts.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const adsense = adsenseClient();
  return (
    <ClerkProvider>
      <html lang="en">
        <body>
          {children}
          {adsense && (
            <Script
              async
              src={`https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${adsense}`}
              crossOrigin="anonymous"
              strategy="afterInteractive"
            />
          )}
        </body>
      </html>
    </ClerkProvider>
  );
}
