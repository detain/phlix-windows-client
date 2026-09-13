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
    // vitest@5 flipped this default from false to true: spies are now cleared
    // before every test. autoUpdater.test.ts captures module-load-time handlers
    // and asserts on their registration calls; test-setup.ts and other suites
    // likewise rely on v3's persist-by-default semantics. Pin the v3 behavior.
    clearMocks: false,
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
        '**/*.config.{ts,mts,js,mjs,cjs}'
      ],
      thresholds: {
        lines: 54
      }
    }
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, './src/renderer')
    }
  }
});
