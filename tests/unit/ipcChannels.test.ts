/**
 * @vitest-environment node
 *
 * Tests that every IPC channel exposed by the preload script has a matching
 * ipcMain handler registered in the main process, and that every ipcMain.handle
 * in the main process has a corresponding preload.invoke() caller.
 *
 * This prevents "orphan handlers" (main has handler, preload never calls it)
 * and "orphan channels" (preload calls channel, main has no handler).
 *
 * Root cause: W0.7 identified that src/main/** and src/preload/** were excluded
 * from coverage, hiding IPC wiring gaps. This test enforces the contract
 * between preload channels and main-process handlers.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const PROJECT_ROOT = resolve(__dirname, '../..');

// ---------------------------------------------------------------------------
// Channel extraction helpers
// ---------------------------------------------------------------------------

/**
 * Extracts all `ipcRenderer.invoke('...')` channel strings from a file.
 *
 * Uses dotAll mode (`s` flag) because some invoke calls span multiple lines:
 * ```
 * syncPlayConnect: (roomId, serverUrl, token) =>
 *   ipcRenderer.invoke('syncplay:connect', { roomId, serverUrl, token }),
 * ```
 */
function extractInvokeChannels(content: string): string[] {
  const channels: string[] = [];
  // dotAll makes . match newlines, so we can match across line boundaries
  const regex = /ipcRenderer\.invoke\s*\(\s*['"]([^'"]+)['"]/gs;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(content)) !== null) {
    channels.push(match[1]);
  }
  return channels;
}

/**
 * Extracts all `ipcRenderer.send('...')` channel strings from a file.
 */
function extractSendChannels(content: string): string[] {
  const channels: string[] = [];
  // dotAll for consistency (send is single-line but uses same approach)
  // Note: no trailing comma requirement - minimize-to-tray has no trailing comma
  const regex = /ipcRenderer\.send\s*\(\s*['"]([^'"]+)['"]/gs;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(content)) !== null) {
    channels.push(match[1]);
  }
  return channels;
}

/**
 * Extracts all `ipcMain.handle('...')` channel strings from a file.
 */
function extractHandleChannels(content: string): string[] {
  const channels: string[] = [];
  // ipcMain.handle('channel', ...) or ipcMain.handle("channel", ...)
  const regex = /ipcMain\.handle\s*\(\s*['"]([^'"]+)['"]\s*,/g;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(content)) !== null) {
    channels.push(match[1]);
  }
  return channels;
}

/**
 * Extracts all `ipcMain.on('...')` channel strings from a file.
 */
function extractOnChannels(content: string): string[] {
  const channels: string[] = [];
  // ipcMain.on('channel', ...) or ipcMain.on("channel", ...)
  const regex = /ipcMain\.on\s*\(\s*['"]([^'"]+)['"]\s*,/g;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(content)) !== null) {
    channels.push(match[1]);
  }
  return channels;
}

/**
 * Extracts all `webContents.send('...')` channel strings from main process source.
 * These are the main→renderer push channels.
 */
function extractWebContentsSendChannels(content: string): string[] {
  const channels: string[] = [];
  // mainWindow?.webContents.send('channel', ...) or mainWindow.webContents.send("channel", ...)
  const regex = /webContents\.send\s*\(\s*['"]([^'"]+)['"]/g;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(content)) !== null) {
    channels.push(match[1]);
  }
  return channels;
}

/**
 * Extracts all `ipcRenderer.on('...')` channel strings from preload source.
 * These are the renderer listeners for main→renderer push channels.
 */
function extractPreloadOnChannels(content: string): string[] {
  const channels: string[] = [];
  // ipcRenderer.on('channel', ...) or ipcRenderer.on("channel", ...)
  // Captures the channel string (first argument before the callback)
  const regex = /ipcRenderer\.on\s*\(\s*['"]([^'"]+)['"]/g;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(content)) !== null) {
    channels.push(match[1]);
  }
  return channels;
}

// ---------------------------------------------------------------------------
// Test data
// ---------------------------------------------------------------------------

const preloadSource = readFileSync(resolve(PROJECT_ROOT, 'src/preload/index.ts'), 'utf-8');
const mainSource = readFileSync(resolve(PROJECT_ROOT, 'src/main/index.ts'), 'utf-8');

const preloadInvoke = extractInvokeChannels(preloadSource);
const preloadSend = extractSendChannels(preloadSource);
const mainHandle = extractHandleChannels(mainSource);
const mainOn = extractOnChannels(mainSource);
const mainWebContentsSend = extractWebContentsSendChannels(mainSource);
const preloadOnChannels = extractPreloadOnChannels(preloadSource);

describe('IPC channel pairing', () => {
  describe('preload invoke channels', () => {
    it('every preload ipcRenderer.invoke channel has a matching ipcMain.handle', () => {
      const missing = preloadInvoke.filter((ch) => !mainHandle.includes(ch));
      expect(missing).toHaveLength(0);
    });
  });

  describe('preload send channels', () => {
    it('every preload ipcRenderer.send channel has a matching ipcMain.on', () => {
      const missing = preloadSend.filter((ch) => !mainOn.includes(ch));
      expect(missing).toHaveLength(0);
    });
  });

  describe('main handle channels', () => {
    it('every ipcMain.handle channel is exposed by the preload via ipcRenderer.invoke', () => {
      const orphan = mainHandle.filter((ch) => !preloadInvoke.includes(ch));
      expect(orphan).toHaveLength(0);
    });
  });

  describe('main on channels', () => {
    it('every ipcMain.on channel is used by the preload via ipcRenderer.send', () => {
      const orphan = mainOn.filter((ch) => !preloadSend.includes(ch));
      expect(orphan).toHaveLength(0);
    });
  });

  describe('main→renderer push channels (webContents.send)', () => {
    it('every webContents.send channel has a matching ipcRenderer.on listener in preload', () => {
      const missing = mainWebContentsSend.filter((ch) => !preloadOnChannels.includes(ch));
      expect(missing).toHaveLength(0);
    });

    it('every ipcRenderer.on listener in preload has a corresponding webContents.send in main', () => {
      // We only check that preload listeners have a potential sender.
      const orphan = preloadOnChannels.filter((ch) => !mainWebContentsSend.includes(ch));
      expect(orphan).toHaveLength(0);
    });
  });

  describe('channel inventory', () => {
    it('preload exposes the expected number of invoke channels', () => {
      // Update this count when new channels are added
      expect(preloadInvoke.sort()).toEqual([
        'app:get-device-id',
        'app:get-server-url',
        'app:set-server-url',
        'get-app-path',
        'get-version',
        'hub:get-config',
        'hub:set-config',
        'tray:get-minimize-to-tray'
      ].sort());
    });

    it('main process registers the expected number of handle channels', () => {
      expect(mainHandle.sort()).toEqual([
        'app:get-device-id',
        'app:get-server-url',
        'app:set-server-url',
        'get-app-path',
        'get-version',
        'hub:get-config',
        'hub:set-config',
        'tray:get-minimize-to-tray'
      ].sort());
    });

    it('preload uses exactly three send channels (set-always-on-top, minimize-to-tray, tray:set-minimize-to-tray)', () => {
      expect(preloadSend.sort()).toEqual(['minimize-to-tray', 'set-always-on-top', 'tray:set-minimize-to-tray'].sort());
    });

    it('main process has exactly three on channels matching the preload send channels', () => {
      expect(mainOn.sort()).toEqual(['minimize-to-tray', 'set-always-on-top', 'tray:set-minimize-to-tray'].sort());
    });

    it('main process sends exactly five distinct push channels to renderer', () => {
      // media-*, open-settings (unique channel names)
      expect([...new Set(mainWebContentsSend)].sort()).toEqual([
        'media-forward',
        'media-play-pause',
        'media-rewind',
        'media-stop',
        'open-settings'
      ].sort());
    });

    it('preload listens to exactly five push channels from main', () => {
      expect(preloadOnChannels.sort()).toEqual([
        'media-forward',
        'media-play-pause',
        'media-rewind',
        'media-stop',
        'open-settings'
      ].sort());
    });
  });
});
