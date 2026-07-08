#!/usr/bin/env node
/**
 * add-copyright.mjs - Idempotent copyright-header injector for phlix-windows-client.
 * Re-run produces zero diff when all files already have the header.
 */

import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { join, extname, basename } from 'node:path';

const COPYRIGHT = ' * @copyright 2026 Joe Huss <detain@interserver.net>';

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

function isShebang(line) {
  return line.startsWith('#!');
}

// Find the line index (0-based) where a TS/JS docblock ends (contains star-slash)
function findDocblockEnd(lines, start) {
  for (let i = start; i < lines.length; i++) {
    if (lines[i].includes('*/')) return i;
  }
  return -1;
}

// Inject copyright into an existing TS/JS docblock /** ... */
// Returns null if no top-level docblock OR copyright already present.
// Only considers /** at the very start of the file (after optional shebang)
// to avoid misinterpreting TypeScript type expressions like `TokenTarget & { */ }`.
function injectTsDocblock(content) {
  const lines = content.split('\n');

  let offset = 0;
  if (lines.length > 0 && isShebang(lines[0])) offset = 1;

  // Only consider /** that appears at the very start of the file (after shebang)
  if (lines.length <= offset || !lines[offset].includes('/**')) return null;

  const docStart = offset;
  const docEnd = findDocblockEnd(lines, docStart);
  if (docEnd === -1) return null;

  const block = lines.slice(docStart, docEnd + 1).join('\n');
  if (block.includes('detain@interserver.net')) return null;

  // Find the best insertion point: after the last non-empty, non-marker content line
  let insertAfter = docStart + 1;
  for (let i = docStart + 1; i < docEnd; i++) {
    const trimmed = lines[i].trim();
    if (trimmed === '' || trimmed === '*/' || trimmed.startsWith('* @')) break;
    insertAfter = i;
  }

  const out = [...lines];
  out.splice(insertAfter + 1, 0, COPYRIGHT);
  return out.join('\n');
}

// Prepend a new TS/JS docblock at the top (after any shebang).
function prependTsDocblock(content) {
  const lines = content.split('\n');
  let offset = 0;
  if (lines.length > 0 && isShebang(lines[0])) offset = 1;

  const docblock = [
    '/**',
    ' * Phlix Media Server Client for Windows.',
    ' *',
    COPYRIGHT,
    ' */',
    '',
  ];

  return [...lines.slice(0, offset), ...docblock, ...lines.slice(offset)].join('\n');
}

function processTsFile(filepath) {
  const content = readFileSync(filepath, 'utf8');
  if (content.includes('detain@interserver.net')) return null;
  return injectTsDocblock(content) ?? prependTsDocblock(content);
}

// Inject copyright into an existing CSS block comment.
// Finds the last line containing the block closer (asterisk-slash)
// inside the opening block-comment and inserts the copyright line
// just before it (so it stays inside the block).
function injectCssComment(content) {
  const lines = content.split('\n');
  if (lines.length === 0 || !lines[0].trim().startsWith('/*')) return null;

  // Find last line that contains the block closer */
  let lastCloseIdx = -1;
  for (let i = 1; i < lines.length; i++) {
    if (lines[i].includes('*/')) lastCloseIdx = i;
  }
  if (lastCloseIdx === -1) return null;

  // Check if copyright already present
  const block = lines.slice(0, lastCloseIdx + 1).join('\n');
  if (block.includes('detain@interserver.net')) return null;

  // Insert copyright line just before the closing line
  const out = [...lines];
  out.splice(lastCloseIdx, 0, COPYRIGHT);
  return out.join('\n');
}

// Prepend a new CSS block comment at the top.
function prependCssComment(content) {
  const block = ['/*', COPYRIGHT, ' */', '', ''].join('\n');
  return block + '\n' + content;
}

function processCssFile(filepath) {
  const content = readFileSync(filepath, 'utf8');
  if (content.includes('detain@interserver.net')) return null;
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