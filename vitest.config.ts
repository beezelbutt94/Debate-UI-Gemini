import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    globals: false,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      include: ['lib/**/*.ts'],
      exclude: [
        'lib/supabase/**',
        'lib/anthropic.ts',
        'lib/cloudinary.ts',
        'lib/mem0.ts',
        'lib/stripe.ts',
        'lib/tavily.ts',
        'lib/youtube.ts',
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
