import { defineConfig } from 'vitest/config';
import { resolve } from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/unit/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      include: ['lib/**/*.ts'],
      exclude: [
        'lib/supabase/**',
        'lib/anthropic.ts',
        'lib/mem0.ts',
        'lib/cloudinary.ts',
        'lib/stripe.ts',
        'lib/tavily.ts',
        'lib/youtube.ts',
      ],
    },
  },
  resolve: {
    alias: {
      '@': resolve(import.meta.dirname, '.'),
    },
  },
});
