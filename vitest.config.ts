import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    globals: false,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json-summary'],
      include: ['lib/**/*.ts'],
      exclude: [
        'lib/supabase/**',
        'lib/stripe.ts',
        'lib/mem0.ts',
        'lib/tavily.ts',
        'lib/cloudinary.ts',
        'lib/anthropic.ts',
        'lib/youtube.ts',
        'lib/platform-api.ts',
        'lib/tool-suite.ts',
      ],
    },
  },
  resolve: {
    alias: {
      '@': import.meta.dirname,
    },
  },
});
