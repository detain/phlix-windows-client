# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: boot.spec.ts >> boot smoke test
- Location: tests/smoke/boot.spec.ts:24:5

# Error details

```
Error: Electron process exited early with code 1
```

# Test source

```ts
  1   | /**
  2   |  * Boot smoke test — spawns Electron as a detached child process, then attaches
  3   |  * via Playwright's CDP (Chrome DevTools Protocol) connection.
  4   |  *
  5   |  * This bypasses Playwright's built-in Electron launcher entirely, which avoids
  6   |  * the per-run Electron binary download that was eating into the firstWindow()
  7   |  * timeout budget.
  8   |  *
  9   |  * Guards against:
  10  |  * - W0.1: window.electronAPI not defined (preload script failed to load)
  11  |  * - W0.3: device ID hardcoded as 'windows-dev' instead of a real UUID
  12  |  * - W0.4: renderer not navigating to /app/* route
  13  |  *
  14  |  * @copyright 2026 Joe Huss <detain@interserver.net>
  15  |  */
  16  | 
  17  | import { test, expect, chromium } from '@playwright/test';
  18  | import { spawn } from 'child_process';
  19  | import path from 'path';
  20  | 
  21  | const ELECTRON_PORT = 9222;
  22  | const ELECTRON_HOST = 'localhost';
  23  | 
  24  | test('boot smoke test', async () => {
  25  |   // Path to the compiled main process entry
  26  |   const distMainPath = path.resolve(__dirname, '../../dist/main/index.js');
  27  | 
  28  |   // Spawn Electron as a detached background process with remote debugging
  29  |   // Windows npm creates electron.cmd, not electron
  30  |   const electronCmd = process.platform === 'win32' ? 'electron.cmd' : 'electron';
  31  |   const electronProcess = spawn(
  32  |     electronCmd,
  33  |     [
  34  |       distMainPath,
  35  |       `--disable-gpu`,
  36  |       `--no-sandbox`,
  37  |       `--remote-debugging-port=${ELECTRON_PORT}`,
  38  |     ],
  39  |     {
  40  |       detached: true,
  41  |       stdio: 'ignore',
  42  |       shell: process.platform === 'win32',
  43  |       env: {
  44  |         ...process.env,
  45  |         NODE_ENV: 'production',
  46  |         ELECTRON_DISABLE_GPU: '1',
  47  |         PHLIX_FORCE_PRODUCTION: '1',
  48  |         DISPLAY: process.env.DISPLAY,
  49  |       },
  50  |     }
  51  |   );
  52  | 
  53  |   // Prevent the child process from keeping the parent alive
  54  |   electronProcess.unref();
  55  | 
  56  |   // Give Electron time to start before attempting CDP connection
  57  |   await new Promise((resolve) => setTimeout(resolve, 5_000));
  58  | 
  59  |   if (electronProcess.exitCode !== null) {
  60  |     electronProcess.kill();
> 61  |     throw new Error(`Electron process exited early with code ${electronProcess.exitCode}`);
      |           ^ Error: Electron process exited early with code 1
  62  |   }
  63  | 
  64  |   // Attach Playwright to the running Electron instance via CDP
  65  |   let browser;
  66  |   try {
  67  |     browser = await chromium.connectOverCDP(
  68  |       `http://${ELECTRON_HOST}:${ELECTRON_PORT}`,
  69  |       { timeout: 30_000 }
  70  |     );
  71  |   } catch (connectError) {
  72  |     electronProcess.kill();
  73  |     throw new Error(
  74  |       `Failed to connect to Electron via CDP: ${connectError}`
  75  |     );
  76  |   }
  77  | 
  78  |   // Get or create the first browser context and its pages
  79  |   let context = browser.contexts()[0];
  80  |   if (!context) {
  81  |     context = await browser.newContext();
  82  |   }
  83  | 
  84  |   const pages = context.pages();
  85  |   const window = pages[0];
  86  | 
  87  |   if (!window) {
  88  |     await browser.close();
  89  |     electronProcess.kill();
  90  |     throw new Error('No window found in Electron CDP session');
  91  |   }
  92  | 
  93  |   // --- W0.1 guard: preload script must have loaded, exposing window.electronAPI ---
  94  |   const electronAPI = await window.evaluate(() => (globalThis as unknown as Window).electronAPI);
  95  |   expect(electronAPI).toBeDefined();
  96  | 
  97  |   // --- W0.3 guard: device ID must NOT be the dev fallback 'windows-dev' ---
  98  |   const deviceId = await window.evaluate(
  99  |     () => (globalThis as unknown as Window).electronAPI!.getDeviceId()
  100 |   );
  101 |   expect(deviceId).not.toBe('windows-dev');
  102 | 
  103 |   // --- W0.4 guard: renderer must have navigated to a /app/* route ---
  104 |   const pageUrl = window.url();
  105 |   const url = new URL(pageUrl);
  106 |   expect(url.pathname).toMatch(/^\/app/);
  107 | 
  108 |   // --- Console cleanliness: zero CSP violations and zero preload errors ---
  109 |   const consoleViolations: string[] = [];
  110 |   const page = window;
  111 |   page.on('console', (msg) => {
  112 |     if (msg.type() === 'error') {
  113 |       const text = msg.text();
  114 |       if (
  115 |         text.includes('Content Security Policy') ||
  116 |         text.includes('Unable to load preload script')
  117 |       ) {
  118 |         consoleViolations.push(text);
  119 |       }
  120 |     }
  121 |   });
  122 | 
  123 |   await (window as any).waitForTimeout(2_000);
  124 |   expect(
  125 |     consoleViolations,
  126 |     `Console violations found: ${JSON.stringify(consoleViolations)}`
  127 |   ).toHaveLength(0);
  128 | 
  129 |   await browser.close();
  130 | 
  131 |   // Clean up the Electron process
  132 |   electronProcess.kill();
  133 | });
  134 | 
```