import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json'],
      include: ['lib/**/*.ts'],
      exclude: [
        'lib/supabase/**',
        'lib/anthropic.ts',
        'lib/mem0.ts',
        'lib/stripe.ts',
        'lib/cloudinary.ts',
        'lib/tavily.ts',
        'lib/youtube.ts',
        'lib/platform-api.ts',
        'lib/tool-suite.ts',
        'lib/publish/**',
      ],
    },
  },
  resolve: {
    alias: {
      '@': import.meta.dirname,
    },
  },
});
