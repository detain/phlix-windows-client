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
    // The 'default' sentinel models the KEYBOARD default: the mock answers
    // with the dialog's OWN defaultId — exactly what a plain Enter press
    // returns (windows__exploiter 5[i]).
    confirmResponse: 0 as number | 'default'
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
    setBounds: vi.fn(),
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
vi.mock('../../src/main/urlValidator', () => ({ validateExternalUrl: vi.fn(() => true), validateNavigationUrl: vi.fn(() => true), isFetchableApiBase: vi.fn(() => true), summarizeUrlForLog: vi.fn((u: unknown) => String(u)), scrubErrorForLog: vi.fn((e: unknown) => String(e)) }));

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
    // M8 batch 10: index.ts imports powerMonitor — partial electron mocks
    // make the named import throw at boot (exit-7 class, see batch 6).
    powerMonitor: { on: vi.fn() },
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
    session: { defaultSession: { on: vi.fn(), setPermissionRequestHandler: vi.fn(), setPermissionCheckHandler: vi.fn() } },
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
        // 'default' answers with the dialog's own defaultId — the Enter-key
        // result — so the keyboard default is exercised, not assumed (w08/L2).
        const response =
          tracks.confirmResponse === 'default'
            ? ((args.find(
                (a) =>
                  typeof a === 'object' &&
                  a !== null &&
                  (a as { type?: string }).type === 'question'
              ) as { defaultId?: number } | undefined)?.defaultId ?? 0)
            : tracks.confirmResponse;
        return Promise.resolve({ response });
      })
    },
    screen: {
      getAllDisplays: vi.fn(() => [{ bounds: { x: 0, y: 0, width: 1920, height: 1080 }, workArea: { x: 0, y: 0, width: 1920, height: 1040 } }]),
      getPrimaryDisplay: vi.fn(() => ({ bounds: { x: 0, y: 0, width: 1920, height: 1080 }, workArea: { x: 0, y: 0, width: 1920, height: 1040 } }))
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

  it('an encoded-spelling invite link that fails parse still redacts on the rejection dialog (REVIEW-w09L2windows-ff2 Minor)', () => {
    // Same fail-toward-totality law one level up: 'Accept%2DInvite' is not a
    // known host, so the pump rejects it — and the rejection dialog quotes the
    // REDACTED link. If the redactor's fold misses the encoding, the raw
    // one-time token rides the dialog text (red on landing 83e9a416: the
    // segment-exact case-fold never sees through %2D).
    tracks.deepLinkSends.length = 0;
    tracks.dialogCalls.length = 0;
    const win = currentWindow();
    announceReadyFrom(win); // warm receiver — the rejection surfaces on enqueue

    const secret = 'FF2PUMP-SECRET-9';
    enqueueViaSecondInstance(`phlix://Accept%2DInvite/${secret}`);
    expect(tracks.deepLinkSends).toEqual([]); // parse rejected — nothing forwards
    expect(tracks.dialogCalls.length).toBe(1);

    const dialogText = JSON.stringify(tracks.dialogCalls);
    expect(dialogText).not.toContain(secret);
    expect(dialogText).toContain('[redacted]');
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

  it('classifies letter-case variants of the invite route as consuming too', () => {
    // REVIEW-w09L2windows MAJOR (pre-existing class): the renderer's
    // vue-router resolves route records CASE-INSENSITIVELY — the review lane
    // executed '/app/Accept-Invite/T' → name 'accept-invite', params.token
    // 'T' (probe re-run by this lane: every letter-case spelling resolves;
    // percent spellings like %2D fall to the 404 catch-all, never to the
    // record). Exact-case classification therefore let a mere letter-case
    // spelling skip this consent gate and burn the one-time secret ungated.
    // The gate now canonicalizes its COMPARISON; the path itself keeps case
    // because the base64url token is case-sensitive.
    expect(requiresDeepLinkConfirmation('/app/Accept-Invite/anything')).toBe(true);
    expect(requiresDeepLinkConfirmation('/app/ACCEPT-INVITE')).toBe(true);
    expect(requiresDeepLinkConfirmation('/App/Accept-Invite/x')).toBe(true);
    // No widening for spellings the router cannot reach anyway:
    expect(requiresDeepLinkConfirmation('/app/accept%2Dinvite/x')).toBe(false);
    expect(requiresDeepLinkConfirmation('/app/Accept-Invite-x')).toBe(false);
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

  it('a case-variant invite link parks at the dialog too — never forwards ungated', async () => {
    // REVIEW-w09L2windows MAJOR: the internal arm emits its path case-
    // preserved, the exact-case gate missed '/app/Accept-Invite/…', and the
    // case-insensitive renderer router consumed the secret with no dialog.
    // RED on landing: the payload reaches the renderer synchronously and no
    // question ever appears.
    tracks.deepLinkSends.length = 0;
    tracks.dialogCalls.length = 0;
    tracks.confirmResponse = 1; // decline
    announceReadyFrom(currentWindow());

    enqueueViaSecondInstance('phlix://internal/app/Accept-Invite/CASEVAR-decline-1');
    expect(tracks.deepLinkSends, 'case variant must not forward ungated').toEqual([]);
    expect(questionDialogOptions().length).toBe(1);

    await tick();
    expect(tracks.deepLinkSends, 'a declined case variant is never forwarded').toEqual([]);

    // And when ACCEPTED, the original case must survive into the IPC payload:
    // the base64url token is case-sensitive, so the fold may not touch it.
    tracks.dialogCalls.length = 0;
    tracks.confirmResponse = 0;
    enqueueViaSecondInstance('phlix://internal/app/Accept-Invite/CASEVAR-ok-2');
    await tick();
    expect(tracks.deepLinkSends).toEqual([['deeplink:open', '/app/Accept-Invite/CASEVAR-ok-2']]);
  });

  it('Enter answers the REJECT arm — a key-mash never burns the one-time secret', async () => {
    // windows__exploiter 5[i] (w08/L2): with defaultId 0 the ACCEPT button
    // owned the keyboard default — Enter (or a muscle-memoried key-mash)
    // silently consumed a one-time invite token, while only mouse-holding
    // Cancel declined. The inert arm must own both keyboard exits, and the
    // law is behavioral: answering with the dialog's own defaultId forwards
    // nothing. RED at the parent shape (defaultId 0 → Enter forwards).
    tracks.deepLinkSends.length = 0;
    tracks.dialogCalls.length = 0;
    tracks.confirmResponse = 'default'; // the mock answers with the recorded defaultId
    announceReadyFrom(currentWindow());

    enqueueViaSecondInstance('phlix://accept-invite/DEFDEF-1');
    const options = questionDialogOptions()[0] as {
      buttons: unknown[];
      defaultId: number;
      cancelId: number;
      title: string;
    };
    expect(options.buttons).toHaveLength(2);
    expect(options.defaultId, 'the inert arm owns the keyboard default').toBe(1);
    expect(options.cancelId, 'Esc posture unchanged').toBe(1);
    // windows__gameux 1[m] (MW-086): a consent surface may not wear the
    // failure title — 'Could Not Open Link' belongs exclusively to the
    // rejected-dialog path. Red on the parent (title was failedTitle).
    expect(options.title, 'confirm dialog carries its own consent title').toBe('Open this link?');

    await tick();
    expect(tracks.deepLinkSends, 'Enter must not forward a secret-consuming link').toEqual([]);

    // Explicit Accept stays one keypress away, not zero: an arrow-key move
    // onto button 0 (the mocked answer 0) still forwards, once.
    tracks.confirmResponse = 0;
    enqueueViaSecondInstance('phlix://accept-invite/DEFDEF-2');
    await tick();
    expect(tracks.deepLinkSends).toEqual([['deeplink:open', '/app/accept-invite/DEFDEF-2']]);
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

// ---------------------------------------------------------------------------
// MW-121 [review windows__exploiter 3 — card w14/L4]: flood discipline.
//
// Defect: the pending queue was unbounded and every parsed invite parked a
// question dialog. A protocol-launch flood of DISTINCT accept-invite links
// (dedup only catches byte-identical URLs in a 2000ms window) therefore
// produced one modal confirm per entry — sustained lockup of the main
// window, plus unbounded queue memory while the pump parked behind them.
//
// Cure (three parts, all pinned here): (a) MAX_PENDING_DEEPLINKS entry cap —
// overflow is dropped at the door, redacted-logged, and surfaced ONCE;
// (b) a bounded delivery gate (createToastThrottle idiom) in front of the
// confirm — the CONFIRM DIALOG IS the attacked resource, so a link gets a
// question only while grants remain; (c) drop classes (rate/overflow) share
// one honest surface per window instead of one per drain.
//
// Clock law: the existing file runs on REAL timers because no timer may
// exist on the drain path; these tests additionally MOCK Date.now (the
// gate + dedup read it) so grant math is deterministic. Each test picks a
// base far ahead of real wall time, and tests are ≥600s apart in mock
// terms, so every window is independent — and no later real-clock test
// exists behind us (this describe is last). Grant state is per-vitest-file
// module instance; other files are unaffected.
// ---------------------------------------------------------------------------
describe('MW-121 — flood discipline: cap, delivery gate, one honest surface', () => {
  const GATE_LIMIT = 30; // mirror of deepLinkDeliveryGate in src/main/index.ts
  const QUEUE_CAP = 32; // mirror of MAX_PENDING_DEEPLINKS
  const T0 = Date.now(); // captured at collection, before any spy exists

  function warningOptions(): Array<Record<string, unknown>> {
    return tracks.dialogCalls
      .map((args) =>
        args.find((a) => typeof a === 'object' && a !== null && (a as { type?: string }).type === 'warning') as
          | Record<string, unknown>
          | undefined
      )
      .filter((o): o is Record<string, unknown> => o !== undefined);
  }

  async function runFlood<T>(baseOffsetMs: number, body: (clock: { now: number }) => Promise<T>): Promise<T> {
    const clock = { now: T0 + baseOffsetMs };
    const spy = vi.spyOn(Date, 'now').mockImplementation(() => clock.now);
    try {
      const result = await body(clock);
      await tick(); // let the pump settle its tail before the clock returns
      return result;
    } finally {
      spy.mockRestore();
    }
  }

  it('warm invite flood: at most GATE_LIMIT question dialogs, none beyond it', async () => {
    tracks.deepLinkSends.length = 0;
    tracks.dialogCalls.length = 0;
    tracks.logs.length = 0;
    tracks.confirmResponse = 1; // decline every confirm — the flood never forwards
    announceReadyFrom(currentWindow());

    await runFlood(600_000, async () => {
      for (let i = 0; i < 200; i++) {
        enqueueViaSecondInstance(`phlix://accept-invite/FLOOD1tok${i}`);
      }
    });

    const confirms = questionDialogOptions().length;
    expect(confirms, 'the delivery gate must cap question dialogs per window').toBeLessThanOrEqual(GATE_LIMIT);
    expect(confirms, 'a grant-less flood would confirm nothing at all — drive it').toBeGreaterThan(0);
    expect(tracks.deepLinkSends, 'declined invites never forward').toEqual([]);
    expect(warningOptions().length, 'drop class gets ONE honest surface per window').toBeLessThanOrEqual(1);
  });

  it('cold flood: queue holds at most QUEUE_CAP, every excess entry is redacted-logged as dropped', async () => {
    tracks.deepLinkSends.length = 0;
    tracks.dialogCalls.length = 0;
    tracks.logs.length = 0;
    announceReadyFrom(currentWindow());
    fireWebContentsEvent(currentWindow(), 'did-start-loading'); // pause the receiver

    await runFlood(1_200_000, async () => {
      for (let i = 0; i < 200; i++) {
        enqueueViaSecondInstance(`phlix://media/coldflood-${i}`);
      }
      announceReadyFrom(currentWindow()); // the cold-start handshake releases the bounded queue
    });

    const allLogs = JSON.stringify(tracks.logs);
    const dropLines = (allLogs.match(/queue full/g) ?? []).length;
    expect(dropLines, 'exactly the over-cap entries are dropped at the door').toBe(200 - QUEUE_CAP);
    expect(tracks.deepLinkSends.length, 'the held window still gets its bounded delivery').toBeLessThanOrEqual(GATE_LIMIT);
    expect(tracks.deepLinkSends.length).toBeGreaterThan(0);
    // Redaction law at the NEW drop surface: media ids are not secrets, but
    // the cap line shares the redact helper with invite traffic — assert the
    // helper is what prints it by shape, and no raw-argv dump exists.
    expect(allLogs).toContain('[deeplink]');
    expect(warningOptions().length).toBeLessThanOrEqual(1);
  });

  it('malformed invite flood: secrets never surface — held ≤ cap, overflow surfaced once, all redacted', async () => {
    tracks.deepLinkSends.length = 0;
    tracks.dialogCalls.length = 0;
    tracks.logs.length = 0;
    tracks.confirmResponse = 0;
    announceReadyFrom(currentWindow());
    fireWebContentsEvent(currentWindow(), 'did-start-loading');

    await runFlood(1_800_000, async () => {
      for (let i = 0; i < 40; i++) {
        enqueueViaSecondInstance(`phlix://accept-invite/SEKRITtok3n!!broken${i}`);
      }
      announceReadyFrom(currentWindow()); // release the drain
    });

    const surface = JSON.stringify(tracks.dialogCalls) + JSON.stringify(tracks.logs);
    expect(surface, 'a malformed invite may still carry a live secret — nothing raw leaves').not.toContain('SEKRITtok3n');
    const warns = warningOptions();
    expect(warns.length, 'parse-rejection keeps its one-per-drain surface; drop classes add ≤1').toBeLessThanOrEqual(2);
    expect(
      warns.some((o) => String(o.detail ?? '').includes('[redacted]')),
      'the visible detail is the redacted form'
    ).toBe(true);
    const dropLines = (JSON.stringify(tracks.logs).match(/queue full/g) ?? []).length;
    expect(dropLines, 'only the over-cap tail (40-32) is door-dropped').toBe(8);
  });

  it('gate window expiry refills delivery — the bound throttles floods, never one-off links', async () => {
    tracks.deepLinkSends.length = 0;
    tracks.dialogCalls.length = 0;
    announceReadyFrom(currentWindow());

    await runFlood(2_400_000, async (clock) => {
      for (let i = 0; i < 100; i++) {
        enqueueViaSecondInstance(`phlix://media/refill-${i}`);
      }
      const capped = tracks.deepLinkSends.length;
      clock.now += 60_001; // past the gate window: a lone later link is not part of any flood
      enqueueViaSecondInstance('phlix://media/refill-after-window');
      return capped;
    });

    expect(tracks.deepLinkSends.length).toBeLessThanOrEqual(GATE_LIMIT + 1);
    expect(sentPaths()).toContain('/app/media/refill-after-window');
  });
});
