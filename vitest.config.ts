import { defineConfig } from 'vitest/config';
import tsconfigPaths from 'vite-tsconfig-paths';

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    globals: true,
    environment: 'node',
    include: ['**/__tests__/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      // Only measure coverage for the pure-function modules that have tests.
      // Files that require live external services (DB, HTTP, OAuth) are excluded;
      // they cannot be exercised without network/credentials in CI.
      include: [
        'lib/utils.ts',
        'lib/platform.ts',
        'lib/digest.ts',
        'lib/oauth/state.ts',
        'lib/oauth/types.ts',
      ],
    },
  },
});
