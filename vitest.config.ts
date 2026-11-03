import { defineConfig } from 'vitest/config';

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
      ],
    },
  },
  resolve: {
    alias: {
      '@': import.meta.dirname,
    },
  },
});
