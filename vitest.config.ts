import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    // resolves @/* path aliases from tsconfig.json
    alias: { '@': new URL('.', import.meta.url).pathname },
  },
  test: {
    environment: 'node',
    include: ['tests/unit/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json'],
      include: ['lib/**/*.ts'],
    },
  },
});
