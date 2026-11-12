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
    // WIN-43: 'on-first-retry' never fired — retries is 0, so no trace was ever
    // recorded. 'retain-on-failure' records every run and keeps trace.zip only
    // when the test fails (outputDir test-results/ — gitignored); preferred over
    // retries: 1, which would double the 20-min CI smoke leg. The spec's
    // connectOverCDP default context is instrumented by the runner.
    // screenshots: false is load-bearing: on a failure the spec's afterEach
    // kills Electron before the runner finalizes the trace, the disconnect
    // deletes the connection's artifacts dir, and in-flight screencast frames
    // then fail with ENOENT and a truncated trace.zip (probed on 1.62.1).
    // DOM snapshots + actions + network + console still land in the trace.
    trace: { mode: 'retain-on-failure', screenshots: false },
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
