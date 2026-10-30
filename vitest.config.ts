import { defineConfig } from 'vitest/config';
import tsconfigPaths from 'vite-tsconfig-paths';

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    environment: 'node',
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json'],
      include: ['lib/**/*.ts'],
      exclude: ['lib/supabase/**', 'lib/anthropic.ts', 'lib/tavily.ts', 'lib/mem0.ts', 'lib/stripe.ts', 'lib/cloudinary.ts', 'lib/youtube.ts'],
    },
  },
});
