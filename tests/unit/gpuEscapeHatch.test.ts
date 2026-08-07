/**
 * @vitest-environment node
 *
 * Tests for W4.12 GPU escape hatch feature:
 * - PHLIX_DISABLE_GPU env var check at module level
 * - disableHardwareAcceleration store preference check in app.whenReady()
 * - GPU IPC handlers (gpu:get-disable-hardware-acceleration, gpu:set-disable-hardware-acceleration, gpu:get-feature-status)
 * - Preload bridge methods for getDisableHardwareAcceleration / setDisableHardwareAcceleration
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const PROJECT_ROOT = resolve(__dirname, '../..');

const mainSource = readFileSync(resolve(PROJECT_ROOT, 'src/main/index.ts'), 'utf-8');
const preloadSource = readFileSync(resolve(PROJECT_ROOT, 'src/preload/index.ts'), 'utf-8');
const typeSource = readFileSync(resolve(PROJECT_ROOT, 'src/renderer/types/electron.d.ts'), 'utf-8');

// ---------------------------------------------------------------------------
// Helper: extract ipcMain.handle channels
// ---------------------------------------------------------------------------

function extractHandleChannels(content: string): string[] {
  const channels: string[] = [];
  const regex = /ipcMain\.handle\s*\(\s*['"]([^'"]+)['"]\s*,/g;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(content)) !== null) {
    channels.push(match[1]);
  }
  return channels;
}

// ---------------------------------------------------------------------------
// Helper: extract ipcRenderer.invoke channels
// ---------------------------------------------------------------------------

function extractInvokeChannels(content: string): string[] {
  const channels: string[] = [];
  const regex = /ipcRenderer\.invoke\s*\(\s*['"]([^'"]+)['"]/g;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(content)) !== null) {
    channels.push(match[1]);
  }
  return channels;
}

describe('W4.12 GPU escape hatch', () => {
  describe('PHLIX_DISABLE_GPU env var check', () => {
    it('module-level env var check is present in main process', () => {
      expect(mainSource).toContain('PHLIX_DISABLE_GPU');
    });

    it('app.disableHardwareAcceleration() is called when PHLIX_DISABLE_GPU=1', () => {
      expect(mainSource).toMatch(/if\s*\(\s*process\.env\.PHLIX_DISABLE_GPU\s*===\s*['"]1['"]\s*\)/);
      expect(mainSource).toContain('app.disableHardwareAcceleration()');
    });

    it('check appears before app.whenReady() in source order', () => {
      const envCheckIndex = mainSource.indexOf('PHLIX_DISABLE_GPU');
      const whenReadyIndex = mainSource.indexOf('app.whenReady()');
      expect(envCheckIndex).toBeLessThan(whenReadyIndex);
    });
  });

  describe('store preference check', () => {
    it('disableHardwareAcceleration is stored in the electron-store schema', () => {
      expect(mainSource).toContain('disableHardwareAcceleration');
    });

    it('store preference is checked inside app.whenReady() callback', () => {
      // Find the app.whenReady() block and check that store.get('disableHardwareAcceleration') appears inside it
      const whenReadyMatch = mainSource.match(/app\.whenReady\(\)\.then\(\(\)\s*=>\s*\{[\s\S]*?^\}\);/m);
      expect(whenReadyMatch).not.toBeNull();
      const whenReadyBlock = whenReadyMatch![0];
      expect(whenReadyBlock).toContain("store.get('disableHardwareAcceleration'");
    });
  });

  describe('GPU IPC handlers', () => {
    const mainHandleChannels = extractHandleChannels(mainSource);

    it('gpu:get-disable-hardware-acceleration handler exists', () => {
      expect(mainHandleChannels).toContain('gpu:get-disable-hardware-acceleration');
    });

    it('gpu:set-disable-hardware-acceleration handler exists', () => {
      expect(mainHandleChannels).toContain('gpu:set-disable-hardware-acceleration');
    });

    it('gpu:get-feature-status handler exists', () => {
      expect(mainHandleChannels).toContain('gpu:get-feature-status');
    });

    it('getGPUFeatureStatus() is called in the gpu:get-feature-status handler', () => {
      const handlerMatch = mainSource.match(/ipcMain\.handle\s*\(\s*['"]gpu:get-feature-status['"]\s*,[\s\S]*?\}\);/);
      expect(handlerMatch).not.toBeNull();
      expect(handlerMatch![0]).toContain('app.getGPUFeatureStatus()');
    });
  });

  describe('preload bridge methods', () => {
    const preloadInvokeChannels = extractInvokeChannels(preloadSource);

    it('getDisableHardwareAcceleration is exposed via ipcRenderer.invoke', () => {
      expect(preloadInvokeChannels).toContain('gpu:get-disable-hardware-acceleration');
    });

    it('setDisableHardwareAcceleration is exposed via ipcRenderer.invoke', () => {
      expect(preloadInvokeChannels).toContain('gpu:set-disable-hardware-acceleration');
    });
  });

  describe('type declarations', () => {
    it('getDisableHardwareAcceleration type is declared in electron.d.ts', () => {
      expect(typeSource).toContain('getDisableHardwareAcceleration');
      expect(typeSource).toMatch(/getDisableHardwareAcceleration:\s*\(\s*\)\s*=>\s*Promise<boolean>/);
    });

    it('setDisableHardwareAcceleration type is declared in electron.d.ts', () => {
      expect(typeSource).toContain('setDisableHardwareAcceleration');
      expect(typeSource).toMatch(/setDisableHardwareAcceleration:\s*\(\s*value:\s*boolean\s*\)\s*=>\s*Promise<void>/);
    });
  });
});
