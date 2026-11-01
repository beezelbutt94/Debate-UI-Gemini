import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    coverage: {
      provider: 'v8',
      include: ['lib/**/*.ts'],
      exclude: [
        'lib/supabase/**',
        'lib/anthropic.ts',
        'lib/cloudinary.ts',
        'lib/mem0.ts',
        'lib/stripe.ts',
        'lib/tavily.ts',
        'lib/youtube.ts',
        'lib/platform-api.ts',
        'lib/publish/tokens.ts',
        'lib/publish/tiktok.ts',
        'lib/publish/facebook.ts',
        'lib/publish/youtube.ts',
        'lib/oauth/tiktok.ts',
        'lib/oauth/facebook.ts',
        'lib/oauth/youtube.ts',
        'lib/oauth/canva.ts',
      ],
    },
  },
  resolve: {
    alias: {
      '@': import.meta.dirname,
    },
  },
});
