#!/usr/bin/env node
/**
 * Generates placeholder icon files for the Phlix Windows client.
 * Creates valid PNG (RGBA) and a multi-size ICO using pure Node.js.
 *
 * M-WINDOWS-14 engineering laws pinned by tests/unit/iconGenerator.test.mjs:
 *  - every PNG is color type 6 (RGBA, 8-bit) — icons live on alpha;
 *  - the ICO carries one entry per size [16..256] with TRUTHFUL directory
 *    bytes (256 encoded as 0 per spec, 32 bpp matching the embedded data);
 *    the old single 512px entry's width byte overflowed to 0, i.e. the shell
 *    was told "256x256" about a 512 image;
 *  - PHLIX_ICON_OUT_DIR redirects output for tests (defaults to build/).
 * The solid-color ART of the app/tray icons remains placeholder (owner/art
 * call), but MW-115 [review windows__gameux 6] moved the THUMBAR out of the
 * placeholder era: this generator now also emits four distinct 16x16 RGBA
 * transport glyphs (previous | play | pause | next), geometric media symbols
 * drawn from the same brand orange on a transparent field. They exist so the
 * three taskbar-thumbnail buttons stop being three copies of one resized
 * square (the tooltips used to carry ALL differentiation); src/main/index.ts
 * loads them per action and keeps the historical resized-icon path as the
 * missing-asset fallback.
 */

import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { deflateSync } from 'node:zlib';

const __dirname = dirname(fileURLToPath(import.meta.url));
const BUILD_DIR = process.env.PHLIX_ICON_OUT_DIR ?? join(__dirname, '..', 'build');

// --- CRC32 for PNG chunks ---
function getCrcTable() {
  const table = [];
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) {
      c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
    }
    table[n] = c >>> 0;
  }
  return table;
}

const crcTable = getCrcTable();

function crc32(data) {
  let crc = 0xFFFFFFFF;
  for (let i = 0; i < data.length; i++) {
    crc = crcTable[(crc ^ data[i]) & 0xFF] ^ (crc >>> 8);
  }
  return (crc ^ 0xFFFFFFFF) >>> 0;
}

function makeChunk(type, data) {
  const typeBuffer = Buffer.from(type, 'ascii');
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);
  const crcData = Buffer.concat([typeBuffer, data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(crcData), 0);
  return Buffer.concat([length, typeBuffer, data, crc]);
}

/**
 * Creates a valid RGBA PNG file with a solid color.
 * @param {number} width
 * @param {number} height
 * @param {number[]} rgb - [r, g, b] values 0-255 (alpha written 255)
 * @returns {Buffer}
 */
function createPng(width, height, rgb) {
  const [r, g, b] = rgb;

  // PNG signature
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  // IHDR chunk
  const ihdrData = Buffer.alloc(13);
  ihdrData.writeUInt32BE(width, 0);
  ihdrData.writeUInt32BE(height, 4);
  ihdrData[8] = 8;  // bit depth
  ihdrData[9] = 6;  // color type (M-WINDOWS-14: RGBA — was 2/RGB, which made
                    // the ICO directory's 32bpp declaration a lie)
  ihdrData[10] = 0; // compression
  ihdrData[11] = 0; // filter
  ihdrData[12] = 0; // interlace
  const ihdr = makeChunk('IHDR', ihdrData);

  // Create raw pixel data (filter byte + RGBA for each row)
  const rowBytes = 1 + width * 4; // filter byte + RGBA pixels
  const rawData = Buffer.alloc(height * rowBytes);

  for (let y = 0; y < height; y++) {
    const rowOffset = y * rowBytes;
    rawData[rowOffset] = 0; // No filter
    for (let x = 0; x < width; x++) {
      const pixelOffset = rowOffset + 1 + x * 4;
      rawData[pixelOffset] = r;
      rawData[pixelOffset + 1] = g;
      rawData[pixelOffset + 2] = b;
      rawData[pixelOffset + 3] = 255;
    }
  }

  // Compress with zlib
  const compressed = deflateSync(rawData);
  const idat = makeChunk('IDAT', compressed);

  // IEND chunk
  const iend = makeChunk('IEND', Buffer.alloc(0));

  return Buffer.concat([signature, ihdr, idat, iend]);
}

/**
 * MW-115 (review windows__gameux 6): a 16x16 RGBA glyph from filled convex
 * polygons — geometric media symbols, alpha 0 outside the shape (icons live
 * on alpha, same M-WINDOWS-14 color-type law as everything else this script
 * emits). Pixel centers take the inside test; no AA at 16px (hard edges read
 * cleaner than mush at this size).
 * @param {number[][][]} polygons - each polygon an array of [x, y] vertices
 * @param {number[]} rgb - [r, g, b] values 0-255
 * @returns {Buffer} PNG bytes
 */
function createGlyphPng(polygons, rgb) {
  const width = 16;
  const height = 16;
  const [r, g, b] = rgb;

  const insidePolygon = (points, px, py) => {
    let sign = 0;
    for (let i = 0; i < points.length; i++) {
      const [x1, y1] = points[i];
      const [x2, y2] = points[(i + 1) % points.length];
      const cross = (x2 - x1) * (py - y1) - (y2 - y1) * (px - x1);
      if (Math.abs(cross) < 1e-9) continue;
      const s = cross > 0 ? 1 : -1;
      if (sign === 0) sign = s;
      else if (s !== sign) return false;
    }
    return true;
  };

  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdrData = Buffer.alloc(13);
  ihdrData.writeUInt32BE(width, 0);
  ihdrData.writeUInt32BE(height, 4);
  ihdrData[8] = 8;  // bit depth
  ihdrData[9] = 6;  // color type RGBA
  ihdrData[10] = 0;
  ihdrData[11] = 0;
  ihdrData[12] = 0;
  const ihdr = makeChunk('IHDR', ihdrData);

  const rowBytes = 1 + width * 4;
  const rawData = Buffer.alloc(height * rowBytes);
  for (let y = 0; y < height; y++) {
    const rowOffset = y * rowBytes;
    rawData[rowOffset] = 0; // No filter (the iconGenerator test decodes rows under this law)
    for (let x = 0; x < width; x++) {
      const px = x + 0.5;
      const py = y + 0.5;
      const filled = polygons.some((poly) => insidePolygon(poly, px, py));
      const pixelOffset = rowOffset + 1 + x * 4;
      rawData[pixelOffset] = r;
      rawData[pixelOffset + 1] = g;
      rawData[pixelOffset + 2] = b;
      rawData[pixelOffset + 3] = filled ? 255 : 0;
    }
  }

  const idat = makeChunk('IDAT', deflateSync(rawData));
  const iend = makeChunk('IEND', Buffer.alloc(0));
  return Buffer.concat([signature, ihdr, idat, iend]);
}

/** The four media-transport symbols, 16x16 coordinate space. */
const TRANSPORT_GLYPHS = {
  // ◀◀  two left-pointing triangles
  'thumbar-previous': [
    [[13, 3], [13, 13], [8, 8]],
    [[7.5, 3], [7.5, 13], [2.5, 8]]
  ],
  // ▶   one right-pointing triangle
  'thumbar-play': [
    [[3.5, 3], [3.5, 13], [12.5, 8]]
  ],
  // ❚❚  two bars (rects as 4-gons)
  'thumbar-pause': [
    [[4, 3], [6.5, 3], [6.5, 13], [4, 13]],
    [[9.5, 3], [12, 3], [12, 13], [9.5, 13]]
  ],
  // ▶▶  two right-pointing triangles
  'thumbar-next': [
    [[3, 3], [3, 13], [8, 8]],
    [[8.5, 3], [8.5, 13], [13.5, 8]]
  ]
};

/**
 * Builds a multi-size ICO from PNG payloads (PNG-compressed entries, the
 * Vista+ convention electron-builder itself emits).
 * @param {{ size: number, pngData: Buffer }[]} images
 * @returns {Buffer}
 */
function createIco(images) {
  // ICO header (6 bytes)
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0);            // Reserved, must be 0
  header.writeUInt16LE(1, 2);            // Type: 1 = ICO
  header.writeUInt16LE(images.length, 4); // Number of images

  const dirSize = 6 + 16 * images.length;
  // Offsets chain after every entry's bytes (M-WINDOWS-14: truthful directory).
  let dataOffset = dirSize;
  const parts = [header];
  for (const { size, pngData } of images) {
    const entry = Buffer.alloc(16);
    entry[0] = size >= 256 ? 0 : size;   // Width (0 means 256 per spec)
    entry[1] = size >= 256 ? 0 : size;   // Height (0 means 256)
    entry[2] = 0;                        // Color palette (0 = no palette)
    entry[3] = 0;                        // Reserved
    entry.writeUInt16LE(1, 4);           // Color planes
    entry.writeUInt16LE(32, 6);          // Bits per pixel — RGBA data agrees
    entry.writeUInt32LE(pngData.length, 8);
    entry.writeUInt32LE(dataOffset, 12);
    parts.push(entry);
    dataOffset += pngData.length;
  }
  for (const { pngData } of images) parts.push(pngData);
  return Buffer.concat(parts);
}

// --- Main execution ---
function main() {
  // Create build directory if it doesn't exist
  mkdirSync(BUILD_DIR, { recursive: true });

  // Brand orange color from midnight-jazz theme: #E8961F
  const orange = [232, 150, 31];

  console.log('Generating build/icon.png (512x512 RGBA)...');
  const iconPng = createPng(512, 512, orange);
  writeFileSync(join(BUILD_DIR, 'icon.png'), iconPng);

  console.log('Generating build/tray-icon.png (32x32 RGBA)...');
  const trayPng = createPng(32, 32, orange);
  writeFileSync(join(BUILD_DIR, 'tray-icon.png'), trayPng);

  console.log('Generating build/icon.ico (multi-size RGBA)...');
  const sizes = [16, 24, 32, 48, 64, 128, 256];
  const iconIco = createIco(
    sizes.map((size) => ({ size, pngData: createPng(size, size, orange) }))
  );
  writeFileSync(join(BUILD_DIR, 'icon.ico'), iconIco);

  // MW-115: distinct 16px thumbar transport glyphs (see TRANSPORT_GLYPHS).
  for (const [name, polygons] of Object.entries(TRANSPORT_GLYPHS)) {
    console.log(`Generating build/${name}.png (16x16 RGBA glyph)...`);
    writeFileSync(join(BUILD_DIR, `${name}.png`), createGlyphPng(polygons, orange));
  }

  console.log('Icon files generated successfully!');
}

main();
