import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    // Resolve @/* path aliases from tsconfig paths without the deprecated plugin
    alias: { '@': new URL('.', import.meta.url).pathname.replace(/\/$/, '') },
  },
  test: {
    environment: 'node',
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      include: ['lib/**/*.ts'],
      exclude: [
        'lib/supabase/**',
        'lib/anthropic.ts',
        'lib/mem0.ts',
        'lib/tavily.ts',
        'lib/stripe.ts',
        'lib/publish/**',
        'lib/youtube.ts',
        'lib/cloudinary.ts',
        'lib/platform-api.ts',
        'lib/oauth/youtube.ts',
        'lib/oauth/tiktok.ts',
        'lib/oauth/facebook.ts',
        'lib/oauth/canva.ts',
      ],
    },
  },
});
