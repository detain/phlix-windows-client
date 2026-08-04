/**
 * Playwright configuration for smoke tests.
 *
 * @copyright 2026 Joe Huss <detain@interserver.net>
 */

import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/smoke',
  timeout: 120_000,
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: 0,
  workers: 1,
  reporter: [['list']],
  use: {
    headless: true,  // restore to true — we use --headless=new in Chromium args
    viewport: { width: 1280, height: 870 },
    actionTimeout: 10_000,
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'electron',
      use: {
        ...devices['Desktop Chrome'],
      },
    },
  ],
});
