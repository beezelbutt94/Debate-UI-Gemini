import { defineConfig } from 'vitest/config';
import tsconfigPaths from 'vite-tsconfig-paths';

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    environment: 'node',
    coverage: {
      provider: 'v8',
      include: ['lib/**/*.ts'],
      exclude: ['lib/supabase/**', 'lib/anthropic.ts', 'lib/cloudinary.ts', 'lib/mem0.ts', 'lib/stripe.ts', 'lib/tavily.ts', 'lib/tool-suite.ts', 'lib/youtube.ts', 'lib/platform-api.ts'],
    },
  },
});
