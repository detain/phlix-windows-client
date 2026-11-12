/**
 * @vitest-environment node
 *
 * The build asset gate is demand-driven (windows__crossfe 6[i], w08/L2).
 *
 * scripts/check-assets.mjs used to require build/tray-icon.png — a file with
 * zero runtime consumers: createTray() renders the tray from the multi-size
 * build/icon.ico under the M-WINDOWS-14 DPI law (pinned in
 * windowHardening.test.mjs), and a single-size 32px PNG is exactly the
 * wrong-resize shape that law retired. The generator still writes the
 * placeholder (its byte structure is pinned in iconGenerator.test.mjs); the
 * gate no longer demands what nothing renders.
 *
 * Pair law: the two assertions below lock each other. If a future consumer
 * starts rendering tray-icon.png, the second pin reddens and forces the
 * requirement back INTO THE SAME COMMIT as the consumer — never one without
 * the other.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const read = (p) => readFileSync(resolve(__dirname, '../../', p), 'utf-8');
const checker = read('scripts/check-assets.mjs');
const requiredBlock = checker.slice(
  checker.indexOf('const REQUIRED_ASSETS'),
  checker.indexOf('];', checker.indexOf('const REQUIRED_ASSETS'))
);

describe('check-assets requires what the build renders', () => {
  it('the two consumed master assets stay required', () => {
    expect(requiredBlock).toMatch(/icon\.png/);
    expect(requiredBlock).toMatch(/icon\.ico/);
  });

  it('tray-icon.png is NOT required — and still has no consumer (pair law)', () => {
    expect(requiredBlock).not.toMatch(/tray-icon\.png/);
    const main = read('src/main/index.ts');
    expect(main).not.toMatch(/tray-icon/);
  });
});
