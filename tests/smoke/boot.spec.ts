/**
 * Boot smoke test — spawns Electron as a detached child process, then attaches
 * via Playwright's CDP (Chrome DevTools Protocol) connection.
 *
 * This bypasses Playwright's built-in Electron launcher entirely, which avoids
 * the per-run Electron binary download that was eating into the firstWindow()
 * timeout budget.
 *
 * On Linux, wraps Electron with xvfb-run to provide a virtual display for
 * headless CI environments.
 *
 * Guards against:
 * - W0.1: window.electronAPI not defined (preload script failed to load)
 * - W0.3: device ID hardcoded as 'windows-dev' instead of a real UUID
 * - W0.4: renderer not navigating to /app/* route
 * - W0.4b/c: renderer committing an app:// error page (403 'Forbidden' / 404) or
 *   an unmounted shell instead of the booted SPA — content assertions, because
 *   the URL regex alone passed for ~8 weeks while the window rendered the
 *   protocol handler's 403 page (boot defect fixed in f659ab0; preload guards
 *   W0.1/W0.3 also pass on error pages, so only rendered content can tell).
 *
 * @copyright 2026 Joe Huss <detain@interserver.net>
 */

import { test, expect, chromium } from '@playwright/test';
import { spawn, type ChildProcess } from 'child_process';
import path from 'path';

const ELECTRON_PORT = 9222;
// Electron binds the CDP endpoint to 127.0.0.1 (IPv4) only. Using "localhost"
// makes Playwright resolve to ::1 first on CI and fail with ECONNREFUSED, so pin
// both sides to IPv4 explicitly.
const ELECTRON_HOST = '127.0.0.1';

/**
 * Kill the Electron process AND its process group.
 *
 * The child is spawned with `detached: true`, so it leads its own process group
 * (xvfb-run → Xvfb → Electron → renderer/gpu children). Killing just the direct
 * child leaves Electron running orphaned — it keeps the single-instance lock and
 * holds port 9222, which makes subsequent smoke runs fail to bind. On POSIX,
 * signal the negative PID (the group); on Windows fall back to the plain kill.
 */
function killElectronProcess(proc: ChildProcess): void {
  if (!proc.pid) return;
  if (process.platform !== 'win32') {
    try {
      process.kill(-proc.pid, 'SIGTERM');
      return;
    } catch {
      // Group kill failed — fall through to a direct kill.
    }
  }
  proc.kill();
}

// An assertion failure mid-test must never leak the detached Electron group:
// the survivor keeps the CDP port (9222) and the app single-instance lock, so
// the NEXT smoke run would silently attach to the stale instance instead of
// its own build — observed while hardening W0.4b (a falsification failure left
// a Forbidden-page instance running and poisoned the following green check).
// afterEach runs on every exit path; killElectronProcess is idempotent.
let activeElectron: ChildProcess | null = null;

test.afterEach(() => {
  if (activeElectron) {
    killElectronProcess(activeElectron);
    activeElectron = null;
  }
});

test('boot smoke test', async () => {
  // Path to the compiled main process entry
  const distMainPath = path.resolve(__dirname, '../../dist/main/index.js');

  // Build the spawn command based on platform
  // Windows: use electron.cmd directly
  // Linux: wrap with xvfb-run to provide virtual display in headless CI
  const isWindows = process.platform === 'win32';
  const isLinux = process.platform === 'linux';

  const electronArgs = [
    distMainPath,
    `--disable-gpu`,
    `--no-sandbox`,
    `--remote-debugging-address=${ELECTRON_HOST}`,
    `--remote-debugging-port=${ELECTRON_PORT}`,
  ];

  let spawnCmd: string;
  let spawnArgs: string[];

  if (isLinux) {
    // On Linux, use xvfb-run to provide a virtual X server display
    spawnCmd = 'xvfb-run';
    spawnArgs = [
      '--auto-servernum',
      '--server-args=-screen 0 1280x720x24',
      'electron',
      ...electronArgs,
    ];
  } else {
    // Windows npm creates electron.cmd, not electron
    spawnCmd = isWindows ? 'electron.cmd' : 'electron';
    spawnArgs = electronArgs;
  }

  const electronProcess = spawn(
    spawnCmd,
    spawnArgs,
    {
      detached: true,
      stdio: ['ignore', 'pipe', 'pipe'],
      shell: isWindows,
      env: {
        ...process.env,
        NODE_ENV: 'production',
        // Force production mode so the renderer is served from dist/ via the
        // app:// protocol instead of dev mode (which opens DevTools and tries to
        // load the Vite dev server). ELECTRON_DISABLE_GPU avoids GPU-process
        // crashes under xvfb. DISPLAY is intentionally omitted: xvfb-run sets it
        // for the Electron child.
        PHLIX_FORCE_PRODUCTION: '1',
        ELECTRON_DISABLE_GPU: '1',
      },
    }
  );

  // Registered immediately so the afterEach sweeper covers every later exit
  // path, including assertion failures (see comment on activeElectron).
  activeElectron = electronProcess;

  // Capture the child's output so a CI failure shows WHY Electron did not come
  // up (spawn errors, missing libraries, crashes) instead of a bare ECONNREFUSED.
  let childOutput = '';
  electronProcess.stdout?.on('data', (chunk) => { childOutput += chunk.toString(); });
  electronProcess.stderr?.on('data', (chunk) => { childOutput += chunk.toString(); });

  // Prevent the child process from keeping the parent alive
  electronProcess.unref();

  // Poll for the CDP endpoint instead of a fixed sleep — slow CI runners can
  // take longer than 5s to bring the browser process up, and a fixed sleep
  // fails both when the app is slow AND when it crashed (with no diagnostics).
  const cdpUrl = `http://${ELECTRON_HOST}:${ELECTRON_PORT}`;
  let cdpReady = false;
  for (let attempt = 0; attempt < 50; attempt++) {
    if (electronProcess.exitCode !== null) break;
    try {
      const res = await fetch(`${cdpUrl}/json/version`);
      if (res.ok) {
        cdpReady = true;
        break;
      }
    } catch {
      // Endpoint not up yet — keep polling.
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  if (electronProcess.exitCode !== null) {
    killElectronProcess(electronProcess);
    throw new Error(
      `Electron process exited early with code ${electronProcess.exitCode}\n--- child output ---\n${childOutput}`
    );
  }

  if (!cdpReady) {
    killElectronProcess(electronProcess);
    throw new Error(
      `Electron never exposed the CDP endpoint at ${cdpUrl}\n--- child output ---\n${childOutput}`
    );
  }

  // Attach Playwright to the running Electron instance via CDP
  let browser;
  try {
    browser = await chromium.connectOverCDP(cdpUrl, { timeout: 30_000 });
  } catch (connectError) {
    killElectronProcess(electronProcess);
    throw new Error(
      `Failed to connect to Electron via CDP: ${connectError}\n--- child output ---\n${childOutput}`
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
    killElectronProcess(electronProcess);
    throw new Error('No window found in Electron CDP session');
  }

  // --- W0.1 guard: preload script must have loaded, exposing window.electronAPI ---
  const electronAPI = await window.evaluate(() => (globalThis as unknown as Window).electronAPI);
  expect(electronAPI).toBeDefined();

  // --- W0.3 guard: device ID must NOT be the dev fallback 'windows-dev' ---
  const deviceId = await window.evaluate(
    () => (globalThis as unknown as Window).electronAPI!.getDeviceId()
  );
  expect(deviceId).not.toBe('windows-dev');

  // --- W0.4 guard: renderer must have navigated to a /app/* route ---
  // Warning: the URL alone proves nothing about WHAT was served. During the
  // boot-403 defect the window sat at a URL matching this very regex while the
  // committed document was the protocol handler's 'Forbidden' error page.
  // The content guards below (W0.4b/c) are what actually pin the boot.
  const pageUrl = window.url();
  const url = new URL(pageUrl);
  expect(url.pathname).toMatch(/^\/app/);

  // --- W0.4b guard: the committed document must not carry an app:// error-page
  // signature. setupAppProtocolHandler() emits exactly `new Response('Forbidden',
  // { status: 403 })` (and a 'Not Found' 404 fallback); Chromium commits those
  // bodies as the page document, so the marker text lands in <body>. Checked
  // first because it fails fast with the rendered text in the message.
  const documentText = await window.evaluate(() => {
    const element = document.body ?? document.documentElement;
    return element ? (element.textContent ?? '') : '<no document body>';
  });
  expect(
    documentText,
    `boot document carries an app:// error-page signature; rendered document was: ${JSON.stringify(documentText.slice(0, 200))}`
  ).not.toMatch(/Forbidden/);

  // --- W0.4c guard: the SPA shell must be present AND mounted ---
  // index.html declares <div id="phlix-app"></div> and boot() calls
  // app.mount('#phlix-app'); Vue renders into the container, so any child node
  // (element or placeholder comment) exists only after mount. Presence alone
  // proves index.html was served; children prove the renderer booted.
  await window.waitForSelector('#phlix-app', { state: 'attached', timeout: 15_000 });
  // Throws on timeout if nothing ever renders into the container — that IS the
  // assertion (JSHandle resolution carries no extra signal).
  await window.waitForFunction(
    () => (document.querySelector('#phlix-app')?.childNodes.length ?? 0) > 0,
    undefined,
    { timeout: 15_000 }
  );

  // --- W0.4d guard (title): the deterministic part is hard — the shell's
  // <title> is 'Phlix' and the post-mount router title keeps the 'Phlix' suffix
  // (probe at f659ab0: 'Connect to your server · Phlix'); an error document's
  // title contains neither. The exact router string is version-dependent, so it
  // is recorded as an annotation rather than pinned.
  const title = await window.title();
  expect(
    title,
    `document title must be ours ('Phlix' shell or router-suffixed) — got '${title}'`
  ).toContain('Phlix');
  test.info().annotations.push({
    type: 'boot-title',
    description: `document.title = '${title}'`,
  });

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

  await page.waitForTimeout(2000);
  expect(
    consoleViolations,
    `Console violations found: ${JSON.stringify(consoleViolations)}`
  ).toHaveLength(0);

  await browser.close();

  // Clean up the Electron process (and its whole process group)
  killElectronProcess(electronProcess);
  activeElectron = null;
});
