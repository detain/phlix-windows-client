/**
 * @vitest-environment node
 *
 * M-WINDOWS-01 (review windows__casualgamer m1): on a slow/unreachable
 * server the user stared at a dark empty frame for up to the full
 * version-check timeout — boot() awaits config IPC + the version gate BEFORE
 * app.mount(), and index.html painted nothing until then.
 *
 * Cure: a static, PRE-JS boot surface in src/renderer/index.html — the brand
 * wordmark plus an animation-only spinner (no prose, so nothing to
 * localize). It lives as a SIBLING of #phlix-app (tests/smoke/boot.spec.ts
 * treats children of #phlix-app as the "renderer booted" proof; a placeholder
 * inside the mount point would make that assertion vacuous). boot() removes
 * it once Vue owns the window; the incompatible-server screen removes it too
 * (it renders in place of mounting).
 *
 * Pins here are doc-shape + removal-site guards; the visual boot itself is
 * covered by the Playwright smoke leg, which now additionally waits for the
 * splash to DETACH.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const PROJECT_ROOT = resolve(__dirname, '../..');
const indexHtml = readFileSync(resolve(PROJECT_ROOT, 'src/renderer/index.html'), 'utf-8');
const mainTs = readFileSync(resolve(PROJECT_ROOT, 'src/renderer/main.ts'), 'utf-8');
const smoke = readFileSync(resolve(PROJECT_ROOT, 'tests/smoke/boot.spec.ts'), 'utf-8');

describe('static boot splash (M-WINDOWS-01)', () => {
  it('index.html ships a #boot-splash sibling BEFORE #phlix-app', () => {
    expect(indexHtml).toMatch(/id="boot-splash"/);
    expect(indexHtml.indexOf('id="boot-splash"')).toBeLessThan(indexHtml.indexOf('id="phlix-app"'));
  });

  it('the splash is animation + brand only — zero prose to localize', () => {
    const splash = indexHtml.slice(indexHtml.indexOf('<div id="boot-splash"'), indexHtml.indexOf('<div id="phlix-app"'));
    // The only human-readable text is the wordmark itself.
    const textNodes = splash.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
    expect(textNodes).toBe('Phlix');
  });

  it('the spinner honors reduced-motion and paints on the boot background', () => {
    expect(indexHtml).toMatch(/prefers-reduced-motion:\s*reduce/);
    // Same dark the BrowserWindow backgroundColor uses (#1a1a2e, main/index.ts).
    expect(indexHtml).toMatch(/#1a1a2e/);
  });

  it('boot() removes the splash once the Vue app mounts', () => {
    const mountIdx = mainTs.indexOf("app.mount('#phlix-app')");
    expect(mountIdx).toBeGreaterThan(-1);
    expect(mainTs.slice(mountIdx, mountIdx + 400)).toMatch(/getElementById\('boot-splash'\)[\s\S]*\.remove\(\)/);
  });

  it('renderIncompatibleServerScreen removes the splash too (it replaces mounting)', () => {
    const fnIdx = mainTs.indexOf('function renderIncompatibleServerScreen');
    expect(fnIdx).toBeGreaterThan(-1);
    expect(mainTs.slice(fnIdx, fnIdx + 500)).toMatch(/getElementById\('boot-splash'\)[\s\S]*\.remove\(\)/);
  });

  it('the smoke leg waits for the splash to detach before claiming boot', () => {
    expect(smoke).toMatch(/#boot-splash.*detached/s);
  });
});
