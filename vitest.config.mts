import { defineConfig } from 'vitest/config';
import vue from '@vitejs/plugin-vue';
import vueJsx from '@vitejs/plugin-vue-jsx';
import { resolve } from 'path';

export default defineConfig({
  plugins: [vue(), vueJsx()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/renderer/test-setup.ts'],
    // .mjs is included for tests/unit/copyright.test.mjs, which exercises the
    // plain-Node ESM helpers in scripts/lib/copyright.mjs. Those live outside
    // the TypeScript project (tsconfig.json's `include` is ["src/renderer"]),
    // so the test is authored as .mjs rather than .ts.
    include: ['tests/**/*.test.ts', 'tests/**/*.test.tsx', 'tests/**/*.test.mjs'],
    coverage: {
      provider: 'v8',
      // 'lcov' is required, not cosmetic: CI (.github/workflows/test.yml) uploads
      // ./coverage/lcov.info to BOTH Codecov and Codacy. Without this reporter the
      // file is never written and both uploads silently no-op.
      reporter: ['text', 'json', 'html', 'lcov'],
      exclude: [
        'node_modules/',
        'tests/',
        'dist/',
        '**/*.d.ts',
        '**/*.config.{ts,mts,js,mjs,cjs}',
        'src/main/**',
        'src/preload/**'
      ]
    }
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, './src/renderer')
    }
  }
});
