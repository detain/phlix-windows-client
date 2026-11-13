/**
 * WIN-S1 wiring pins (WIN-7/38/48): main.ts hands pinia/router to the overlay
 * through the module-local ./overlayShared (no window globals), remounts a
 * cached overlay on re-boot, and owns its HMR/beforeunload teardown at module
 * scope rather than per boot().
 *
 * @copyright 2026 Joe Huss <detain@interserver.net>
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const read = (p: string) => readFileSync(resolve(__dirname, '../..', p), 'utf-8');
const strip = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
const mainTs = strip(read('src/renderer/main.ts'));
const bootAt = mainTs.indexOf('async function boot');

describe('overlay lifecycle wiring (WIN-S1)', () => {
  it('no src file touches the retired window.__phlix* globals', () => {
    for (const f of ['main.ts', 'overlay.tsx', 'components/PlayerSupplement.tsx']) {
      expect(strip(read(`src/renderer/${f}`)), f).not.toMatch(/__phlix(Router|Pinia)/);
    }
  });

  it('boot() publishes via setOverlayShared and remounts a cached overlay', () => {
    expect(mainTs).toMatch(/setOverlayShared\(\{ router: phlixRouter, pinia: phlixPinia \}\)/);
    expect(mainTs).toMatch(/overlay\.remount\(\)/);
  });

  it('HMR dispose + beforeunload registrations sit at module scope, before boot()', () => {
    expect(bootAt).toBeGreaterThan(-1);
    const hot = mainTs.indexOf('import.meta.hot?.dispose');
    const unload = mainTs.indexOf("addEventListener('beforeunload'");
    expect(hot).toBeGreaterThan(-1);
    expect(unload).toBeGreaterThan(-1);
    expect(hot).toBeLessThan(bootAt);
    expect(unload).toBeLessThan(bootAt);
    expect(mainTs.slice(bootAt)).not.toMatch(/import\.meta\.hot|beforeunload/);
  });
});
