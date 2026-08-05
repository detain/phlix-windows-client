# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: boot.spec.ts >> boot smoke test
- Location: tests/smoke/boot.spec.ts:11:5

# Error details

```
Error: expect(received).toBe(expected) // Object.is equality

Expected: true
Received: false
```

# Test source

```ts
  1   | import { test, expect, chromium } from '@playwright/test';
  2   | import { spawn } from 'child_process';
  3   | import path from 'path';
  4   | 
  5   | interface ElectronWindow extends Window {
  6   |   electronAPI?: { getDeviceId: () => Promise<string> };
  7   | }
  8   | 
  9   | const ELECTRON_PORT = 9222;
  10  | 
  11  | test('boot smoke test', async () => {
  12  |   const distMainPath = path.resolve(__dirname, '../../dist/main/index.js');
  13  | 
  14  |   const electronProcess = spawn(
  15  |     'electron',
  16  |     [
  17  |       distMainPath,
  18  |       '--disable-gpu',
  19  |       `--remote-debugging-port=${ELECTRON_PORT}`,
  20  |     ],
  21  |     {
  22  |       detached: true,
  23  |       stdio: 'ignore',
  24  |       env: {
  25  |         ...process.env,
  26  |         NODE_ENV: 'production',
  27  |         PHLIX_FORCE_PRODUCTION: '1',
  28  |         ELECTRON_DISABLE_GPU: '1',
  29  |       },
  30  |     }
  31  |   );
  32  |   electronProcess.unref();
  33  | 
  34  |   await new Promise<void>(resolve => setTimeout(resolve, 5_000));
  35  | 
  36  |   if (electronProcess.exitCode !== null) {
  37  |     throw new Error(`Electron process exited early with code ${electronProcess.exitCode}`);
  38  |   }
  39  | 
  40  |   let browser;
  41  |   try {
  42  |     browser = await chromium.connectOverCDP(
  43  |       `http://localhost:${ELECTRON_PORT}`,
  44  |       { timeout: 60_000 }  // Increased to 60s
  45  |     );
  46  |   } catch (e) {
  47  |     electronProcess.kill();
  48  |     throw e;
  49  |   }
  50  | 
  51  |   // Poll for a real page
  52  |   let page = null;
  53  |   const startTime = Date.now();
  54  |   while (Date.now() - startTime < 60_000) {
  55  |     const candidates = browser.contexts().flatMap(c => c.pages()).filter(p => {
  56  |       try {
  57  |         const u = new URL(p.url());
  58  |         return !['about:blank', 'chrome-error:', 'devtools:'].includes(u.protocol);
  59  |       } catch {
  60  |         return false;
  61  |       }
  62  |     });
  63  |     if (candidates.length > 0) {
  64  |       page = candidates[0];
  65  |       console.log(`[smoke] Found page after ${Date.now() - startTime}ms: ${page.url()}`);
  66  |       break;
  67  |     }
  68  |     await new Promise<void>(r => setTimeout(r, 2_000));
  69  |   }
  70  | 
  71  |   if (!page) {
  72  |     const candidates = browser.contexts().flatMap(c => c.pages()).map(p => p.url());
  73  |     await browser.close();
  74  |     electronProcess.kill();
  75  |     throw new Error(`No real page found. Candidates: ${JSON.stringify(candidates)}`);
  76  |   }
  77  | 
  78  |   try {
  79  |     await page.waitForLoadState('domcontentloaded');
  80  | 
  81  |     const api = await page.evaluate(() => (globalThis as unknown as ElectronWindow).electronAPI);
  82  |     expect(api).toBeDefined();
  83  | 
  84  |     const deviceId = await page.evaluate(
  85  |       () => (globalThis as unknown as ElectronWindow).electronAPI!.getDeviceId()
  86  |     );
  87  |     expect(deviceId).not.toBe('windows-dev');
  88  | 
  89  |     const vueMounted = await page.evaluate(() => {
  90  |       const el = document.querySelector('#phlix-app[data-v-app]');
  91  |       return el !== null && el.children.length > 0;
  92  |     });
> 93  |     expect(vueMounted).toBe(true);
      |                        ^ Error: expect(received).toBe(expected) // Object.is equality
  94  | 
  95  |     const violations: string[] = [];
  96  |     page.on('console', msg => {
  97  |       if (msg.type() === 'error' && (msg.text().includes('Content Security Policy') || msg.text().includes('Unable to load preload script'))) {
  98  |         violations.push(msg.text());
  99  |       }
  100 |     });
  101 |     await page.waitForTimeout(2_000);
  102 |     expect(violations, `Console violations: ${JSON.stringify(violations)}`).toHaveLength(0);
  103 |   } finally {
  104 |     await browser.close();
  105 |     electronProcess.kill();
  106 |   }
  107 | });
  108 | 
```