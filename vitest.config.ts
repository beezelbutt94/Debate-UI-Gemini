import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/lib/**/*.test.ts'],
    globals: false,
  },
  resolve: {
    alias: {
      '@': import.meta.dirname,
    },
  },
});
