import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/unit/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json-summary'],
      // Only report on the pure-function modules that have no external service deps.
      // Modules requiring live APIs (OAuth providers, Supabase, Cloudinary API,
      // Stripe, Anthropic, Tavily, mem0) are excluded — they need integration tests
      // with real credentials, not unit tests.
      include: [
        'lib/utils.ts',
        'lib/platform.ts',
        'lib/digest.ts',
        'lib/tool-suite.ts',
        'lib/cloudinary.ts',
        'lib/oauth/state.ts',
        'lib/oauth/types.ts',
      ],
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, '.'),
    },
  },
});
