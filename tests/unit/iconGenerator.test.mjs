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
import { inflateSync } from 'node:zlib';
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

// MW-115 [review windows__gameux 6]: the four 16x16 thumbar transport glyphs.
// Same RGBA law; new laws: every row filter byte stays 0 (the decoder below
// depends on it — and the generator must keep matching), alpha is BINARY
// (0 outside the symbol, 255 inside — icons live on alpha), the shapes are
// real media symbols (an ink band, not a solid square: a full-alpha 16x16
// would repeat the "three identical blobs" defect the item cures), and the
// committed build/ copies are regenerated in lockstep.
describe('thumbar transport glyphs (MW-115)', () => {
  const GLYPHS = ['thumbar-previous', 'thumbar-play', 'thumbar-pause', 'thumbar-next'];

  /** Decode the generator's own PNG shape: filter-0 rows, RGBA pixels. */
  function decodeRgba(buf) {
    const w = buf.readUInt32BE(16);
    const h = buf.readUInt32BE(20);
    expect(buf[24]).toBe(8);
    expect(buf[25]).toBe(6);
    const idats = [];
    let pos = 8;
    while (pos < buf.length) {
      const len = buf.readUInt32BE(pos);
      const type = buf.slice(pos + 4, pos + 8).toString('ascii');
      if (type === 'IDAT') idats.push(buf.slice(pos + 8, pos + 8 + len));
      pos += 12 + len;
    }
    const raw = inflateSync(Buffer.concat(idats));
    const alpha = new Uint8Array(w * h);
    const rgb = [];
    for (let y = 0; y < h; y++) {
      expect(raw[y * (1 + w * 4)]).toBe(0); // filter-0 law
      for (let x = 0; x < w; x++) {
        const o = y * (1 + w * 4) + 1 + x * 4;
        alpha[y * w + x] = raw[o + 3];
        rgb.push([raw[o], raw[o + 1], raw[o + 2]]);
      }
    }
    return { w, h, alpha, rgb };
  }

  for (const name of GLYPHS) {
    it(`${name}.png is a 16x16 RGBA symbol on transparent ground`, () => {
      const buf = readFileSync(join(OUT, `${name}.png`));
      const { w, h, alpha, rgb } = decodeRgba(buf);
      expect(w).toBe(16);
      expect(h).toBe(16);
      let painted = 0;
      for (let i = 0; i < w * h; i++) {
        expect(alpha[i] === 0 || alpha[i] === 255, `non-binary alpha at pixel ${i}`).toBe(true);
        if (alpha[i] === 255) painted++;
      }
      // A symbol, not a stamp: some ink, but never a solid square.
      expect(painted).toBeGreaterThan(0);
      expect(painted).toBeLessThan(w * h);
      // Brand orange on every painted pixel (single-ink symbols).
      for (const [r, g, b] of rgb) {
        expect([r, g, b]).toEqual([232, 150, 31]);
      }
    });
  }

  it('play is not the same bitmap as pause, and previous mirrors next', () => {
    const bytes = (name) => readFileSync(join(OUT, `${name}.png`));
    expect([...decodeRgba(bytes('thumbar-play')).alpha]).not.toEqual([...decodeRgba(bytes('thumbar-pause')).alpha]);
    const next = decodeRgba(bytes('thumbar-next')).alpha;
    const prev = decodeRgba(bytes('thumbar-previous')).alpha;
    // Horizontal mirror law: pixel (x,y) of next == pixel (15-x,y) of previous.
    const mirrored = new Uint8Array(16 * 16);
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) mirrored[y * 16 + x] = prev[y * 16 + (15 - x)];
    expect([...next]).toEqual([...mirrored]);
  });

  it('the committed build/ glyphs are the regenerated ones (assets in lockstep)', () => {
    for (const name of GLYPHS) {
      const repo = readFileSync(join(__dirname, '../../build', `${name}.png`));
      const fresh = readFileSync(join(OUT, `${name}.png`));
      expect(repo.length, `build/${name}.png drifted`).toBe(fresh.length);
      expect(repo.equals(fresh), `build/${name}.png is stale`).toBe(true);
    }
  });
});

describe('dead-asset leg (M-WINDOWS-14)', () => {
  it('the tray path actually reads the .ico so the shell can pick per-DPI', () => {
    const main = readFileSync(join(__dirname, '../../src/main/index.ts'), 'utf-8');
    const idx = main.indexOf('export function createTray');
    expect(main.slice(idx, idx + 1000)).toMatch(/build\/icon\.ico/);
  });
});
