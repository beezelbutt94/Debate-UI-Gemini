import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: ['lib/**/*.ts'],
      exclude: [
        'lib/supabase/**',
        'lib/stripe.ts',
        'lib/anthropic.ts',
        'lib/mem0.ts',
        'lib/tavily.ts',
        'lib/cloudinary.ts',
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
