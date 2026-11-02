import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json-summary'],
      // Only measure the pure/deterministic files that have no unresolvable
      // external deps (Supabase, Anthropic SDK, Stripe, Cloudinary).
      // Files excluded here are tested at the integration/E2E layer only.
      include: [
        'lib/utils.ts',
        'lib/platform.ts',
        'lib/digest.ts',
        'lib/tool-suite.ts',
        'lib/oauth/index.ts',
        'lib/oauth/state.ts',
        'lib/oauth/types.ts',
        'lib/oauth/youtube.ts',
        'lib/oauth/tiktok.ts',
        'lib/oauth/facebook.ts',
        'lib/oauth/canva.ts',
      ],
      exclude: ['**/*.test.*', '**/*.spec.*', 'node_modules/**'],
    },
  },
  resolve: {
    alias: {
      '@': import.meta.dirname,
    },
  },
});
