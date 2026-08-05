import { test, expect, chromium } from '@playwright/test';
import { spawn } from 'child_process';
import path from 'path';

interface ElectronWindow extends Window {
  electronAPI?: { getDeviceId: () => Promise<string> };
}

const ELECTRON_PORT = 9222;

test('boot smoke test', async () => {
  const distMainPath = path.resolve(__dirname, '../../dist/main/index.js');

  const electronProcess = spawn(
    'electron',
    [
      distMainPath,
      '--disable-gpu',
      `--remote-debugging-port=${ELECTRON_PORT}`,
    ],
    {
      detached: true,
      stdio: 'ignore',
      env: {
        ...process.env,
        NODE_ENV: 'production',
        PHLIX_FORCE_PRODUCTION: '1',
        ELECTRON_DISABLE_GPU: '1',
      },
    }
  );
  electronProcess.unref();

  await new Promise<void>(resolve => setTimeout(resolve, 5_000));

  if (electronProcess.exitCode !== null) {
    throw new Error(`Electron process exited early with code ${electronProcess.exitCode}`);
  }

  let browser;
  try {
    browser = await chromium.connectOverCDP(
      `http://localhost:${ELECTRON_PORT}`,
      { timeout: 60_000 }  // Increased to 60s
    );
  } catch (e) {
    electronProcess.kill();
    throw e;
  }

  // Poll for a real page
  let page = null;
  const startTime = Date.now();
  while (Date.now() - startTime < 60_000) {
    const candidates = browser.contexts().flatMap(c => c.pages()).filter(p => {
      try {
        const u = new URL(p.url());
        return !['about:blank', 'chrome-error:', 'devtools:'].includes(u.protocol);
      } catch {
        return false;
      }
    });
    if (candidates.length > 0) {
      page = candidates[0];
      console.log(`[smoke] Found page after ${Date.now() - startTime}ms: ${page.url()}`);
      break;
    }
    await new Promise<void>(r => setTimeout(r, 2_000));
  }

  if (!page) {
    const candidates = browser.contexts().flatMap(c => c.pages()).map(p => p.url());
    await browser.close();
    electronProcess.kill();
    throw new Error(`No real page found. Candidates: ${JSON.stringify(candidates)}`);
  }

  try {
    await page.waitForLoadState('domcontentloaded');

    const api = await page.evaluate(() => (globalThis as unknown as ElectronWindow).electronAPI);
    expect(api).toBeDefined();

    const deviceId = await page.evaluate(
      () => (globalThis as unknown as ElectronWindow).electronAPI!.getDeviceId()
    );
    expect(deviceId).not.toBe('windows-dev');

    const vueMounted = await page.evaluate(() => {
      const el = document.querySelector('#phlix-app[data-v-app]');
      return el !== null && el.children.length > 0;
    });
    expect(vueMounted).toBe(true);

    const violations: string[] = [];
    page.on('console', msg => {
      if (msg.type() === 'error' && (msg.text().includes('Content Security Policy') || msg.text().includes('Unable to load preload script'))) {
        violations.push(msg.text());
      }
    });
    await page.waitForTimeout(2_000);
    expect(violations, `Console violations: ${JSON.stringify(violations)}`).toHaveLength(0);
  } finally {
    await browser.close();
    electronProcess.kill();
  }
});
