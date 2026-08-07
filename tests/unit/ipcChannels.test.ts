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

// ---------------------------------------------------------------------------
// Doc-vs-code alignment
// ---------------------------------------------------------------------------

/**
 * Extracts channel names from the doc table for a given direction.
 * Table rows look like: | `channel-name` | direction | ...
 */
function extractDocChannels(content: string, direction: string): string[] {
  const channels: string[] = [];
  // Match table rows where the second cell is exactly the direction
  // First column is the channel name in backticks: `channel-name`
  const regex = new RegExp(
    String.raw`^\s*\|\s*\`([^\`]+)\`\s*\|\s*${direction}\s*\|`,
    'gm'
  );
  let match: RegExpExecArray | null;
  while ((match = regex.exec(content)) !== null) {
    channels.push(match[1]);
  }
  return channels;
}

describe('doc vs code alignment', () => {
  // Read the doc file once at the top of this describe block
  const docContent = readFileSync(resolve(PROJECT_ROOT, 'docs/ipc-channels.md'), 'utf-8');

  const docInvokeChannels = extractDocChannels(docContent, 'invoke');
  const docSendChannels = extractDocChannels(docContent, 'send');
  const docPushChannels = extractDocChannels(docContent, 'push');

  it('every invoke channel in the doc appears in the preload', () => {
    const missing = docInvokeChannels.filter((ch) => !preloadInvoke.includes(ch));
    expect(missing).toHaveLength(0);
  });

  it('every send channel in the doc appears in the preload', () => {
    const missing = docSendChannels.filter((ch) => !preloadSend.includes(ch));
    expect(missing).toHaveLength(0);
  });

  it('every push channel in the doc appears as a preload listener', () => {
    const missing = docPushChannels.filter((ch) => !preloadOnChannels.includes(ch));
    expect(missing).toHaveLength(0);
  });
});

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
        'gpu:get-disable-hardware-acceleration',
        'gpu:get-feature-status',
        'gpu:set-disable-hardware-acceleration',
        'hub:get-config',
        'hub:set-config',
        'notification:show',
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
        'gpu:get-disable-hardware-acceleration',
        'gpu:get-feature-status',
        'gpu:set-disable-hardware-acceleration',
        'hub:get-config',
        'hub:set-config',
        'notification:show',
        'tray:get-minimize-to-tray'
      ].sort());
    });

    it('preload uses exactly six send channels (set-always-on-top, minimize-to-tray, tray:set-minimize-to-tray, thumbar:update, playback:progress, power:update) — W4.5', () => {
      expect(preloadSend.sort()).toEqual(['minimize-to-tray', 'set-always-on-top', 'tray:set-minimize-to-tray', 'thumbar:update', 'playback:progress', 'power:update'].sort());
    });

    it('main process has exactly six on channels matching the preload send channels — W4.5', () => {
      expect(mainOn.sort()).toEqual(['minimize-to-tray', 'set-always-on-top', 'tray:set-minimize-to-tray', 'thumbar:update', 'playback:progress', 'power:update'].sort());
    });

    it('main process sends exactly six distinct push channels to renderer', () => {
      // media-*, open-settings, deeplink:open (unique channel names)
      expect([...new Set(mainWebContentsSend)].sort()).toEqual([
        'deeplink:open',
        'media-forward',
        'media-play-pause',
        'media-rewind',
        'media-stop',
        'open-settings'
      ].sort());
    });

    it('preload listens to exactly six push channels from main', () => {
      expect(preloadOnChannels.sort()).toEqual([
        'deeplink:open',
        'media-forward',
        'media-play-pause',
        'media-rewind',
        'media-stop',
        'open-settings'
      ].sort());
    });
  });

  describe('behavioral round-trips', () => {
    // Simulate window.electronAPI as the preload bridge sees it
    type ElectronAPI = {
      getAppPath: ReturnType<typeof vi.fn>;
      getVersion: ReturnType<typeof vi.fn>;
      getDeviceId: ReturnType<typeof vi.fn>;
      getServerUrl: ReturnType<typeof vi.fn>;
      setServerUrl: ReturnType<typeof vi.fn>;
      hubGetConfig: ReturnType<typeof vi.fn>;
      hubSetConfig: ReturnType<typeof vi.fn>;
      getMinimizeToTray: ReturnType<typeof vi.fn>;
      setAlwaysOnTop: ReturnType<typeof vi.fn>;
      minimizeToTray: ReturnType<typeof vi.fn>;
      setMinimizeToTray: ReturnType<typeof vi.fn>;
      onMediaPlayPause: ReturnType<typeof vi.fn>;
      onMediaStop: ReturnType<typeof vi.fn>;
      onMediaRewind: ReturnType<typeof vi.fn>;
      onMediaForward: ReturnType<typeof vi.fn>;
      onOpenSettings: ReturnType<typeof vi.fn>;
    };

    let electronAPI: ElectronAPI;
    let ipcRendererInvoke: ReturnType<typeof vi.fn>;
    let ipcRendererSend: ReturnType<typeof vi.fn>;
    let ipcRendererOn: ReturnType<typeof vi.fn>;
    let ipcRendererRemoveListener: ReturnType<typeof vi.fn>;

    beforeEach(() => {
      ipcRendererInvoke = vi.fn();
      ipcRendererSend = vi.fn();
      ipcRendererRemoveListener = vi.fn();
      ipcRendererOn = vi.fn((channel: string, handler: (...args: unknown[]) => void) => {
        // Simulate the real behavior: store the handler so we can call it
        ipcRendererOn[channel] = handler;
        // Return a cleanup function (as the real preload does)
        return () => {
          ipcRendererRemoveListener(channel, handler);
        };
      });

      electronAPI = {
        getAppPath: vi.fn(() => ipcRendererInvoke('get-app-path')),
        getVersion: vi.fn(() => ipcRendererInvoke('get-version')),
        getDeviceId: vi.fn(() => ipcRendererInvoke('app:get-device-id')),
        getServerUrl: vi.fn(() => ipcRendererInvoke('app:get-server-url')),
        setServerUrl: vi.fn((url: string) => ipcRendererInvoke('app:set-server-url', url)),
        hubGetConfig: vi.fn(() => ipcRendererInvoke('hub:get-config')),
        hubSetConfig: vi.fn((cfg: unknown) => ipcRendererInvoke('hub:set-config', cfg)),
        getMinimizeToTray: vi.fn(() => ipcRendererInvoke('tray:get-minimize-to-tray')),
        setAlwaysOnTop: vi.fn((flag: boolean) => ipcRendererSend('set-always-on-top', flag)),
        minimizeToTray: vi.fn(() => ipcRendererSend('minimize-to-tray')),
        setMinimizeToTray: vi.fn((flag: boolean) => ipcRendererSend('tray:set-minimize-to-tray', flag)),
        onMediaPlayPause: vi.fn((cb: () => void) => {
          const channel = 'media-play-pause';
          ipcRendererOn[channel] = cb;
          ipcRendererOn(channel, cb);
          return () => ipcRendererRemoveListener(channel, cb);
        }),
        onMediaStop: vi.fn((cb: () => void) => {
          const channel = 'media-stop';
          ipcRendererOn[channel] = cb;
          ipcRendererOn(channel, cb);
          return () => ipcRendererRemoveListener(channel, cb);
        }),
        onMediaRewind: vi.fn((cb: () => void) => {
          const channel = 'media-rewind';
          ipcRendererOn[channel] = cb;
          ipcRendererOn(channel, cb);
          return () => ipcRendererRemoveListener(channel, cb);
        }),
        onMediaForward: vi.fn((cb: () => void) => {
          const channel = 'media-forward';
          ipcRendererOn[channel] = cb;
          ipcRendererOn(channel, cb);
          return () => ipcRendererRemoveListener(channel, cb);
        }),
        onOpenSettings: vi.fn((cb: () => void) => {
          const channel = 'open-settings';
          ipcRendererOn[channel] = cb;
          ipcRendererOn(channel, cb);
          return () => ipcRendererRemoveListener(channel, cb);
        })
      };
    });

    describe('invoke channels', () => {
      it('get-app-path calls ipcRenderer.invoke with the correct channel', () => {
        ipcRendererInvoke.mockResolvedValue('/some/path');
        electronAPI.getAppPath();
        expect(ipcRendererInvoke).toHaveBeenCalledWith('get-app-path');
      });

      it('app:get-device-id calls ipcRenderer.invoke with the correct channel', () => {
        ipcRendererInvoke.mockResolvedValue('device-123');
        electronAPI.getDeviceId();
        expect(ipcRendererInvoke).toHaveBeenCalledWith('app:get-device-id');
      });

      it('hub:get-config calls ipcRenderer.invoke with the correct channel', () => {
        ipcRendererInvoke.mockResolvedValue({ hubUrl: 'https://hub.example.com' });
        electronAPI.hubGetConfig();
        expect(ipcRendererInvoke).toHaveBeenCalledWith('hub:get-config');
      });
    });

    describe('send channels (fire-and-forget)', () => {
      it('minimize-to-tray calls ipcRenderer.send with the correct channel', () => {
        electronAPI.minimizeToTray();
        expect(ipcRendererSend).toHaveBeenCalledWith('minimize-to-tray');
      });

      it('set-always-on-top(true) calls ipcRenderer.send with the channel and true', () => {
        electronAPI.setAlwaysOnTop(true);
        expect(ipcRendererSend).toHaveBeenCalledWith('set-always-on-top', true);
      });

      it('set-always-on-top(false) calls ipcRenderer.send with the channel and false', () => {
        electronAPI.setAlwaysOnTop(false);
        expect(ipcRendererSend).toHaveBeenCalledWith('set-always-on-top', false);
      });

      it('setMinimizeToTray(true) calls ipcRenderer.send with the correct channel and true', () => {
        electronAPI.setMinimizeToTray(true);
        expect(ipcRendererSend).toHaveBeenCalledWith('tray:set-minimize-to-tray', true);
      });
    });

    describe('push channels (main→renderer via on* helpers)', () => {
      it('onMediaPlayPause registers a listener and returns a cleanup function', () => {
        const cb = vi.fn();
        const cleanup = electronAPI.onMediaPlayPause(cb);
        expect(ipcRendererOn).toHaveBeenCalledWith('media-play-pause', cb);
        expect(typeof cleanup).toBe('function');
        // Simulate calling the cleanup
        cleanup();
        expect(ipcRendererRemoveListener).toHaveBeenCalledWith('media-play-pause', cb);
      });

      it('onMediaStop registers a listener and returns a cleanup function', () => {
        const cb = vi.fn();
        const cleanup = electronAPI.onMediaStop(cb);
        expect(ipcRendererOn).toHaveBeenCalledWith('media-stop', cb);
        expect(typeof cleanup).toBe('function');
        cleanup();
        expect(ipcRendererRemoveListener).toHaveBeenCalledWith('media-stop', cb);
      });

      it('onOpenSettings registers a listener and returns a cleanup function', () => {
        const cb = vi.fn();
        const cleanup = electronAPI.onOpenSettings(cb);
        expect(ipcRendererOn).toHaveBeenCalledWith('open-settings', cb);
        expect(typeof cleanup).toBe('function');
        cleanup();
        expect(ipcRendererRemoveListener).toHaveBeenCalledWith('open-settings', cb);
      });
    });
  });
});
