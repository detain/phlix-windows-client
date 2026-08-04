/**
 * Boot smoke test — launches Electron against dist/ and verifies the app boots correctly.
 *
 * Guards against:
 * - W0.1: window.electronAPI not defined (preload script failed to load)
 * - W0.3: device ID hardcoded as 'windows-dev' instead of a real UUID
 * - W0.4: renderer not navigating to /app/* route
 *
 * @copyright 2026 Joe Huss <detain@interserver.net>
 */

import { test, expect, _electron } from '@playwright/test';

test('boot smoke test', async () => {
  // Launch the packaged Electron app against dist/ (not source)
  // Set NODE_ENV=production to force the app to use app:// protocol
  // instead of trying to connect to localhost:5173 (vite dev server)
  const electronApp = await _electron.launch({
    args: ['.', '--no-sandbox'],
    env: { NODE_ENV: 'production' },
    chromiumSandbox: false,
    headless: true,
  });

  // Catch process exit/crash events for diagnostics
  electronApp.on('close', (exitCode) => {
    console.error('[electron] Process closed with exit code:', exitCode); // eslint-disable-line no-console
  });

  // Capture stderr/stdout from the Electron process to diagnose startup failures
  electronApp.on('output', (text) => {
    if (text.trim()) console.log('[electron]', text.trim()); // eslint-disable-line no-console
  });

  // firstWindow() returns the first window (existing or newly created), more reliable
  // than waitForEvent('window') in headless mode where events can race
  const window = await electronApp.firstWindow({ timeout: 90_000 });
  expect(window).toBeDefined('Electron app failed to open a window');

  // --- W0.1 guard: preload script must have loaded, exposing window.electronAPI ---
  const electronAPI = await window.evaluate(() => window.electronAPI);
  expect(electronAPI).toBeDefined();

  // --- W0.3 guard: device ID must NOT be the dev fallback 'windows-dev' ---
  const deviceId = await window.evaluate(() => window.electronAPI!.getDeviceId());
  expect(deviceId).not.toBe('windows-dev');

  // --- W0.4 guard: renderer must have navigated to a /app/* route ---
  const pageUrl = window.url();
  const url = new URL(pageUrl);
  expect(url.pathname).toMatch(/^\/app/);

  // --- Console cleanliness: zero CSP violations and zero preload errors ---
  const consoleViolations: string[] = [];
  const page = await window.page();
  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      const text = msg.text();
      if (
        text.includes('Content Security Policy') ||
        text.includes('Unable to load preload script')
      ) {
        consoleViolations.push(text);
      }
    }
  });

  // Give the renderer a moment to settle and emit any console errors
  await window.waitForTimeout(2_000);

  expect(consoleViolations, `Console violations found: ${JSON.stringify(consoleViolations)}`).toHaveLength(0);

  // Clean shutdown — exit non-zero on any failure above
  await electronApp.close();
});
