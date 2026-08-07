import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import vue from 'eslint-plugin-vue';
import globals from 'globals';

// Flat config for the Phlix Windows Electron client (Vue 3 thin consumer of
// @phlix/ui in the renderer + Electron main/preload in Node).
export default tseslint.config(
  {
    ignores: ['dist/**', 'node_modules/**', 'release/**', '.logs/**', 'coverage/**'],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  ...vue.configs['flat/recommended'],
  {
    files: ['**/*.vue'],
    languageOptions: {
      parserOptions: {
        parser: tseslint.parser,
        extraFileExtensions: ['.vue'],
      },
    },
  },
  {
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: 'module',
      globals: {
        ...globals.browser,
        ...globals.node,
      },
    },
    rules: {
      // vue-tsc/tsc resolve identifiers + types; no-undef misfires on DOM/type globals.
      'no-undef': 'off',
      // Renderer should use electron-log for persistent logging. console.error/warn are
      // acceptable for critical failures that must surface even without electron-log setup.
      'no-console': ['error', { allow: ['error', 'warn'] }],
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrorsIgnorePattern: '^_' },
      ],
      // Single-word component names are part of the @phlix/ui public API; not authored here.
      'vue/multi-word-component-names': 'off',
    },
  },
  {
    // Electron main + preload: no-console is 'error' in the renderer but OFF here because
    // these processes use electron-log for structured logging (file + console transport).
    // console.error/warn remain acceptable for fatal startup failures before log is ready.
    files: ['src/main/**', 'src/preload/**'],
    rules: {
      'no-console': 'off',
    },
  },
  {
    // Build scripts (e.g. check-assets, assert-preload): these are CLI tools that run in
    // the terminal during the build process — console output is their primary feedback
    // mechanism, not electron-log, so the console restriction does not apply.
    files: ['scripts/**'],
    rules: {
      'no-console': 'off',
    },
  },
  {
    files: ['**/*.test.ts', '**/*.test.tsx', 'tests/**'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
    },
  },
);
