/**
 * @vitest-environment node
 *
 * Icon generator engineering (M-WINDOWS-14): the pre-cure generator produced
 * a 512x512 RGB (color-type 2) PNG embedded in an ICO directory whose width
 * byte overflowed (512 & 0xFF = 0 => the shell believes 256x256), declared
 * 32bpp for 24-bit data, carried a single entry, and left the 32px tray asset
 * unread by anyone. The cures: RGBA payloads, a multi-size directory with
 * truthful entries, and a testable output directory (PHLIX_ICON_OUT_DIR).
 * Solid-color placeholder ART is unchanged — this item is bytes-structure.
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { execFileSync } from 'node:child_process';
import { readFileSync, rmSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

const OUT = '/tmp/opencode/fix-win-min/icons-out';

function pngHeader(buf) {
  expect(buf.slice(0, 8)).toEqual(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
  const w = buf.readUInt32BE(16);
  const h = buf.readUInt32BE(20);
  const bitDepth = buf[24];
  const colorType = buf[25];
  return { w, h, bitDepth, colorType };
}

let ico;
let png;
let tray;

beforeAll(() => {
  rmSync(OUT, { recursive: true, force: true });
  mkdirSync(OUT, { recursive: true });
  execFileSync('node', ['scripts/generate-icons.mjs'], {
    cwd: join(__dirname, '../../'),
    env: { ...process.env, PHLIX_ICON_OUT_DIR: OUT },
    stdio: 'pipe'
  });
  png = readFileSync(join(OUT, 'icon.png'));
  tray = readFileSync(join(OUT, 'tray-icon.png'));
  ico = readFileSync(join(OUT, 'icon.ico'));
});

describe('PNG payloads (M-WINDOWS-14)', () => {
  it('icon.png is RGBA (color type 6), 8-bit, 512 square', () => {
    const hdr = pngHeader(png);
    expect(hdr).toEqual({ w: 512, h: 512, bitDepth: 8, colorType: 6 });
  });
  it('tray-icon.png is RGBA 32x32 (no longer an RGB orphan)', () => {
    const hdr = pngHeader(tray);
    expect(hdr).toEqual({ w: 32, h: 32, bitDepth: 8, colorType: 6 });
  });
});

describe('ICO directory (M-WINDOWS-14)', () => {
  it('header: reserved 0, type 1, seven sizes', () => {
    expect(ico.readUInt16LE(0)).toBe(0);
    expect(ico.readUInt16LE(2)).toBe(1);
    expect(ico.readUInt16LE(4)).toBe(7);
  });

  it('every entry is truthful: 256 encoded as 0, 32bpp declared for 32bpp data, chained offsets', () => {
    const expected = [16, 24, 32, 48, 64, 128, 256];
    let offset = 6 + 16 * expected.length;
    expected.forEach((size, i) => {
      const e = 6 + 16 * i;
      expect(ico[e]).toBe(size >= 256 ? 0 : size);      // width byte
      expect(ico[e + 1]).toBe(size >= 256 ? 0 : size);  // height byte
      expect(ico.readUInt16LE(e + 4)).toBe(1);          // color planes
      expect(ico.readUInt16LE(e + 6)).toBe(32);         // bits per pixel
      const dataOff = ico.readUInt32LE(e + 12);
      const dataSize = ico.readUInt32LE(e + 8);
      expect(dataOff).toBe(offset);
      const embedded = pngHeader(ico.slice(dataOff, dataOff + dataSize));
      expect(embedded.w).toBe(size);
      expect(embedded.h).toBe(size);
      expect(embedded.colorType).toBe(6);               // the declared bpp matches the data
      offset = dataOff + dataSize;
    });
    expect(offset).toBe(ico.length);                     // no trailing garbage
  });

  it('the committed build/icon.ico is the regenerated one (assets in lockstep)', () => {
    const repoIco = readFileSync(join(__dirname, '../../build/icon.ico'));
    expect(repoIco.readUInt16LE(4)).toBe(7);
    expect(repoIco.readUInt16LE(4)).toBe(ico.readUInt16LE(4));
    expect(repoIco.length).toBe(ico.length);
  });
});

describe('dead-asset leg (M-WINDOWS-14)', () => {
  it('the tray path actually reads the .ico so the shell can pick per-DPI', () => {
    const main = readFileSync(join(__dirname, '../../src/main/index.ts'), 'utf-8');
    const idx = main.indexOf('export function createTray');
    expect(main.slice(idx, idx + 1000)).toMatch(/build\/icon\.ico/);
  });
});
