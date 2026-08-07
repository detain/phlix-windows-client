/**
 * @vitest-environment node
 *
 * Tests for W4.5: taskbar thumbnail toolbar buttons and taskbar progress bar.
 *
 * Verifies:
 * - setupThumbarButtons() is exported from main/index.ts
 * - thumbar:update IPC handler is registered
 * - playback:progress IPC handler is registered
 * - preload exposes updateThumbar (ipcRenderer.send)
 * - preload exposes setPlaybackProgress (ipcRenderer.send)
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const PROJECT_ROOT = resolve(__dirname, '../..');

const mainSource = readFileSync(resolve(PROJECT_ROOT, 'src/main/index.ts'), 'utf-8');
const preloadSource = readFileSync(resolve(PROJECT_ROOT, 'src/preload/index.ts'), 'utf-8');

describe('thumbar buttons (W4.5)', () => {
  it('setupThumbarButtons is exported from main/index.ts', () => {
    // The function is defined and exported so it can be called from createWindow
    expect(mainSource).toMatch(/export\s+function\s+setupThumbarButtons\s*\(\s*\)/);
  });

  it('setupThumbarButtons calls mainWindow.setThumbarButtons with an array of buttons', () => {
    // The function should call setThumbarButtons with buttons array
    expect(mainSource).toMatch(/mainWindow\.setThumbarButtons\s*\(\s*buttons\s*\)/);
  });

  it('setupThumbarButtons uses nativeImage.createFromPath with build/icon.png', () => {
    expect(mainSource).toMatch(/nativeImage\.createFromPath\s*\(\s*iconPath\s*\)/);
    expect(mainSource).toMatch(/build[/\\]icon\.png/);
  });

  it('thumbar buttons array has 3 entries: previous, play-pause, next', () => {
    // Should have three ThumbarButton entries in the buttons array
    const buttonsDef = mainSource.match(/const buttons: ThumbarButton\[\] = \[[\s\S]*?\];/);
    expect(buttonsDef).not.toBeNull();
    // Count the tooltip entries to confirm 3 buttons
    const tooltips = (buttonsDef![0].match(/tooltip:/g) || []).length;
    expect(tooltips).toBe(3);
  });
});

describe('thumbar:update IPC channel (W4.5)', () => {
  it('main process registers ipcMain.on handler for thumbar:update', () => {
    expect(mainSource).toMatch(/ipcMain\.on\s*\(\s*['"]thumbar:update['"]\s*,/);
  });

  it('thumbar:update handler calls updateThumbarPlayState with the playing boolean', () => {
    expect(mainSource).toMatch(/updateThumbarPlayState\s*\(\s*state\.playing\s*\)/);
  });

  it('preload exposes updateThumbar that sends thumbar:update', () => {
    // Should be ipcRenderer.send('thumbar:update', state)
    expect(preloadSource).toMatch(/ipcRenderer\.send\s*\(\s*['"]thumbar:update['"]\s*,\s*state\s*\)/);
  });
});

describe('playback:progress IPC channel (W4.5)', () => {
  it('main process registers ipcMain.on handler for playback:progress', () => {
    expect(mainSource).toMatch(/ipcMain\.on\s*\(\s*['"]playback:progress['"]\s*,/);
  });

  it('playback:progress handler updates taskbar progress bar', () => {
    // When total > 0 and current < total: setProgressBar(current / total)
    // When total === 0 or current >= total: setProgressBar(-1) to clear
    expect(mainSource).toMatch(/setProgressBar\s*\(\s*current\s*\/\s*total\s*\)/);
    expect(mainSource).toMatch(/setProgressBar\s*\(\s*-1\s*\)/);
  });

  it('preload exposes setPlaybackProgress that sends playback:progress', () => {
    // Should be ipcRenderer.send('playback:progress', { current, total })
    expect(preloadSource).toMatch(/ipcRenderer\.send\s*\(\s*['"]playback:progress['"]\s*,\s*\{\s*current,\s*total\s*\}\s*\)/);
  });
});

describe('integration: bridge wires thumbar and progress calls (W4.5)', () => {
  it('electronBridge calls updateThumbar after play/pause toggle', () => {
    const bridgeSource = readFileSync(resolve(PROJECT_ROOT, 'src/renderer/electronBridge.ts'), 'utf-8');
    // W4.5 fix: updateThumbar receives willBePlaying (known state before async play/pause)
    expect(bridgeSource).toMatch(/updateThumbar\s*\?\.\s*\(\s*\{\s*playing:\s*willBePlaying\s*\}\s*\)/);
  });

  it('electronBridge calls setPlaybackProgress after play/pause toggle', () => {
    const bridgeSource = readFileSync(resolve(PROJECT_ROOT, 'src/renderer/electronBridge.ts'), 'utf-8');
    expect(bridgeSource).toMatch(/setPlaybackProgress\s*\?\.\s*\(\s*player\.position\s*,\s*player\.duration\s*\)/);
  });

  it('electronBridge calls setPlaybackProgress after rewind', () => {
    const bridgeSource = readFileSync(resolve(PROJECT_ROOT, 'src/renderer/electronBridge.ts'), 'utf-8');
    // Inside onMediaRewind handler
    const rewindHandler = bridgeSource.match(/onMediaRewind[\s\S]*?seekBy[\s\S]*?\}/);
    expect(rewindHandler && rewindHandler[0]).toMatch(/setPlaybackProgress\s*\?\./);
  });

  it('electronBridge calls setPlaybackProgress after forward', () => {
    const bridgeSource = readFileSync(resolve(PROJECT_ROOT, 'src/renderer/electronBridge.ts'), 'utf-8');
    // Inside onMediaForward handler
    const forwardHandler = bridgeSource.match(/onMediaForward[\s\S]*?seekBy[\s\S]*?\}/);
    expect(forwardHandler && forwardHandler[0]).toMatch(/setPlaybackProgress\s*\?\./);
  });
});

describe('type definitions (W4.5)', () => {
  it('electron.d.ts declares updateThumbar with correct signature', () => {
    const typesSource = readFileSync(resolve(PROJECT_ROOT, 'src/renderer/types/electron.d.ts'), 'utf-8');
    expect(typesSource).toMatch(/updateThumbar:\s*\(\s*state:\s*\{\s*playing:\s*boolean\s*\}\s*\)\s*=>\s*void/);
  });

  it('electron.d.ts declares setPlaybackProgress with correct signature', () => {
    const typesSource = readFileSync(resolve(PROJECT_ROOT, 'src/renderer/types/electron.d.ts'), 'utf-8');
    expect(typesSource).toMatch(/setPlaybackProgress:\s*\(\s*current:\s*number\s*,\s*total:\s*number\s*\)\s*=>\s*void/);
  });
});
