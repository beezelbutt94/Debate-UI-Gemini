import { defineConfig } from 'vitest/config';
import { resolve } from 'path';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/unit/**/*.test.ts'],
    coverage: {
      reporter: ['text', 'json'],
    },
  },
  resolve: {
    alias: {
      '@': resolve(import.meta.dirname, '.'),
    },
  },
});
