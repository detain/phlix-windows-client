/**
 * Build-time assertion to ensure the preload script exists at the path
 * that src/main/index.ts references after compilation.
 *
 * This script must be kept in sync with the preload path in src/main/index.ts.
 * The path is: path.join(__dirname, '../preload/index.js') relative to dist/main/.
 */

import { readFileSync, accessSync, constants } from 'fs';
import { dirname, join, resolve } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = resolve(__dirname, '..');

// Read the compiled main/index.js and extract the preload path
const mainJsPath = join(rootDir, 'dist', 'main', 'index.js');
const mainJsContent = readFileSync(mainJsPath, 'utf-8');

// Extract the preload path using regex - matches: preload: path.join(__dirname, '...')
const match = mainJsContent.match(/preload:\s*path\.join\(__dirname,\s*['"]([^'"]+)['"]\)/);

if (!match) {
  console.error('ERROR: Could not find preload path in dist/main/index.js');
  process.exit(1);
}

const preloadRelativePath = match[1];
const preloadResolvedPath = resolve(rootDir, 'dist', 'main', preloadRelativePath);

try {
  accessSync(preloadResolvedPath, constants.R_OK);
  console.log(`OK: Preload script exists at ${preloadResolvedPath}`);
} catch {
  console.error(`ERROR: Preload script NOT found at ${preloadResolvedPath}`);
  console.error(`Expected path derived from dist/main/index.js: ${preloadRelativePath}`);
  process.exit(1);
}
