import {chromium} from '@playwright/test';
import {spawn} from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ELECTRON_PORT = 9222;
const distMainPath = path.resolve(__dirname, 'dist/main/index.js');
const ELECTRON_BIN = path.resolve(__dirname, 'node_modules/electron/dist/electron');

console.log('distMainPath:', distMainPath);
console.log('ELECTRON_BIN:', ELECTRON_BIN);

const electronProcess = spawn(
  ELECTRON_BIN,
  [distMainPath, '--disable-gpu', '--no-sandbox', '--remote-debugging-port=' + ELECTRON_PORT],
  {
    detached: true,
    stdio: 'ignore',
    env: { ...process.env, NODE_ENV: 'production', PHLIX_FORCE_PRODUCTION: '1' }
  }
);
electronProcess.unref();

console.log('Electron PID:', electronProcess.pid);
await new Promise(r => setTimeout(r, 5000));

if (electronProcess.exitCode !== null) {
  console.log('Electron exited early with code:', electronProcess.exitCode);
}

let browser;
try {
  browser = await chromium.connectOverCDP('http://localhost:' + ELECTRON_PORT, { timeout: 30000 });
} catch(e) {
  console.log('CDP connect failed:', e.message);
  electronProcess.kill();
  process.exit(1);
}

let page = null;
const startTime = Date.now();
while (Date.now() - startTime < 30000) {
  const candidates = browser.contexts().flatMap(c => c.pages()).filter(p => {
    try {
      const u = new URL(p.url());
      return !['about:blank', 'chrome-error:', 'devtools:'].includes(u.protocol);
    } catch { return false; }
  });
  if (candidates.length > 0) {
    page = candidates[0];
    console.log('Found page after', Date.now() - startTime, 'ms:', page.url());
    break;
  }
  await new Promise(r => setTimeout(r, 2000));
}

if (!page) {
  const urls = browser.contexts().flatMap(c => c.pages()).map(p => p.url());
  console.log('No page found. Candidates:', JSON.stringify(urls));
  await browser.close();
  electronProcess.kill();
  process.exit(1);
}

const consoleLogs = [];
page.on('console', m => consoleLogs.push({type: m.type(), text: m.text().slice(0,200)}));
page.on('pageerror', e => consoleLogs.push({type: 'pageerror', text: e.message.slice(0,200)}));

await page.waitForLoadState('domcontentloaded');
await new Promise(r => setTimeout(r, 3000));

const url = page.url();
const phlixAppOuter = await page.evaluate(() => document.querySelector('#phlix-app')?.outerHTML?.slice(0, 300));
const phlixAppInner = await page.evaluate(() => document.querySelector('#phlix-app')?.innerHTML?.slice(0, 300));
const bodyContent = await page.evaluate(() => document.body.innerHTML.slice(0, 300));

console.log('=== URL:', url);
console.log('=== PHX_APP_OUTER:', phlixAppOuter);
console.log('=== PHX_APP_INNER:', phlixAppInner);
console.log('=== BODY:', bodyContent);
console.log('=== CONSOLE_LOGS:', JSON.stringify(consoleLogs.slice(0,20), null, 2));

await browser.close();
electronProcess.kill();