import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    restoreMocks: true,
    coverage: {
      provider: 'v8',
      include: ['lib/**/*.ts'],
      exclude: ['lib/supabase/**', 'lib/anthropic.ts'],
    },
  },
  resolve: {
    alias: {
      '@': import.meta.dirname,
    },
  },
});
