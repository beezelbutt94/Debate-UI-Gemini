import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json-summary'],
      include: ['lib/**/*.ts'],
      exclude: [
        'lib/supabase/**',
        'lib/anthropic.ts',
        'lib/stripe.ts',
        'lib/mem0.ts',
        'lib/cloudinary.ts',
        'lib/tavily.ts',
        'lib/youtube.ts',
        'lib/publish/**',
        'lib/platform-api.ts',
      ],
    },
  },
  resolve: {
    alias: {
      '@': import.meta.dirname,
    },
  },
});
