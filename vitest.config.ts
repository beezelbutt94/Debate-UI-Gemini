import { defineConfig } from 'vitest/config';
import tsconfigPaths from 'vite-tsconfig-paths';

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    environment: 'node',
    include: ['tests/unit/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json-summary'],
      include: [
        'lib/utils.ts',
        'lib/platform.ts',
        'lib/digest.ts',
        'lib/tool-suite.ts',
        'lib/stripe.ts',
        'lib/oauth/state.ts',
        'lib/oauth/types.ts',
        'lib/oauth/index.ts',
      ],
    },
  },
});
