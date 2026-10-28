import { defineConfig } from 'vitest/config';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json-summary'],
      include: ['lib/**/*.ts'],
      exclude: [
        'lib/supabase/**',
        'lib/anthropic.ts',
        'lib/cloudinary.ts',
        'lib/mem0.ts',
        'lib/stripe.ts',
        'lib/tavily.ts',
        'lib/youtube.ts',
        'lib/publish/tokens.ts',
        'lib/publish/youtube.ts',
        'lib/publish/tiktok.ts',
        'lib/publish/facebook.ts',
      ],
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
    },
  },
});
