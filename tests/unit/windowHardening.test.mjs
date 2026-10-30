/**
 * @vitest-environment node
 *
 * Main-process hardening pins (W-min206): structural guarantees on
 * src/main/index.ts for the cures whose behavior lives inside the Electron
 * boot path and cannot be exercised per-process in unit scope. Each pin is
 * anchored on INVOCATION shapes, not prose (law: comments naming these
 * literals must not poison the regexes — keep pin forms line-anchored).
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const read = (p) => readFileSync(resolve(__dirname, '../../', p), 'utf-8');
const main = read('src/main/index.ts');

describe('M-WINDOWS-16: background throttling off for the session window', () => {
  it('webPreferences carries backgroundThrottling false', () => {
    const wp = main.slice(main.indexOf('webPreferences: {'));
    expect(wp.slice(0, 1200)).toMatch(/^\s*backgroundThrottling:\s*false,/m);
  });
});

describe('M-WINDOWS-18: will-navigate uses the navigation law', () => {
  it('the handler calls validateNavigationUrl, not the external-only guard', () => {
    const idx = main.indexOf("on('will-navigate'");
    expect(idx).toBeGreaterThan(-1);
    const slice = main.slice(idx, idx + 400);
    expect(slice).toMatch('validateNavigationUrl(url)');
  });
  it('setWindowOpenHandler keeps the external-only law (popups never self-navigate)', () => {
    const idx = main.indexOf('setWindowOpenHandler');
    expect(main.slice(idx, idx + 300)).toMatch('validateExternalUrl(url)');
  });
});

describe('M-WINDOWS-19: protocol registration is one honest call', () => {
  it('the dead if/else is gone — single setAsDefaultProtocolClient call', () => {
    const idx = main.indexOf('function setAsDefaultProtocolClient');
    const slice = main.slice(idx, idx + 1400);
    expect(slice).toMatch('app.setAsDefaultProtocolClient(');
    expect((slice.match(/app\.setAsDefaultProtocolClient\(/g) ?? []).length).toBe(1);
    expect(slice).not.toMatch(/if\s*\(app\.isPackaged\)/);
  });
});

describe('M-WINDOWS-23: dev posture of the updater', () => {
  it('automatic checks only arm when packaged', () => {
    expect(main).toMatch(/if\s*\(app\.isPackaged\)\s*\{[^}]*setTimeout\([\s\S]{0,80}?autoUpdater\.checkForUpdates/s);
    expect(main).toMatch(/if\s*\(app\.isPackaged\)\s*\{[\s\S]{0,600}?_updateCheckTimer = setInterval/);
  });
  it('the quiet classifier covers the dev failure mode (missing app-update.yml / ENOENT)', () => {
    const idx = main.indexOf("message.includes('net::ERR_')");
    expect(idx).toBeGreaterThan(-1);
    const block = main.slice(idx - 60, idx + 500);
    expect(block).toMatch(/includes\('app-update\.yml'\)/);
    expect(block).toMatch(/includes\('ENOENT'\)/);
  });
});

describe('M-WINDOWS-32: dev tools and reload only in dev menus', () => {
  it('the inspector roles sit behind the isDev spread', () => {
    expect(main).toMatch(/\.\.\.\(isDev\s*\?/);
    const idx = main.indexOf("role: 'reload'");
    expect(idx).toBeGreaterThan(-1);
    const around = main.slice(idx - 260, idx + 400);
    for (const role of ["role: 'reload'", "role: 'forceReload'", "role: 'toggleDevTools'"]) {
      expect(around).toContain(role);
    }
  });
  it('the roles appear exactly once in the file (no unguarded twin)', () => {
    expect((main.match(/role: 'toggleDevTools'/g) ?? []).length).toBe(1);
    expect((main.match(/role: 'forceReload'/g) ?? []).length).toBe(1);
  });
});

describe('M-WINDOWS-09: renderer crash gets a user-facing recovery', () => {
  it('render-process-gone releases the blocker AND offers reload', () => {
    const idx = main.indexOf("on('render-process-gone'");
    expect(idx).toBeGreaterThan(-1);
    const slice = main.slice(idx, idx + 900);
    expect(slice).toMatch('ensurePowerBlocker(false)');
    expect(slice).toMatch('crashRecoveryDialog()');
    expect(slice).toMatch('details.reason');
  });
  it('the recovery dialog reloads the window on the affirmative button', () => {
    const idx = main.indexOf('function crashRecoveryDialog');
    expect(idx).toBeGreaterThan(-1);
    const slice = main.slice(idx, idx + 1200);
    expect(slice).toMatch("t('crash.reload')");
    expect(slice).toMatch('response.response === 0');
    expect(slice).toMatch('.reload()');
  });
  it('uncaughtException keeps log-and-continue with an honest note', () => {
    const idx = main.indexOf("process.on('uncaughtException'");
    expect(idx).toBeGreaterThan(-1);
    expect(main.slice(idx - 560, idx)).toMatch(/M-WINDOWS-09/);
  });
});

describe('M-WINDOWS-14: tray takes the shell-picked multi-size icon', () => {
  it('createTray prefers icon.ico and falls back to the png path', () => {
    const idx = main.indexOf('export function createTray');
    const slice = main.slice(idx, idx + 1000);
    expect(slice).toMatch("build/icon.ico");
    expect(slice).toMatch("build/icon.png");
    // the forced single-size resize survives ONLY on the fallback branch
    const resizeCount = (slice.match(/\.resize\(\{ width: 16, height: 16 \}\)/g) ?? []).length;
    expect(resizeCount).toBeLessThanOrEqual(1);
  });
});
