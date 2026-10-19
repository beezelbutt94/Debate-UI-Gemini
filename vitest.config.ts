import { defineConfig } from 'vitest/config';
import { resolve } from 'path';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/unit/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      include: ['lib/**/*.ts'],
      exclude: [
        'lib/anthropic.ts',
        'lib/cloudinary.ts',
        'lib/mem0.ts',
        'lib/stripe.ts',
        'lib/supabase/**',
        'lib/tavily.ts',
        'lib/youtube.ts',
        'lib/oauth/canva.ts',
        'lib/oauth/facebook.ts',
        'lib/oauth/tiktok.ts',
        'lib/oauth/youtube.ts',
        'lib/publish/facebook.ts',
        'lib/publish/tiktok.ts',
        'lib/publish/youtube.ts',
        'lib/publish/tokens.ts',
        'lib/platform-api.ts',
      ],
    },
  },
  resolve: {
    alias: {
      '@': resolve(import.meta.dirname, '.'),
    },
  },
});
