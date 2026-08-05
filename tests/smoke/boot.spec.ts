/**
 * Boot smoke test — spawns Electron as a detached child process, then attaches
 * via Playwright's CDP (Chrome DevTools Protocol) connection.
 *
 * This bypasses Playwright's built-in Electron launcher entirely, which avoids
 * the per-run Electron binary download that was eating into the firstWindow()
 * timeout budget.
 *
 * Guards against:
 * - W0.1: window.electronAPI not defined (preload script failed to load)
 * - W0.3: device ID hardcoded as 'windows-dev' instead of a real UUID
 * - W0.4: renderer not navigating to /app/* route
 *
 * @copyright 2026 Joe Huss <detain@interserver.net>
 */

import { test, expect, chromium } from '@playwright/test';
import { spawn } from 'child_process';
import path from 'path';

const ELECTRON_PORT = 9222;
const ELECTRON_HOST = 'localhost';

test('boot smoke test', async () => {
  // Path to the compiled main process entry
  const distMainPath = path.resolve(__dirname, '../../dist/main/index.js');

  // Spawn Electron as a detached background process with remote debugging
  // Windows npm creates electron.cmd, not electron
  const electronCmd = process.platform === 'win32' ? 'electron.cmd' : 'electron';
  const electronProcess = spawn(
    electronCmd,
    [
      distMainPath,
      `--disable-gpu`,
      `--no-sandbox`,
      `--remote-debugging-port=${ELECTRON_PORT}`,
    ],
    {
      detached: true,
      stdio: 'ignore',
      env: {
        ...process.env,
        NODE_ENV: 'production',
        ELECTRON_DISABLE_GPU: '1',
        PHLIX_FORCE_PRODUCTION: '1',
        DISPLAY: process.env.DISPLAY,
      },
    }
  );

  // Prevent the child process from keeping the parent alive
  electronProcess.unref();

  // Give Electron time to start before attempting CDP connection
  await new Promise((resolve) => setTimeout(resolve, 5_000));

  if (electronProcess.exitCode !== null) {
    electronProcess.kill();
    throw new Error(`Electron process exited early with code ${electronProcess.exitCode}`);
  }

  // Attach Playwright to the running Electron instance via CDP
  let browser;
  try {
    browser = await chromium.connectOverCDP(
      `http://${ELECTRON_HOST}:${ELECTRON_PORT}`,
      { timeout: 30_000 }
    );
  } catch (connectError) {
    electronProcess.kill();
    throw new Error(
      `Failed to connect to Electron via CDP: ${connectError}`
    );
  }

  // Get or create the first browser context and its pages
  let context = browser.contexts()[0];
  if (!context) {
    context = await browser.newContext();
  }

  const pages = context.pages();
  const window = pages[0];

  if (!window) {
    await browser.close();
    electronProcess.kill();
    throw new Error('No window found in Electron CDP session');
  }

  // --- W0.1 guard: preload script must have loaded, exposing window.electronAPI ---
  const electronAPI = await window.evaluate(() => (window as Window).electronAPI);
  expect(electronAPI).toBeDefined();

  // --- W0.3 guard: device ID must NOT be the dev fallback 'windows-dev' ---
  const deviceId = await window.evaluate(
    () => (window as Window).electronAPI!.getDeviceId()
  );
  expect(deviceId).not.toBe('windows-dev');

  // --- W0.4 guard: renderer must have navigated to a /app/* route ---
  const pageUrl = window.url();
  const url = new URL(pageUrl);
  expect(url.pathname).toMatch(/^\/app/);

  // --- Console cleanliness: zero CSP violations and zero preload errors ---
  const consoleViolations: string[] = [];
  const page = window;
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
  expect(
    consoleViolations,
    `Console violations found: ${JSON.stringify(consoleViolations)}`
  ).toHaveLength(0);

  await browser.close();

  // Clean up the Electron process
  electronProcess.kill();
});
