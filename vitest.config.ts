import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      include: ['lib/**/*.ts'],
      exclude: ['lib/supabase/**', 'lib/anthropic.ts', 'lib/tavily.ts', 'lib/mem0.ts', 'lib/cloudinary.ts', 'lib/stripe.ts', 'lib/youtube.ts'],
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, '.'),
    },
  },
});
