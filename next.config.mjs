/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  output: 'standalone',
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '**.supabase.co' },
      { protocol: 'https', hostname: '**.amazonaws.com' },
    ],
  },
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
        ],
      },
    ];
  },
  async rewrites() {
    // Proxies the (still-unbuilt) ViralVision platform service's routes --
    // see services/api/ -- so the /dashboard/* pages under app/dashboard
    // can call relative /api/v1/* paths instead of hardcoding a backend
    // origin. No-ops until INTERNAL_API_URL is actually set.
    if (!process.env.INTERNAL_API_URL) return [];
    return [
      {
        source: '/api/v1/:path*',
        destination: `${process.env.INTERNAL_API_URL}/api/v1/:path*`,
      },
    ];
  },
};

export default nextConfig;
