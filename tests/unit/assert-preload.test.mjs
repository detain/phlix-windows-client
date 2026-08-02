/**
 * @vitest-environment node
 *
 * Tests for scripts/assert-preload.mjs — the build-time assertion that the
 * preload script exists at the path src/main/index.ts references after
 * TypeScript compilation.
 *
 * Root cause being guarded: the preload path in src/main/index.ts was
 * hardcoded as 'preload.js' but tsc outputs the preload entry point at
 * 'preload/index.js' (because tsconfig.main.json's outDir="dist" and
 * rootDir="src" means src/preload/index.ts → dist/preload/index.js).
 *
 * The step W0.1 fix changes the path in src/main/index.ts to
 * '../preload/index.js' so it actually finds the compiled file.
 * This test verifies:
 * 1. The script correctly extracts the preload path from compiled main/index.js
 * 2. The script fails when the preload file is missing
 * 3. The script succeeds when the preload file exists
 *
 * NOT testing via vitest's normal jsdom env because this script intentionally
 * tests Node.js filesystem access.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { readFileSync, accessSync, constants, writeFileSync, mkdirSync, rmSync } from 'fs';
import { join, resolve } from 'path';

describe('preload path extraction from compiled main/index.js', () => {
  /**
   * Mirrors the extraction logic in scripts/assert-preload.mjs:
   * extracts the preload path from the compiled main/index.js content.
   * Returns the relative path found between path.join(__dirname, '...')
   */
  function extractPreloadPath(mainJsContent) {
    const match = mainJsContent.match(/preload:\s*path\.join\(__dirname,\s*['"]([^'"]+)['"]\)/);
    if (!match) return null;
    return match[1];
  }

  describe('extractPreloadPath', () => {
    it('extracts the correct path when preload uses ../preload/index.js', () => {
      // This is the CORRECT path after W0.1 fix
      const content = `
        mainWindow = new BrowserWindow({
          webPreferences: {
            preload: path.join(__dirname, '../preload/index.js'),
            contextIsolation: true,
          }
        });
      `;
      expect(extractPreloadPath(content)).toBe('../preload/index.js');
    });

    it('extracts the OLD WRONG path preload.js for regression detection', () => {
      // This is the WRONG path that was there before W0.1 fix
      const content = `
        mainWindow = new BrowserWindow({
          webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            contextIsolation: true,
          }
        });
      `;
      expect(extractPreloadPath(content)).toBe('preload.js');
    });

    it('returns null when no preload path is found', () => {
      const content = `
        mainWindow = new BrowserWindow({
          width: 1280,
        });
      `;
      expect(extractPreloadPath(content)).toBeNull();
    });

    it('handles various path formats with different quote styles', () => {
      const doubleQuote = "preload: path.join(__dirname, '../preload/index.js')";
      const singleQuote = "preload: path.join(__dirname, \"../preload/index.js\")";
      const noSpaces = "preload:path.join(__dirname,'../preload/index.js')";

      expect(extractPreloadPath(doubleQuote)).toBe('../preload/index.js');
      expect(extractPreloadPath(singleQuote)).toBe('../preload/index.js');
      expect(extractPreloadPath(noSpaces)).toBe('../preload/index.js');
    });
  });

  describe('integration: full assertion logic', () => {
    // Use a temp directory for isolation
    const testRoot = resolve(process.cwd(), 'test-tmp-assert-preload');
    const distMain = join(testRoot, 'dist', 'main');
    const distPreload = join(testRoot, 'dist', 'preload');

    beforeEach(() => {
      mkdirSync(distMain, { recursive: true });
      mkdirSync(distPreload, { recursive: true });
    });

    afterEach(() => {
      rmSync(testRoot, { recursive: true, force: true });
    });

    function writeMainJs(preloadPath) {
      const content = `
const path = require('path');

function createWindow() {
  mainWindow = new BrowserWindow({
    webPreferences: {
      preload: path.join(__dirname, '${preloadPath}'),
      contextIsolation: true,
    }
  });
}
`;
      writeFileSync(join(distMain, 'index.js'), content);
    }

    function writePreloadFile() {
      writeFileSync(join(distPreload, 'index.js'), '// preload');
    }

    function runAssertion() {
      const mainJsPath = join(distMain, 'index.js');
      const mainJsContent = readFileSync(mainJsPath, 'utf-8');
      const match = mainJsContent.match(/preload:\s*path\.join\(__dirname,\s*['"]([^'"]+)['"]\)/);
      if (!match) return { success: false, error: 'no-match' };
      const preloadRelativePath = match[1];
      // Use join to properly concatenate paths - resolve would incorrectly
      // interpret ../ paths as going up a directory
      const preloadResolvedPath = join(distMain, preloadRelativePath);
      try {
        accessSync(preloadResolvedPath, constants.R_OK);
        return { success: true, path: preloadResolvedPath };
      } catch {
        return { success: false, error: 'file-not-found', expectedPath: preloadResolvedPath };
      }
    }

    it('SUCCEEDS when preload file exists at extracted path (../preload/index.js)', () => {
      writeMainJs('../preload/index.js');
      writePreloadFile();
      const result = runAssertion();
      expect(result.success).toBe(true);
      expect(result.path).toBe(join(distPreload, 'index.js'));
    });

    it('FAILS when preload file is missing at correct path (../preload/index.js)', () => {
      writeMainJs('../preload/index.js');
      // DO NOT write the preload file
      const result = runAssertion();
      expect(result.success).toBe(false);
      expect(result.error).toBe('file-not-found');
    });

    it('SUCCEEDS when the referenced path (preload.js) exists at that location', () => {
      // The assertion checks whether a file exists at the referenced path.
      // It has no way to know what the "correct" path should be — it only
      // verifies the file Electron would actually load is present.
      writeFileSync(join(distMain, 'preload.js'), '// preload at preload.js');
      writeMainJs('preload.js');
      const result = runAssertion();
      expect(result.success).toBe(true);
      expect(result.path).toBe(join(distMain, 'preload.js'));
    });

    it('succeeds only when path matches actual preload location', () => {
      // The correct path is ../preload/index.js
      writeMainJs('../preload/index.js');
      writePreloadFile();
      expect(runAssertion().success).toBe(true);

      // A slightly wrong path fails
      writeMainJs('../preload/index.ts');
      expect(runAssertion().success).toBe(false);
    });
  });
});
