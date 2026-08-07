/**
 * Pre-build asset checker.
 * Verifies that required icon files exist before the build proceeds.
 * Exits with code 1 if any required assets are missing.
 */

import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const BUILD_DIR = join(__dirname, '..', 'build');

const REQUIRED_ASSETS = [
  { path: 'icon.png', description: 'Main application icon (512x512 PNG)' },
  { path: 'icon.ico', description: 'Windows ICO icon' },
  { path: 'tray-icon.png', description: 'Tray icon (32x32 PNG)' }
];

let hasErrors = false;

for (const asset of REQUIRED_ASSETS) {
  const assetPath = join(BUILD_DIR, asset.path);
  if (!existsSync(assetPath)) {
    console.error(`[check-assets] ERROR: Missing required asset: ${asset.path}`);
    console.error(`[check-assets]   Description: ${asset.description}`);
    console.error(`[check-assets]   Expected path: ${assetPath}`);
    hasErrors = true;
  } else {
    console.log(`[check-assets] OK: ${asset.path}`);
  }
}

if (hasErrors) {
  console.error('\n[check-assets] Build aborted: missing required assets.');
  console.error('[check-assets] Run "node scripts/generate-icons.mjs" to create placeholder icons.');
  process.exit(1);
}

console.log('[check-assets] All required assets present.');
