/**
 * @vitest-environment node
 *
 * M-WINDOWS-15 (minor, windows__srphp): Electron reads the hardware-
 * acceleration decision when the GPU machinery starts — a
 * app.disableHardwareAcceleration() call from inside the whenReady() callback
 * is a no-op on Windows. The env arm was always module-scope (correct); the
 * stored-preference arm must live there too, and the ready-callback arm dies.
 * Behavior is unobservable under electron mocks, so these are the structural
 * pins of the timing law (same idiom as the other posture tests).
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const src = readFileSync(resolve(__dirname, '../../src/main/index.ts'), 'utf-8');

describe('GPU disable preference is applied before app ready (M-WINDOWS-15)', () => {
  it('disableHardwareAcceleration is called exactly twice (env arm + store arm)', () => {
    expect((src.match(/app\.disableHardwareAcceleration\(\)/g) ?? []).length).toBe(2);
  });

  it('the store-preference arm sits at module scope, before app.whenReady()', () => {
    // Anchor on the real call (.then), not the prose that discusses it.
    const ready = src.indexOf('app.whenReady().then(');
    expect(ready).toBeGreaterThan(0);
    const arm = src.match(/if \(store\.get\('disableHardwareAcceleration', false\)\) \{\s*\n\s*log\.info\('\[gpu\][^']*preference/);
    expect(arm, 'preference arm missing').not.toBeNull();
    expect(arm.index).toBeLessThan(ready);
  });

  it('no disable call survives inside the ready callback', () => {
    expect(src.slice(src.indexOf('app.whenReady().then('))).not.toMatch(/app\.disableHardwareAcceleration\(\)/);
  });
});
