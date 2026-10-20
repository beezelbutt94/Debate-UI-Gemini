import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    // Resolves @/* path aliases from tsconfig.json
    tsconfigPaths: true,
  },
  test: {
    environment: 'node',
    globals: true,
    include: ['tests/unit/**/*.test.ts'],
  },
});
