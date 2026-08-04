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
  // Launch the packaged Electron app against dist/
  const electronApp = await _electron.launch({
    args: ['.', '--no-sandbox', '--disable-gpu', '--disable-software-rasterizer', '--disable-dev-shm-usage', '--disable-accelerated-2d-canvas', '--no-first-run', '--no-zygote', '--single-process', '--disable-ipc-flooding-protection', '--disable-features=NetworkService,VizDisplayCompositor,ChromeUILoadTimes', '--disable-gpu-compositing', '--headless=new'],
    env: { NODE_ENV: 'production' },
    chromiumSandbox: false,
  });

  // Diagnostic: capture ALL Electron output
  const electronOutput: string[] = [];
  electronApp.on('output', (text) => {
    if (text.trim()) electronOutput.push(text.trim());
  });

  // Catch abnormal exits
  electronApp.on('close', (exitCode) => {
    if (exitCode !== 0) {
      console.error('[electron] Abnormal exit with code:', exitCode, 'Output:', electronOutput.join('\n')); // eslint-disable-line no-console
    }
  });

  // Try to get the first window with a reasonable timeout
  let window;
  try {
    window = await electronApp.firstWindow({ timeout: 90_000 });
  } catch (e) {
    // If firstWindow() times out, check if ANY windows exist anyway
    const windows = electronApp.windows();
    if (windows.length > 0) {
      window = windows[0];
    } else {
      // Electron output for debugging
      console.error('[electron] firstWindow() timed out. Electron output:\n', electronOutput.join('\n')); // eslint-disable-line no-console
      throw e;
    }
  }

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

  await window.waitForTimeout(2_000);
  expect(consoleViolations, `Console violations found: ${JSON.stringify(consoleViolations)}`).toHaveLength(0);

  await electronApp.close();
});
