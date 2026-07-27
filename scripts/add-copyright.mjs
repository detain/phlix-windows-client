#!/usr/bin/env node
/**
 * add-copyright.mjs - Idempotent copyright-header injector for phlix-windows-client.
 * Re-run produces zero diff when all files already have the header.
 *
 * Usage: `node scripts/add-copyright.mjs`.
 *
 * This file is the CLI half only: walking, reading, writing, reporting. All of
 * the pure header-manipulation logic lives in ./lib/copyright.mjs so it can be
 * unit-tested (tests/unit/copyright.test.mjs) without importing this file. That
 * is why there is deliberately NO
 * `import.meta.url === pathToFileURL(process.argv[1]).href` main-guard here:
 * importing the library can never trigger the walk, and such a guard silently
 * evaluates false whenever the script is reached through a symlink
 * (pathToFileURL does not resolve symlinks, import.meta.url is the realpath),
 * which turns the entire run into a zero-output, exit-0 no-op.
 */

import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { join, extname, basename } from 'node:path';

import {
  injectCssComment,
  prependCssComment,
  injectTsDocblock,
  prependTsDocblock,
  MARKER,
} from './lib/copyright.mjs';

const EXCLUDE_DIRS = new Set(['node_modules', 'dist', 'vendor', '.git', 'coverage', '.github', 'build']);
const EXCLUDE_FILES = new Set([]);
const TS_EXTS = new Set(['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '.mts', '.cts']);
const CSS_EXT = '.css';

function walk(dir, exts, files = []) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (!EXCLUDE_DIRS.has(entry.name)) walk(full, exts, files);
    } else {
      const ext = extname(entry.name);
      const base = basename(entry.name);
      if (exts.has(ext) && !EXCLUDE_FILES.has(base)) {
        files.push(full);
      }
    }
  }
  return files;
}

function processTsFile(filepath) {
  const content = readFileSync(filepath, 'utf8');
  if (content.includes(MARKER)) return null;
  return injectTsDocblock(content) ?? prependTsDocblock(content);
}

function processCssFile(filepath) {
  const content = readFileSync(filepath, 'utf8');
  if (content.includes(MARKER)) return null;
  return injectCssComment(content) ?? prependCssComment(content);
}

// ---- Main ----
const tsFiles = walk('src', TS_EXTS);
const cssFiles = walk('src', new Set([CSS_EXT]));

let changed = 0;
let skipped = 0;
const touched = [];

for (const file of [...tsFiles, ...cssFiles]) {
  const ext = extname(file);
  let newContent = null;

  if (TS_EXTS.has(ext)) newContent = processTsFile(file);
  else if (ext === CSS_EXT) newContent = processCssFile(file);

  if (newContent !== null) {
    writeFileSync(file, newContent, 'utf8');
    changed++;
    touched.push(file);
    console.log('ADDED: ' + file);
  } else {
    skipped++;
    console.log('SKIP:  ' + file);
  }
}

console.log(`\nDone: ${changed} file(s) updated, ${skipped} skipped.`);
if (touched.length > 0) {
  console.log('\nTouched:');
  for (const f of touched) console.log('  ' + f);
}
