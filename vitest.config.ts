import { defineConfig } from 'vitest/config';
import { resolve } from 'path';

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json-summary'],
      include: ['lib/**/*.ts'],
      exclude: [
        'lib/supabase/**',
        'lib/anthropic.ts',
        'lib/cloudinary.ts',
        'lib/mem0.ts',
        'lib/stripe.ts',
        'lib/tavily.ts',
        'lib/youtube.ts',
        'lib/oauth/canva.ts',
        'lib/oauth/facebook.ts',
        'lib/oauth/tiktok.ts',
        'lib/oauth/youtube.ts',
        'lib/publish/**',
      ],
    },
  },
  resolve: {
    alias: {
      '@': resolve(import.meta.dirname, '.'),
    },
  },
});
