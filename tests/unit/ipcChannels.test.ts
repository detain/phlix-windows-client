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

import { describe, it, expect, type Mock } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'fs';
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
 * showNotification: (title: string, body: string, clickAction?: string) =>
 *   ipcRenderer.invoke('notification:show', { title, body, clickAction }),
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
 * Extracts all `ipcRenderer.sendSync('...')` channel strings from a file.
 * M-WINDOWS-11: the token vault uses the synchronous protocol because
 * @phlix/ui's TokenStore contract is sync — these channels pair with
 * ipcMain.on handlers that answer via event.returnValue.
 */
function extractSendSyncChannels(content: string): string[] {
  const channels: string[] = [];
  const regex = /ipcRenderer\.sendSync\s*\(\s*['"]([^'"]+)['"]/gs;
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
const preloadSendSync = extractSendSyncChannels(preloadSource);
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
  const docSendSyncChannels = extractDocChannels(docContent, 'sendSync');
  const docPushChannels = extractDocChannels(docContent, 'push');

  it('every invoke channel in the doc appears in the preload', () => {
    const missing = docInvokeChannels.filter((ch) => !preloadInvoke.includes(ch));
    expect(missing).toHaveLength(0);
  });

  it('every send channel in the doc appears in the preload', () => {
    const missing = docSendChannels.filter((ch) => !preloadSend.includes(ch));
    expect(missing).toHaveLength(0);
  });

  it('every sendSync channel in the doc appears in the preload', () => {
    const missing = docSendSyncChannels.filter((ch) => !preloadSendSync.includes(ch));
    expect(missing).toHaveLength(0);
  });

  it('every push channel in the doc appears as a preload listener', () => {
    const missing = docPushChannels.filter((ch) => !preloadOnChannels.includes(ch));
    expect(missing).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// Doc currency (R-WINDOWS-03)
// ---------------------------------------------------------------------------

/**
 * R-WINDOWS-03: the doc drifted silently for whole eras — ALL main/renderer
 * line coordinates were stale, 8 channels had no row at all, and the prose
 * counts (35/19/9/6) were fiction. The direction-name checks above cannot
 * see a channel the doc OMITS (they only test doc→code), and nothing ever
 * verified the coordinates the doc DOES print. These pins make the table
 * load-bearing in both directions: completeness per inventory, exact
 * main-site sets per row, truth of every cited renderer line, and the prose
 * counts. A coord that rots now reddens the suite instead of lying quietly.
 */
type DocRow = { channel: string; direction: string; cells: string[] };

function parseDocTable(content: string): DocRow[] {
  const rows: DocRow[] = [];
  for (const line of content.split('\n')) {
    const m = line.match(/^\|\s*`([^`]+)`\s*\|/);
    if (!m) continue;
    const cells = line.split(/(?<!\\)\|/).slice(1, -1).map((c) => c.trim());
    rows.push({ channel: m[1], direction: cells[1], cells });
  }
  return rows;
}

/** 1-based lines where the direction's registration grammar mentions the channel. */
function mainSiteLines(direction: string, channel: string): number[] {
  const grammar =
    direction === 'invoke' ? 'ipcMain\\.handle\\(\\s*\'' :
    direction === 'push' ? 'webContents\\.send\\(\\s*\'' :
    'ipcMain\\.on\\(\\s*\'';
  const rx = new RegExp(grammar + channel.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\'');
  const lines = mainSource.split('\n');
  const hits: number[] = [];
  for (let i = 0; i < lines.length; i++) {
    if (rx.test(lines[i])) hits.push(i + 1);
  }
  return hits;
}

describe('doc currency (R-WINDOWS-03)', () => {
  const docContent = readFileSync(resolve(PROJECT_ROOT, 'docs/ipc-channels.md'), 'utf-8');
  const rows = parseDocTable(docContent);

  it('the doc enumerates EVERY live channel with its true direction (no omissions)', () => {
    const byDirection = (direction: string) =>
      rows.filter((r) => r.direction === direction).map((r) => r.channel).sort();
    expect(byDirection('invoke')).toEqual([...new Set(preloadInvoke)].sort());
    expect(byDirection('send')).toEqual([...new Set(preloadSend)].sort());
    expect(byDirection('sendSync')).toEqual([...new Set(preloadSendSync)].sort());
    expect(byDirection('push')).toEqual([...new Set(mainWebContentsSend)].sort());
    // Every row's direction must be one the code actually uses for it.
    const live = new Map<string, string>();
    [...new Set(preloadInvoke)].forEach((c) => live.set(c, 'invoke'));
    [...new Set(preloadSend)].forEach((c) => live.set(c, 'send'));
    [...new Set(preloadSendSync)].forEach((c) => live.set(c, 'sendSync'));
    [...new Set(mainWebContentsSend)].forEach((c) => live.set(c, 'push'));
    expect(rows.length).toBe(live.size);
    const misdirected = rows.filter((r) => live.get(r.channel) !== r.direction);
    expect(misdirected.map((r) => r.channel)).toEqual([]);
  });

  it('each row\'s Main Handler coordinates are exactly the live registration sites', () => {
    const offenders: string[] = [];
    for (const row of rows) {
      const cited = [...row.cells[4].matchAll(/\(([\d,\s]+)\)/g)]
        .flatMap((m) => m[1].split(',').map((s) => parseInt(s.trim(), 10)));
      const expected = mainSiteLines(row.direction, row.channel);
      if (String(cited.sort((a, b) => a - b)) !== String(expected.sort((a, b) => a - b))) {
        offenders.push(`${row.channel}: doc ${JSON.stringify(cited)} != live ${JSON.stringify(expected)}`);
      }
    }
    expect(offenders).toEqual([]);
  });

  it('each cited renderer line really calls the row\'s preload method', () => {
    const offenders: string[] = [];
    for (const row of rows) {
      const method = row.cells[5].match(/`([^`]+)`/)?.[1] ?? '';
      for (const site of row.cells[6].matchAll(/src\/renderer\/([\w./-]+):(\d+(?:,\s*\d+)*)/g)) {
        const file = readFileSync(resolve(PROJECT_ROOT, 'src/renderer', site[1]), 'utf-8').split('\n');
        for (const num of site[2].split(',').map((s) => parseInt(s.trim(), 10))) {
          if (!file[num - 1]?.includes(method)) {
            offenders.push(`${row.channel}: src/renderer/${site[1]}:${num} does not call ${method}`);
          }
        }
      }
    }
    expect(offenders).toEqual([]);
  });

  it('the prose counts match the measured inventories', () => {
    const distinct = new Set([
      ...preloadInvoke, ...preloadSend, ...preloadSendSync, ...mainWebContentsSend,
    ]);
    const claims: Array<[RegExp, number]> = [
      [/All (\d+) invoke channels/, new Set(preloadInvoke).size],
      [/All (\d+) send channels/, new Set(preloadSend).size],
      [/All (\d+) sendSync channels/, new Set(preloadSendSync).size],
      [/All (\d+) push channels/, new Set(mainWebContentsSend).size],
      [/for all (\d+) channels/, distinct.size],
    ];
    const offenders: string[] = [];
    for (const [rx, truth] of claims) {
      const m = docContent.match(rx);
      if (!m) offenders.push(`count sentence missing: ${rx}`);
      else if (Number(m[1]) !== truth) offenders.push(`${rx.source}: doc says ${m[1]}, truth is ${truth}`);
    }
    expect(offenders).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// The third leg (M-WINDOWS-39, review windows__gameux m5): the existing pins
// pair main<->preload and doc<->code, but NEVER asked who in the renderer
// calls a preload wrapper. Sixteen wrappers were silently consumer-less;
// this describe makes that class visible and pins the disclosed remainder.
// ---------------------------------------------------------------------------
describe('preload consumer inventory (M-WINDOWS-39)', () => {
  function preloadSurfaceMethods(source: string): string[] {
    const start = source.indexOf('const electronApiSurface = {');
    if (start === -1) throw new Error('preload: electronApiSurface declaration not found');
    const end = source.indexOf('\n};', start);
    if (end === -1) throw new Error('preload: electronApiSurface block unterminated');
    const names: string[] = [];
    for (const line of source.slice(start, end).split('\n')) {
      const m = line.match(/^ {2}([A-Za-z][\w]*)\s*:/);
      if (m) names.push(m[1]);
    }
    return [...new Set(names)].sort();
  }

  function rendererSources(): string[] {
    const out: string[] = [];
    const walk = (dir: string): void => {
      for (const entry of readdirSync(dir)) {
        const p = resolve(dir, entry);
        if (statSync(p).isDirectory()) { walk(p); continue; }
        // Declaration files mirror the API shape without calling it — they
        // are not consumers and never were.
        if (!/\.(ts|tsx)$/.test(entry) || /\.d\.ts$/.test(entry)) continue;
        out.push(readFileSync(p, 'utf-8'));
      }
    };
    walk(resolve(PROJECT_ROOT, 'src/renderer'));
    return out;
  }

  // Every no-consumer wrapper, named, with why its surface is intentionally
  // retained. Retiring a wrapper means deleting its row here in the same
  // commit; NEW silent orphans outside this list redden the pin.
  const PRELOAD_SHELL_ONLY: Record<string, string> = {
    getAppPath: 'diagnostic wrapper (W4.9 built the API "if-needed"); no about/diagnostics view was ever written in this shell.',
    getVersion: 'same W4.9 diagnostic class — renderer reads version through ui/server paths instead.',
    setAlwaysOnTop: 'the window-manager behaviour is main-driven (menu View toggle); no in-app surface exists.',
    minimizeToTray: 'tray policy lives in main (close handler + menu); a renderer trigger would bypass the single owner.',
    getMinimizeToTray: 'paired read of the above; no settings UI consumes it yet (deferred with the toggle surface).',
    setMinimizeToTray: 'same deferred settings surface as getMinimizeToTray.',
    hubSetConfig: 'hub config is seeded by main/resolve paths; a hub-switcher UI is not implemented (read side hubGetConfig HAS a consumer).',
    getDisableHardwareAcceleration: 'GPU settings UI never written (W4.12 pre-built the IPC); control today = env escape hatch + startup store arm (M-WINDOWS-15 law).',
    setDisableHardwareAcceleration: 'same deferred GPU settings surface.',
    getGpuFeatureStatus: 'same deferred GPU diagnostics surface.',
    checkForUpdates: 'updater UX is main-driven (menu item + native toasts); no renderer update UI at v0.99.10 pin (@phlix/ui references no electronAPI — bundle-verified).',
    getUpdateStatus: 'same deferred updater-UI class as checkForUpdates.',
    onUpdateAvailable: 'push subscription kept with the update:* trio for the same deferred-UI reason.',
    onUpdateProgress: 'same deferred updater-UI class.',
    onUpdateDownloaded: 'same deferred updater-UI class.'
  };

  it('the no-consumer preload set is exactly the disclosed inventory', () => {
    const files = rendererSources();
    const dead = preloadSurfaceMethods(preloadSource).filter(
      (name) => !files.some((src) => src.includes(`.${name}`))
    );
    expect(dead).toEqual(Object.keys(PRELOAD_SHELL_ONLY).sort());
  });

  it('the revived showNotification wrapper has its boot-gate consumer', () => {
    // M-WINDOWS-39's cure leg: the incompatible-server path must still route
    // the rejection through notification:show (pref-gated main-side).
    expect(preloadSurfaceMethods(preloadSource)).toContain('showNotification');
    const boot = readFileSync(resolve(PROJECT_ROOT, 'src/renderer/main.ts'), 'utf-8');
    expect(boot).toMatch(/api\.showNotification\?\.\(tWin\('boot\.incompatible/);
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

  describe('preload sendSync channels (M-WINDOWS-11 vault)', () => {
    it('every preload ipcRenderer.sendSync channel has a matching ipcMain.on', () => {
      const missing = preloadSendSync.filter((ch) => !mainOn.includes(ch));
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
    it('every ipcMain.on channel is used by the preload via ipcRenderer.send or ipcRenderer.sendSync', () => {
      // M-WINDOWS-11: the vault on-channels are consumed with the SYNCHRONOUS
      // protocol (event.returnValue) — sendSync is a legitimate consumer shape;
      // fire-and-forget send is the other. Anything else is an orphan.
      const orphan = mainOn.filter((ch) => !preloadSend.includes(ch) && !preloadSendSync.includes(ch));
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
        'app:check-server-version',
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
        'tray:get-minimize-to-tray',
        'update:check-for-updates',
        'update:get-status'
      ].sort());
    });

    it('main process registers the expected number of handle channels', () => {
      expect(mainHandle.sort()).toEqual([
        'app:check-server-version',
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
        'tray:get-minimize-to-tray',
        'update:check-for-updates',
        'update:get-status'
      ].sort());
    });

    it('preload uses exactly seven send channels (set-always-on-top, minimize-to-tray, tray:set-minimize-to-tray, thumbar:update, playback:progress, power:update, deeplink:ready) — W4.5 + M-WINDOWS-06', () => {
      expect(preloadSend.sort()).toEqual(['minimize-to-tray', 'set-always-on-top', 'tray:set-minimize-to-tray', 'thumbar:update', 'playback:progress', 'power:update', 'deeplink:ready'].sort());
    });

    it('preload uses exactly four sendSync channels — the M-WINDOWS-11 vault surface', () => {
      expect(preloadSendSync.sort()).toEqual(['vault:get', 'vault:set', 'vault:delete', 'vault:is-available'].sort());
    });

    it('main process has exactly eleven on channels — seven send + four sendSync (M-WINDOWS-11 vault) — W4.5 + M-WINDOWS-06', () => {
      expect(mainOn.sort()).toEqual(['minimize-to-tray', 'set-always-on-top', 'tray:set-minimize-to-tray', 'thumbar:update', 'playback:progress', 'power:update', 'deeplink:ready', 'vault:get', 'vault:set', 'vault:delete', 'vault:is-available'].sort());
    });

    it('main process sends exactly nine distinct push channels to renderer', () => {
      // M-WINDOWS-35: media-previous/media-next/media-seek-to left with the shell's
      // second SMTC installer; media-play-pause/stop/rewind/forward remain (thumbar/tray/menu).
      expect([...new Set(mainWebContentsSend)].sort()).toEqual([
        'deeplink:open',
        'media-forward',
        'media-play-pause',
        'media-rewind',
        'media-stop',
        'open-settings',
        'update:available',
        'update:downloaded',
        'update:progress'
      ].sort());
    });

    it('preload listens to exactly nine push channels from main', () => {
      expect(preloadOnChannels.sort()).toEqual([
        'deeplink:open',
        'media-forward',
        'media-play-pause',
        'media-rewind',
        'media-stop',
        'open-settings',
        'update:available',
        'update:downloaded',
        'update:progress'
      ].sort());
    });
  });

  describe('behavioral round-trips', () => {
    // Simulate window.electronAPI as the preload bridge sees it
    type ElectronAPI = {
      getAppPath: Mock;
      getVersion: Mock;
      getDeviceId: Mock;
      getServerUrl: Mock;
      setServerUrl: Mock;
      hubGetConfig: Mock;
      hubSetConfig: Mock;
      getMinimizeToTray: Mock;
      setAlwaysOnTop: Mock;
      minimizeToTray: Mock;
      setMinimizeToTray: Mock;
      onMediaPlayPause: Mock;
      onMediaStop: Mock;
      onMediaRewind: Mock;
      onMediaForward: Mock;
      onOpenSettings: Mock;
    };

    let electronAPI: ElectronAPI;
    let ipcRendererInvoke: Mock;
    let ipcRendererSend: Mock;
    let ipcRendererOn: Mock;
    let ipcRendererRemoveListener: Mock;

    beforeEach(() => {
      ipcRendererInvoke = vi.fn();
      ipcRendererSend = vi.fn();
      ipcRendererRemoveListener = vi.fn();
      ipcRendererOn = vi.fn((channel: string, handler: (...args: unknown[]) => void) => {
        // Simulate the real behavior: store the handler so we can call it
        (ipcRendererOn as any)[channel] = handler;
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
          (ipcRendererOn as any)[channel] = cb;
          ipcRendererOn(channel, cb);
          return () => ipcRendererRemoveListener(channel, cb);
        }),
        onMediaStop: vi.fn((cb: () => void) => {
          const channel = 'media-stop';
          (ipcRendererOn as any)[channel] = cb;
          ipcRendererOn(channel, cb);
          return () => ipcRendererRemoveListener(channel, cb);
        }),
        onMediaRewind: vi.fn((cb: () => void) => {
          const channel = 'media-rewind';
          (ipcRendererOn as any)[channel] = cb;
          ipcRendererOn(channel, cb);
          return () => ipcRendererRemoveListener(channel, cb);
        }),
        onMediaForward: vi.fn((cb: () => void) => {
          const channel = 'media-forward';
          (ipcRendererOn as any)[channel] = cb;
          ipcRendererOn(channel, cb);
          return () => ipcRendererRemoveListener(channel, cb);
        }),
        onOpenSettings: vi.fn((cb: () => void) => {
          const channel = 'open-settings';
          (ipcRendererOn as any)[channel] = cb;
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
