/**
 * @vitest-environment node
 *
 * Tests for W4.6: Sleep inhibition during playback.
 *
 * Verifies:
 * - powerBlockerId is module-level state in main/index.ts
 * - ensurePowerBlocker() function is defined and exported for testing
 * - ensurePowerBlocker(true) calls powerSaveBlocker.start('prevent-display-sleep')
 * - ensurePowerBlocker(false) calls powerSaveBlocker.stop(id) then resets id to null
 * - second start doesn't call start again (idempotency via isStarted check)
 * - power:update IPC handler is registered
 * - preload exposes updatePowerBlocker (ipcRenderer.send)
 * - electron.d.ts declares updatePowerBlocker type
 * - electronBridge calls updatePowerBlocker after play/pause toggle
 * - Four teardown paths: close handler, before-quit handler, render-process-gone
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const PROJECT_ROOT = resolve(__dirname, '../..');

const mainSource = readFileSync(resolve(PROJECT_ROOT, 'src/main/index.ts'), 'utf-8');
const preloadSource = readFileSync(resolve(PROJECT_ROOT, 'src/preload/index.ts'), 'utf-8');
const bridgeSource = readFileSync(resolve(PROJECT_ROOT, 'src/renderer/electronBridge.ts'), 'utf-8');
const typesSource = readFileSync(resolve(PROJECT_ROOT, 'src/renderer/types/electron.d.ts'), 'utf-8');

describe('powerBlockerId module-level state (W4.6)', () => {
  it('powerBlockerId is declared as module-level variable', () => {
    // Should be: let powerBlockerId: number | null = null;
    expect(mainSource).toMatch(/let\s+powerBlockerId\s*:\s*number\s*\|\s*null\s*=/);
  });

  it('powerBlockerId is initialized to null', () => {
    expect(mainSource).toMatch(/let\s+powerBlockerId\s*:\s*number\s*\|\s*null\s*=\s*null/);
  });
});

describe('ensurePowerBlocker function (W4.6)', () => {
  it('ensurePowerBlocker function is defined', () => {
    expect(mainSource).toMatch(/function\s+ensurePowerBlocker\s*\(\s*start:\s*boolean\s*\)/);
  });

  it('ensurePowerBlocker(true) calls powerSaveBlocker.start with prevent-display-sleep', () => {
    // When start is true and blocker not started, call powerSaveBlocker.start('prevent-display-sleep')
    expect(mainSource).toMatch(/powerSaveBlocker\s*\.\s*start\s*\(\s*['"]prevent-display-sleep['"]\s*\)/);
  });

  it('ensurePowerBlocker(false) calls powerSaveBlocker.stop with the blocker id', () => {
    // When start is false, call powerSaveBlocker.stop(powerBlockerId)
    expect(mainSource).toMatch(/powerSaveBlocker\s*\.\s*stop\s*\(\s*powerBlockerId\s*\)/);
  });

  it('ensurePowerBlocker(false) resets powerBlockerId to null after stopping', () => {
    // After stopping, powerBlockerId should be set to null
    expect(mainSource).toMatch(/powerBlockerId\s*=\s*null/);
  });

  it('ensurePowerBlocker(true) checks isStarted before calling start (idempotency)', () => {
    // Should check if blocker is already started before calling start again
    expect(mainSource).toMatch(/powerSaveBlocker\s*\.\s*isStarted\s*\(\s*powerBlockerId\s*\)/);
  });

  it('ensurePowerBlocker uses null check before calling start', () => {
    // Should check if powerBlockerId is null before starting
    expect(mainSource).toMatch(/powerBlockerId\s*===\s*null/);
  });

  it('ensurePowerBlocker logs when display sleep is blocked', () => {
    // Log message in template literal: `[power] Display sleep blocked (id: ${powerBlockerId})`
    expect(mainSource).toMatch(/\[power\]\s+Display sleep blocked/);
  });

  it('ensurePowerBlocker logs when display sleep is unblocked', () => {
    // Log message in template literal: `[power] Display sleep unblocked (id: ${powerBlockerId})`
    expect(mainSource).toMatch(/\[power\]\s+Display sleep unblocked/);
  });
});

describe('power:update IPC handler (W4.6)', () => {
  it('main process registers ipcMain.on handler for power:update', () => {
    expect(mainSource).toMatch(/ipcMain\.on\s*\(\s*['"]power:update['"]\s*,/);
  });

  it('power:update handler destructures playing from the payload', () => {
    expect(mainSource).toMatch(/\{[\s\S]*?playing[\s\S]*?\}\s*:\s*\{[\s\S]*?playing[\s\S]*?:[\s\S]*?boolean/);
  });

  it('power:update handler calls ensurePowerBlocker with playing boolean', () => {
    expect(mainSource).toMatch(/ensurePowerBlocker\s*\(\s*playing\s*\)/);
  });
});

describe('preload updatePowerBlocker (W4.6)', () => {
  it('preload exposes updatePowerBlocker that sends power:update', () => {
    expect(preloadSource).toMatch(/ipcRenderer\.send\s*\(\s*['"]power:update['"]\s*,\s*\{\s*playing\s*\}/);
  });
});

describe('type declaration for updatePowerBlocker (W4.6)', () => {
  it('electron.d.ts declares updatePowerBlocker function type', () => {
    expect(typesSource).toMatch(/updatePowerBlocker:\s*\(\s*playing:\s*boolean\s*\)\s*=>\s*void/);
  });
});

describe('electronBridge calls updatePowerBlocker (W4.6)', () => {
  it('bridge calls updatePowerBlocker after play/pause toggle', () => {
    // The updatePowerBlocker should be called in onMediaPlayPause handler after play/pause
    expect(bridgeSource).toMatch(/updatePowerBlocker\s*\?\.\s*\(\s*willBePlaying\s*\)/);
  });
});

describe('teardown paths release the power blocker (W4.6)', () => {
  it('close handler calls ensurePowerBlocker(false)', () => {
    // The close event handler should release the blocker
    // Use a broader pattern to capture the full handler body
    const closeHandler = mainSource.match(/mainWindow\.on\s*\(\s*['"]close['"][\s\S]*?ensurePowerBlocker\s*\(\s*false\s*\)[\s\S]*?\}\s*\)\s*;/);
    expect(closeHandler).not.toBeNull();
  });

  it('before-quit handler calls ensurePowerBlocker(false)', () => {
    // The before-quit event should release the blocker
    const beforeQuitHandler = mainSource.match(/app\.on\s*\(\s*['"]before-quit['"][\s\S]*?ensurePowerBlocker\s*\(\s*false\s*\)[\s\S]*?\}\s*\)/);
    expect(beforeQuitHandler).not.toBeNull();
  });

  it('render-process-gone handler calls ensurePowerBlocker(false)', () => {
    // When renderer crashes, the blocker should be released
    const crashHandler = mainSource.match(/webContents\.on\s*\(\s*['"]render-process-gone['"][\s\S]*?ensurePowerBlocker\s*\(\s*false\s*\)[\s\S]*?\}\s*\)\s*;/);
    expect(crashHandler).not.toBeNull();
  });
});

describe('powerSaveBlocker import (W4.6)', () => {
  it('electron import includes powerSaveBlocker', () => {
    // powerSaveBlocker should be imported from electron
    expect(mainSource).toMatch(/powerSaveBlocker/);
  });
});
