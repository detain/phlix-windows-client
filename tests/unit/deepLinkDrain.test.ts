/**
 * @vitest-environment node
 *
 * M-WINDOWS-06 — event-driven cold-start deep-link drain.
 *
 * Root cause this pins fixed: cold-start delivery used to be
 * `app.once('browser-window-created') → setTimeout(handleDeepLinkUrl, 1000)`.
 * The renderer subscribes to 'deeplink:open' only inside boot(), after three
 * IPC round-trips plus an HTTP server-version check (src/renderer/main.ts),
 * so any boot slower than the arbitrary 1000ms silently dropped the link —
 * and the timer kept a second dispatch shape alive on the same surface.
 *
 * The cure: every deep-link surface enqueues into one pending queue; the
 * drain fires ONLY when the renderer announces 'deeplink:ready' after its
 * listener is live. These tests run with REAL timers and drive the EVENT
 * sequence (handshake late, reloads, window replacement) — deliberately NOT
 * fake timers: the whole law is that no timer exists on this path anymore,
 * and the 1100ms hold-past-the-old-deadline test is exactly the shape the
 * setTimeout era could not survive.
 *
 * The harness mirrors tests/unit/trayRestoreWiring.test.ts (same electron
 * mock discipline) with one extension: window/webContents event handlers are
 * RECORDED so navigation events (did-start-loading / did-finish-load /
 * closed) can be fired as real events, and process.argv carries a
 * phlix:// URL at module evaluation — a true cold start, not a proxy.
 */

import { describe, it, expect, vi, beforeAll } from 'vitest';
import { requiresDeepLinkConfirmation } from '../../src/main/deepLinkValidator';

// ---------------------------------------------------------------------------
// Hoisted recording state
// ---------------------------------------------------------------------------
const tracks = vi.hoisted(() => {
  interface RecordedWindow {
    calls: string[];
    state: { destroyed: boolean; minimized: boolean; visible: boolean };
    handlers: Map<string, Array<(event?: unknown, ...args: unknown[]) => void>>;
    webContents: {
      send: (...args: unknown[]) => void;
      handlers: Map<string, Array<(event?: unknown, ...args: unknown[]) => void>>;
      [key: string]: unknown;
    };
    [key: string]: unknown;
  }
  return {
    windows: [] as RecordedWindow[],
    appHandlers: new Map<string, Array<(event: unknown, ...args: unknown[]) => void>>(),
    ipcOnHandlers: new Map<string, (...args: unknown[]) => unknown>(),
    logs: [] as unknown[][],
    deepLinkSends: [] as unknown[][],
    // M-WINDOWS-15: the user-visible failure surface. Recorded like every
    // other external effect of the drain.
    dialogCalls: [] as unknown[][],
    // M-WINDOWS-31: the button index the mocked dialog answers back with
    // (0 = first button = Accept, 1 = Cancel). Tests flip it per case.
    confirmResponse: 0
  };
});

function makeFakeWindow(): (typeof tracks.windows)[number] {
  const state = { destroyed: false, minimized: false, visible: false };
  const calls: string[] = [];
  const handlers = new Map<string, Array<(event?: unknown, ...args: unknown[]) => void>>();
  const wcHandlers = new Map<string, Array<(event?: unknown, ...args: unknown[]) => void>>();
  const win = {
    calls,
    state,
    handlers,
    isDestroyed: () => state.destroyed,
    isMinimized: () => state.minimized,
    isVisible: () => state.visible,
    restore: () => void calls.push('restore'),
    show: () => void calls.push('show'),
    focus: () => void calls.push('focus'),
    getBounds: () => ({ x: 0, y: 0, width: 1280, height: 870 }),
    isMaximized: () => false,
    maximize: vi.fn(),
    hide: vi.fn(),
    close: vi.fn(),
    setAlwaysOnTop: vi.fn(),
    isFullScreen: () => false,
    setFullScreen: vi.fn(),
    loadURL: vi.fn(),
    on: vi.fn((event: string, handler: (event?: unknown, ...args: unknown[]) => void) => {
      const list = handlers.get(event) ?? [];
      list.push(handler);
      handlers.set(event, list);
    }),
    once: vi.fn((event: string, handler: (event?: unknown, ...args: unknown[]) => void) => {
      const list = handlers.get(event) ?? [];
      list.push(handler);
      handlers.set(event, list);
    }),
    setThumbarButtons: vi.fn(),
    setProgressBar: vi.fn(),
    webContents: {
      handlers: wcHandlers,
      send: vi.fn((...args: unknown[]) => {
        if (args[0] === 'deeplink:open') tracks.deepLinkSends.push(args);
      }),
      setWindowOpenHandler: vi.fn(() => ({ action: 'deny' })),
      openDevTools: vi.fn(),
      on: vi.fn((event: string, handler: (event?: unknown, ...args: unknown[]) => void) => {
        const list = wcHandlers.get(event) ?? [];
        list.push(handler);
        wcHandlers.set(event, list);
      })
    }
  };
  return win;
}

// ---------------------------------------------------------------------------
// Mocks required before importing src/main/index
// ---------------------------------------------------------------------------
vi.mock('electron-log', () => ({
  default: {
    initialize: vi.fn(),
    info: vi.fn((...args: unknown[]) => void tracks.logs.push(args)),
    warn: vi.fn((...args: unknown[]) => void tracks.logs.push(args)),
    error: vi.fn((...args: unknown[]) => void tracks.logs.push(args)),
    debug: vi.fn()
  }
}));

vi.mock('electron-store', () => ({
  default: vi.fn(function () {
    return {
      get: vi.fn((_key: string, fallback?: unknown) => fallback ?? null),
      set: vi.fn()
    };
  })
}));

vi.mock('../../src/main/pathUtils', () => ({ isPathSafe: vi.fn(() => true) }));
// M-WINDOWS-34: extended stub set — index.ts now imports these too.
vi.mock('../../src/main/urlValidator', () => ({ validateExternalUrl: vi.fn(() => true), validateNavigationUrl: vi.fn(() => true), isFetchableApiBase: vi.fn(() => true) }));

vi.mock('electron-updater', () => ({
  autoUpdater: {
    on: vi.fn(),
    checkForUpdates: vi.fn(() => Promise.resolve()),
    downloadUpdate: vi.fn(),
    quitAndInstall: vi.fn(),
    autoDownload: false,
    autoInstallOnAppQuit: false
  }
}));

vi.mock('electron', () => {
  return {
    app: {
      getPath: vi.fn(() => '/tmp'),
      getVersion: vi.fn(() => '1.0.0'),
      getLocale: vi.fn(() => 'en'),
      isPackaged: false,
      whenReady: vi.fn(() => Promise.resolve()),
      quit: vi.fn(),
      setAsDefaultProtocolClient: vi.fn(),
      disableHardwareAcceleration: vi.fn(),
      on: vi.fn((event: string, handler: (event: unknown, ...args: unknown[]) => void) => {
        const list = tracks.appHandlers.get(event) ?? [];
        list.push(handler);
        tracks.appHandlers.set(event, list);
      }),
      once: vi.fn(),
      requestSingleInstanceLock: vi.fn(() => true)
    },
    // vitest@5: constructor mocks must be function/class (arrow impls are not newable).
    BrowserWindow: Object.assign(
      vi.fn(function () {
        const win = makeFakeWindow();
        tracks.windows.push(win);
        return win;
      }),
      { getAllWindows: vi.fn(() => []) }
    ),
    // M-WINDOWS-11: safeStorage stub (see autoUpdater.test.ts note) — the SUT
    // destructures it at module-eval; unavailable ⇒ disclosed plaintext fallback.
    // M-WINDOWS-29: the permission guard installs on defaultSession at
    // whenReady — the mock must expose it.
    session: { defaultSession: { setPermissionRequestHandler: vi.fn(), setPermissionCheckHandler: vi.fn() } },
    safeStorage: {
      isEncryptionAvailable: () => false,
      encryptString: () => {
        throw new Error('mock safeStorage');
      },
      decryptString: () => {
        throw new Error('mock safeStorage');
      }
    },
    ipcMain: {
      handle: vi.fn(),
      on: vi.fn((channel: string, handler: (...args: unknown[]) => unknown) => {
        tracks.ipcOnHandlers.set(channel, handler);
      })
    },
    protocol: { handle: vi.fn(), registerSchemesAsPrivileged: vi.fn() },
    shell: { openExternal: vi.fn() },
    nativeImage: {
      createFromPath: vi.fn(() => ({ isEmpty: vi.fn(() => false), resize: vi.fn(() => ({})) }))
    },
    Menu: {
      buildFromTemplate: vi.fn(() => ({})),
      setApplicationMenu: vi.fn()
    },
    Tray: vi.fn(function () {
      return {
        setToolTip: vi.fn(),
        setContextMenu: vi.fn(),
        isDestroyed: vi.fn(() => false),
        on: vi.fn()
      };
    }),
    dialog: {
      showOpenDialog: vi.fn(() => Promise.resolve({ canceled: true, filePaths: [] })),
      showMessageBox: vi.fn((...args: unknown[]) => {
        tracks.dialogCalls.push(args);
        return Promise.resolve({ response: tracks.confirmResponse });
      })
    },
    screen: {
      getAllDisplays: vi.fn(() => [{ bounds: { x: 0, y: 0, width: 1920, height: 1080 }, workArea: { x: 0, y: 0, width: 1920, height: 1040 } }])
    },
    powerSaveBlocker: { isStarted: vi.fn(() => false), start: vi.fn(() => 1), stop: vi.fn() },
    Notification: Object.assign(vi.fn(function () {
      return { on: vi.fn(), show: vi.fn() };
    }), { isSupported: vi.fn(() => true) })
  };
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function currentWindow(): (typeof tracks.windows)[number] {
  const win = tracks.windows[tracks.windows.length - 1];
  if (!win) {
    throw new Error('boot did not construct the main window fake — wiring is untestable');
  }
  return win;
}

/** The exact signal a booted renderer sends after subscribing 'deeplink:open'. */
function announceReadyFrom(win: (typeof tracks.windows)[number]): void {
  const handler = tracks.ipcOnHandlers.get('deeplink:ready');
  if (!handler) {
    throw new Error("main never registered ipcMain.on('deeplink:ready') — M-WINDOWS-06 cure is absent");
  }
  handler({ sender: win.webContents });
}

/** Second warm-process surface: argv handoff shares the one queue+drain. */
function enqueueViaSecondInstance(url: string): void {
  const handler = tracks.appHandlers.get('second-instance')?.[0];
  if (!handler) {
    throw new Error('second-instance handler missing');
  }
  handler({} as unknown, [url], '/tmp');
}

/** The confirm-gate dialogs (type:'question'), with their options object. */
function questionDialogOptions(): Array<Record<string, unknown>> {
  return tracks.dialogCalls
    .map((args) =>
      args.find((a) => typeof a === 'object' && a !== null && (a as { type?: string }).type === 'question') as
        | Record<string, unknown>
        | undefined
    )
    .filter((o): o is Record<string, unknown> => o !== undefined);
}

/** Let pending dialog promises (microtasks) settle. */
function tick(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

function fireWebContentsEvent(win: (typeof tracks.windows)[number], event: string): void {
  for (const handler of win.webContents.handlers.get(event) ?? []) {
    handler();
  }
}

function fireWindowEvent(win: (typeof tracks.windows)[number], event: string): void {
  for (const handler of win.handlers.get(event) ?? []) {
    handler({} as unknown);
  }
}

function sentPaths(): unknown[] {
  return tracks.deepLinkSends.map(([, path]) => path);
}

beforeAll(async () => {
  // True cold start: the phlix:// URL is already in process.argv when the
  // main module body evaluates (dynamic import — static imports would run
  // before we can plant the argv). Restoring argv afterwards is hygiene:
  // extractDeepLinkUrl already captured its value at module scope.
  const savedArgv = process.argv;
  process.argv = [savedArgv[0] ?? 'electron', 'phlix://media/cs-abc'];
  await import('../../src/main/index');
  process.argv = savedArgv;
  // Drain the whenReady().then(...) boot microtasks (createWindow et al).
  await new Promise((resolve) => setTimeout(resolve, 0));
});

describe('M-WINDOWS-06 event-driven deeplink drain', () => {
  it('cold-start link waits PAST the old 1000ms deadline and delivers exactly once on the handshake', async () => {
    // A phlix:// URL was already in process.argv at module evaluation — the
    // real cold-start arm. Nothing may have been sent yet: no handshake has
    // happened. This is the race made testable: the old code dispatched at
    // t≈1000ms regardless of readiness.
    expect(tracks.deepLinkSends).toEqual([]);
    await new Promise((resolve) => setTimeout(resolve, 1100));
    expect(tracks.deepLinkSends).toEqual([]);

    announceReadyFrom(currentWindow());

    // argv carried 'phlix://media/cs-abc' (set before the dynamic import).
    expect(tracks.deepLinkSends).toEqual([['deeplink:open', '/app/media/cs-abc']]);

    // And it stays a single delivery — repeat handshakes cannot re-send.
    announceReadyFrom(currentWindow());
    announceReadyFrom(currentWindow());
    expect(tracks.deepLinkSends).toEqual([['deeplink:open', '/app/media/cs-abc']]);
  });

  it('a warm app delivers on the same tick through the shared queue+drain (no second timer)', () => {
    tracks.deepLinkSends.length = 0;
    enqueueViaSecondInstance('phlix://play/p-1');
    expect(tracks.deepLinkSends).toEqual([['deeplink:open', '/app/player/p-1']]);
  });

  it('navigation drops readiness; a loaded-but-unsubscribed renderer (did-finish-load) must NOT deliver', () => {
    tracks.deepLinkSends.length = 0;
    const win = currentWindow();
    fireWebContentsEvent(win, 'did-start-loading'); // document swap incoming

    enqueueViaSecondInstance('phlix://media/m-2');
    expect(tracks.deepLinkSends).toEqual([]);

    // The load finished — but boot() still owes its IPC/HTTP awaits and has
    // not subscribed yet. Draining here would drop the link: precisely the
    // wrong-signal cure the brief rules out.
    fireWebContentsEvent(win, 'did-finish-load');
    fireWebContentsEvent(win, 'dom-ready');
    expect(tracks.deepLinkSends).toEqual([]);

    // The new document's real handshake delivers.
    announceReadyFrom(win);
    expect(tracks.deepLinkSends).toEqual([['deeplink:open', '/app/media/m-2']]);
  });

  it('an unknown webContents cannot drain (sender identity is checked)', () => {
    tracks.deepLinkSends.length = 0;
    const win = currentWindow();
    fireWebContentsEvent(win, 'did-start-loading');

    enqueueViaSecondInstance('phlix://media/m-3');

    tracks.ipcOnHandlers.get('deeplink:ready')!({ sender: { foreign: true } });
    expect(tracks.deepLinkSends).toEqual([]);

    // A log line names the refusal; the queue survived (proven next).
    announceReadyFrom(win);
    expect(tracks.deepLinkSends).toEqual([['deeplink:open', '/app/media/m-3']]);
  });

  it('window replaced: the queue survives the dead window and drains via the NEW window handshake', () => {
    tracks.deepLinkSends.length = 0;
    const oldWin = currentWindow();

    // Warm the receiver, then the window dies with a link still in flight.
    announceReadyFrom(oldWin);
    enqueueViaSecondInstance('phlix://server/s-9');
    expect(sentPaths()).toContain('/app/server/s-9');
    tracks.deepLinkSends.length = 0; // s-9 accounted for; watch only survivors

    // Close the old window; a fresh link then arrives with no live receiver.
    // The drain early-returns on isDestroyed (no shift), so the entry is
    // HELD — not sent, not lost.
    fireWindowEvent(oldWin, 'closed');
    enqueueViaSecondInstance('phlix://media/m-4');
    expect(tracks.deepLinkSends).toEqual([]); // held, not delivered, not dropped

    // macOS activate / re-creation path: no windows → createWindow again.
    const activate = tracks.appHandlers.get('activate')?.[0];
    expect(activate).toBeDefined();
    activate!({} as unknown);
    const newWin = currentWindow();
    expect(newWin).not.toBe(oldWin);

    // New renderer boots and announces → survivor + fresh link, FIFO, once.
    announceReadyFrom(newWin);
    expect(tracks.deepLinkSends).toEqual([
      ['deeplink:open', '/app/media/m-4']
    ]);
  });

  it('an unparsable link is consumed, not retried — the queue never gets poisoned', () => {
    tracks.deepLinkSends.length = 0;
    tracks.dialogCalls.length = 0;
    const win = currentWindow();
    announceReadyFrom(win); // warm (already true — re-drain of empty queue is a no-op)

    enqueueViaSecondInstance('phlix://bogus-host/x'); // unknown host → parse null
    expect(tracks.deepLinkSends).toEqual([]);

    // M-WINDOWS-15: unknown kinds surface HONESTLY — a log-only drop is the
    // silent no-op this review item's cure forbids. Exactly one dialog.
    expect(tracks.dialogCalls.length).toBe(1);

    // The next link still flows, proving the bad entry left the queue.
    tracks.dialogCalls.length = 0;
    enqueueViaSecondInstance('phlix://media/m-5');
    expect(tracks.deepLinkSends).toEqual([['deeplink:open', '/app/media/m-5']]);
    // A DELIVERED link must not trigger the failure dialog (fail-surface is
    // rejection-only; dialog spam on the happy path would be its own defect).
    expect(tracks.dialogCalls).toEqual([]);
  });

  it('M-WINDOWS-15 rejection dialog: one per drain for a burst, catalog copy, redaction-safe', () => {
    tracks.deepLinkSends.length = 0;
    tracks.dialogCalls.length = 0;
    const win = currentWindow();

    // Pause the receiver so all three links pile into ONE drain pass — the
    // burst shape (did-start-loading drops readiness; see the navigation test).
    fireWebContentsEvent(win, 'did-start-loading');

    // Malformed invite FIRST: its redacted form is the one the dialog shows,
    // proving the secret-bearing link is redacted on the user surface too.
    enqueueViaSecondInstance('phlix://accept-invite/bad$token!'); // TOKEN_PATTERN fail
    enqueueViaSecondInstance('phlix://bogus-host/y'); // unknown host
    enqueueViaSecondInstance('phlix://internal/not/app'); // non-/app path
    expect(tracks.dialogCalls).toEqual([]); // held, not yet drained

    announceReadyFrom(win);
    expect(tracks.deepLinkSends).toEqual([]); // nothing routable in the burst
    expect(tracks.dialogCalls.length).toBe(1); // ONE honest surface, no modal pile-up

    // Shape: (parentWindow, options) with type/title/message/detail from the
    // main-process catalog — the same dialog idiom as showServerTooOldDialog.
    const [parent, options] = tracks.dialogCalls[0] as [unknown, Record<string, string>];
    expect(parent).toBe(win);
    expect(options.type).toBe('warning');
    expect(options.title.length).toBeGreaterThan(0);
    expect(options.message.length).toBeGreaterThan(0);

    // Redaction law (W3): a malformed accept-invite candidate may still carry
    // a live secret — it must never reach the dialog text, and the redacted
    // form must be what the user sees.
    const allDialogText = tracks.dialogCalls
      .flatMap((call) => call.flatMap((arg) => Object.values(typeof arg === 'object' && arg !== null ? arg as Record<string, unknown> : [arg])))
      .map(String)
      .join('\n');
    expect(allDialogText).not.toContain('bad$token!');
    expect(allDialogText).toContain('[redacted]');
  });

  it('duplicate URLs inside the dedupe window deliver once, and every log line stays redacted', async () => {
    tracks.deepLinkSends.length = 0;
    tracks.logs.length = 0;
    tracks.dialogCalls.length = 0;
    tracks.confirmResponse = 0; // the mocked dialog answers 'Accept'
    const win = currentWindow();
    announceReadyFrom(win);

    const rawToken = 'RAWTOKEN-9eX-single-delivery';
    enqueueViaSecondInstance(`phlix://accept-invite/${rawToken}`);
    enqueueViaSecondInstance(`phlix://accept-invite/${rawToken}`);

    // M-WINDOWS-31: token-bearing links pass the confirm-before-consume gate;
    // the duplicate sits behind the (answered) pump and dedupes when reached.
    expect(questionDialogOptions().length).toBe(1);
    await tick();

    expect(tracks.deepLinkSends).toEqual([['deeplink:open', `/app/accept-invite/${rawToken}`]]);

    // W3/C17 redaction law: the token rides the IPC payload (the renderer
    // needs it) but must never appear in any main-process log line. The
    // suppression notice must carry the redacted form.
    const allLogged = tracks.logs.map((args) => args.map(String).join(' ')).join('\n');
    expect(allLogged).not.toContain(rawToken);
    expect(allLogged).toContain('[redacted]');
  });
});

describe('M-WINDOWS-31 confirm-before-consume on token-bearing links', () => {
  it('classifies ONLY the invite-acceptance route as consuming', () => {
    expect(requiresDeepLinkConfirmation('/app/accept-invite/anything')).toBe(true);
    expect(requiresDeepLinkConfirmation('/app/accept-invite')).toBe(true);
    expect(requiresDeepLinkConfirmation('/app/server/7')).toBe(false);
    expect(requiresDeepLinkConfirmation('/app/media/x')).toBe(false);
    expect(requiresDeepLinkConfirmation('/app/internal/settings')).toBe(false);
  });

  it('holds the accept-invite link until the user answers; forwards exactly once on Accept', async () => {
    tracks.deepLinkSends.length = 0;
    tracks.dialogCalls.length = 0;
    tracks.confirmResponse = 0;
    announceReadyFrom(currentWindow());

    enqueueViaSecondInstance('phlix://accept-invite/CONFIRM-OK-1');
    // Sync truth NOW: the question is up and the payload has NOT reached the renderer.
    expect(tracks.deepLinkSends).toEqual([]);
    expect(questionDialogOptions().length).toBe(1);

    await tick();
    expect(tracks.deepLinkSends).toEqual([['deeplink:open', '/app/accept-invite/CONFIRM-OK-1']]);
  });

  it('a declined link is never forwarded, and the question shows only the REDACTED form', async () => {
    tracks.deepLinkSends.length = 0;
    tracks.dialogCalls.length = 0;
    tracks.confirmResponse = 1; // user answers 'Cancel'
    announceReadyFrom(currentWindow());

    const secret = 'CONFIRM-DECLINE-secret';
    enqueueViaSecondInstance(`phlix://accept-invite/${secret}`);
    await tick();

    expect(tracks.deepLinkSends).toEqual([]);
    expect(questionDialogOptions().length).toBe(1);
    const dialogText = JSON.stringify(questionDialogOptions());
    expect(dialogText).not.toContain(secret); // raw one-time token must not ride a dialog string
    expect(dialogText).toContain('[redacted]');
  });

  it('non-consuming links still forward synchronously — no question on them', () => {
    tracks.deepLinkSends.length = 0;
    tracks.dialogCalls.length = 0;
    announceReadyFrom(currentWindow());

    enqueueViaSecondInstance('phlix://media/noc-1');
    expect(questionDialogOptions()).toHaveLength(0);
    expect(tracks.deepLinkSends).toEqual([['deeplink:open', '/app/media/noc-1']]);
  });

  it('the gate serializes: one question at a time, the queue drains behind each answer', async () => {
    tracks.deepLinkSends.length = 0;
    tracks.dialogCalls.length = 0;
    tracks.confirmResponse = 0;
    announceReadyFrom(currentWindow());

    enqueueViaSecondInstance('phlix://accept-invite/SER-1');
    enqueueViaSecondInstance('phlix://accept-invite/SER-2');
    // The second link must wait behind the first answer — no modal pile-up.
    expect(questionDialogOptions().length).toBe(1);

    await tick();
    expect(questionDialogOptions().length).toBe(2);
    await tick();
    expect(tracks.deepLinkSends).toEqual([
      ['deeplink:open', '/app/accept-invite/SER-1'],
      ['deeplink:open', '/app/accept-invite/SER-2']
    ]);
  });
});
