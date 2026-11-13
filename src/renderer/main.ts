/**
 * Phlix Media Server Client for Windows.
 *
 * @copyright 2026 Joe Huss <detain@interserver.net>
 */

import type { MenuItem, PhlixAppConfig } from '@phlix/ui';
import type { RouteRecordRaw } from 'vue-router';
import {
  createPhlixApp,
  buildAdminRoutes,
  buildHubAdminRoutes,
  LibraryScanPage,
  MyServersPage,
  FederationPage,
  ManageSharesPage,
  SharedWithMePage,
  InviteLinksPage,
  AcceptInvitePage,
  FederationSharesPage,
  ServerDetailPage
} from '@phlix/ui';
import { buildPhlixHeaders } from '@phlix/contracts';
import '@phlix/ui/style.css';
import '@phlix/ui/fonts.css';
import { resolveAppConfig } from './resolveConfig';
// m20: same module the main process uses for its redaction law — it depends
// only on electron-log, so importing it into the renderer bundle is safe.
import { summarizeUrlForLog } from '../main/urlValidator';
import { messagesForLocale, resolveLocale } from './i18n';
import { setWindowLocale, tWin } from './i18n/windows-own';
import log from 'electron-log';
import { installElectronBridge } from './electronBridge';
import { setOverlayShared } from './overlayShared';
import { applyFailureScreenContainer, setRecoveryBusy, styleRecoveryButton } from './bootScreenStyle';
import { SafeStorageTokenStore } from './safeStorageTokenStore';
// M-WINDOWS-35: the shell's second SMTC installer import was removed here —
// transport ownership belongs to the vendored @phlix/ui player store;
// see the ./mediaSession header.

/** Module-level cleanup references — cleared after each run to support re-boot. */
let _cleanupBridge: (() => void) | null = null;
let _cleanupDeeplink: (() => void) | null = null;

/**
 * Runs all registered renderer teardown functions (bridge, deeplink listeners).
 * Safe to call multiple times; each cleanup is nullified after running.
 */
function cleanupRenderer(): void {
  _cleanupBridge?.();
  _cleanupBridge = null;
  _cleanupDeeplink?.();
  _cleanupDeeplink = null;
}

/** True once ./overlay has been imported (its module-load mount ran for that boot). */
let overlayLoaded = false;

// WIN-38: teardown hooks live at MODULE scope, registered once. Registering
// them inside boot() stacked a fresh beforeunload listener / HMR dispose per
// (re-)boot, so cleanupRenderer ran N times on unload.
// HMR dispose: clean up all renderer resources before Vite replaces the module.
import.meta.hot?.dispose(() => {
  cleanupRenderer();
});
// beforeunload mirrors it for non-HMR refreshes/navigation. Guard with typeof
// to support test environments that don't provide addEventListener.
if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
  window.addEventListener('beforeunload', () => {
    cleanupRenderer();
  });
}

/** The boot-time config this renderer hands to createPhlixApp (typed alias for the mirror below). */
type BootConfig = PhlixAppConfig;

/**
 * M4 (review remediation — windows exploiter #1 / crossfe #1 / secnet M1):
 * the plaintext token custody rows the vendored `@phlix/ui`
 * LocalStorageTokenStore writes. Key spellings measured at the pinned
 * v0.99.13 peel: `src/api/tokenStore.ts` uses these BARE localStorage keys.
 */
const PLAIN_TOKEN_KEYS = ['access_token', 'refresh_token', 'user'] as const;

/**
 * Builds the DPAPI-backed token store when the M-WINDOWS-11 vault bridge is
 * live. A missing/failed bridge never aborts boot: custody simply stays on the
 * vendored default (browser-dev posture), logged loudly.
 */
function createVaultTokenStore(api: Window['electronAPI'] | undefined): SafeStorageTokenStore | null {
  if (!api) {
    return null;
  }
  try {
    return new SafeStorageTokenStore(api);
  } catch {
    log.warn('[Phlix] Vault bridge unavailable — auth tokens stay in the vendored default store');
    return null;
  }
}

/**
 * Moves one pre-vault plaintext row into sealed custody and clears the
 * plaintext — but ONLY after the sealed value is confirmed by a read-back
 * (or the vault already held a value, which wins over the stale plaintext).
 * An unconfirmable seal preserves the row rather than orphaning the session;
 * the next boot retries.
 */
function foldOneTokenKey(
  plainKey: (typeof PLAIN_TOKEN_KEYS)[number],
  readVault: () => unknown,
  writeVault: (raw: string) => void
): void {
  let plain: string | null = null;
  try {
    plain = localStorage.getItem(plainKey);
  } catch {
    return;
  }
  if (plain === null) {
    return;
  }
  try {
    if (readVault() == null) {
      writeVault(plain);
      if (readVault() == null) {
        log.warn(`[Phlix] Vault seal for "${plainKey}" could not be confirmed; plaintext row preserved`);
        return;
      }
    }
    localStorage.removeItem(plainKey);
  } catch {
    // Corrupt row / failing bridge — folding must never crash boot.
    log.warn(`[Phlix] Token fold skipped for "${plainKey}"`);
  }
}

/** Folds all three plaintext token rows into the vault (upgrade path for pre-M4 installs). */
function foldPlaintextTokensToVault(store: SafeStorageTokenStore): void {
  // Indexed (not literal) so PLAIN_TOKEN_KEYS stays the single source: if a
  // key spelling ever moves, the union type and the fold update together.
  foldOneTokenKey(PLAIN_TOKEN_KEYS[0], () => store.getAccessToken(), (v) => store.setAccessToken(v));
  foldOneTokenKey(PLAIN_TOKEN_KEYS[1], () => store.getRefreshToken(), (v) => store.setRefreshToken(v));
  foldOneTokenKey(PLAIN_TOKEN_KEYS[2], () => store.getUser(), (v) => store.setUser(JSON.parse(v)));
}

declare global {
  interface Window {
    /**
     * Written by boot() in SERVER mode before createPhlixApp runs: a verbatim
     * mirror of the boot config (so the upstream readConfig() spread stays
     * byte-identical) carrying the live SyncPlay socket hint. Upstream reads
     * this global at EVERY dial (src/api/socketHint.ts at the pinned peel),
     * which is why connection changes rewrite it instead of needing a remount.
     */
    __PHLIX__?: PhlixAppConfig;
  }
}

/**
 * M-WINDOWS-04 rider, second leg (tag-wave C4, @phlix/ui v0.99.12): derive
 * the `ws(s)://<serverHost>:8097` socket hint from the effective server base.
 *
 * Upstream contract: the vendored SyncPlay client prefers a valid
 * `window.__PHLIX__.wsUrl` (grammar /^wss?:\/\/[^/?#@]+$/i — no path, query
 * or userinfo) over ALL same-origin derivations. A browser tab gets that host
 * for free from its own origin; the app:// desktop renderer sees origin
 * hostname '-' with no :8097 to read — precisely why M-WINDOWS-04 withheld
 * the surface. The connected server URL is the desktop's only authoritative
 * source for the media server's host, so flip its scheme (https→wss, http→ws)
 * and pin :8097 — the same estate port law the web fallback applies
 * regardless of page or server port. No wsPath: the direct :8097 socket
 * carries no path prefix (that seam is for the hub relay only).
 *
 * Fail-soft by design: null or unparseable input yields null, which
 * socketHint treats as NO_HINT — the vendored dial stays byte-identical to
 * every pre-seam build.
 */
export function deriveSyncPlayWsUrl(serverBase: string | null): string | null {
  if (!serverBase) return null;
  try {
    const url = new URL(serverBase);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
    return `${url.protocol === 'https:' ? 'wss' : 'ws'}://${url.hostname}:8097`;
  } catch {
    return null;
  }
}

/**
 * Top-bar nav for the current app mode. Mirrors the server and hub web-uis so the
 * desktop client gets the same surfaces — crucially the gated "Admin" entry,
 * which the shell shows only for an authenticated admin (`useAuthStore().isAdmin`).
 * Without a supplied `menu` the shell renders NO nav at all (no Browse/Admin), so
 * this is what makes the admin section reachable in the Windows client.
 *
 * Labels come from the windows-own catalog (`tWin`) — raw `MenuItem.label`
 * strings the ui message seam cannot reach — in the locale `setWindowLocale()`
 * activated at boot (default English, byte-identical to the pre-i18n labels;
 * tests/unit/i18nLocales.test.ts pins that).
 */
export function buildMenu(appMode: 'server' | 'hub'): MenuItem[] {
  if (appMode === 'hub') {
    return [
      { id: 'my-servers', label: tWin('nav.myServers'), to: '/app/servers' },
      { id: 'federation', label: tWin('nav.federation'), to: '/app/federation' },
      { id: 'manage-shares', label: tWin('nav.shares'), to: '/app/shares' },
      { id: 'shared-with-me', label: tWin('nav.sharedWithMe'), to: '/app/shared' },
      { id: 'invite-links', label: tWin('nav.inviteLinks'), to: '/app/invites' },
      { id: 'history', label: tWin('nav.history'), to: '/app/history' },
      { id: 'explore', label: tWin('nav.explore'), to: '/app/explore' },
      { id: 'recommendations', label: tWin('nav.recommendations'), to: '/app/recommendations' },
      { id: 'admin', label: tWin('nav.admin'), to: '/app/admin/dashboard', requiresAdmin: true }
    ];
  }
  // Server mode: mirrors web-ui/src/main.ts:30-77 entry for entry, plus the
  // desktop SyncPlay entry below it (measured: that web-ui nav carries no
  // syncplay item — the web player reaches rooms through its own chrome).
  // `libraryLinks` expands Browse into one nav link per library (fetched from
  // /api/v1/libraries), matching the per-library Browse sections.
  // `requiresLibraryType` hides each media-type entry unless a library of that
  // type exists — fail-closed while the library list is still loading.
  return [
    { id: 'browse', label: tWin('nav.browse'), to: '/app', libraryLinks: true },
    { id: 'music', label: tWin('nav.music'), to: '/app/music', requiresLibraryType: 'music' },
    { id: 'books', label: tWin('nav.books'), to: '/app/books', requiresLibraryType: 'book' },
    { id: 'audiobooks', label: tWin('nav.audiobooks'), to: '/app/audiobooks', requiresLibraryType: 'audiobook' },
    { id: 'photos', label: tWin('nav.photos'), to: '/app/photo/albums', requiresLibraryType: 'photo' },
    { id: 'search', label: tWin('nav.search'), to: '/app/search' },
    { id: 'history', label: tWin('nav.history'), to: '/app/history' },
    { id: 'explore', label: tWin('nav.explore'), to: '/app/explore' },
    { id: 'recommendations', label: tWin('nav.recommendations'), to: '/app/recommendations' },
    // M-WINDOWS-04 rider, second leg (v0.99.12 wave): the vendored shell
    // registers /app/syncplay and boot() now feeds the wsUrl socket hint the
    // app:// origin could never derive — the surface is LIVE in server mode.
    // Hub mode deliberately has NO entry: its transport runs the :8804 hub
    // relay, and the same wsUrl seam overrides relay dials wholesale
    // (hubRelay.ts) — surfacing a watch party there needs relay-aware
    // evidence first (rider leg 4).
    { id: 'syncplay', label: tWin('nav.syncPlay'), to: '/app/syncplay' },
    { id: 'settings', label: tWin('nav.settings'), to: '/app/settings' },
    { id: 'admin', label: tWin('nav.admin'), to: '/app/admin/dashboard', requiresAdmin: true }
  ];
}

/**
 * Extra routes for the current app mode: the shared admin section (`/app/admin/*`,
 * reachable via the gated "Admin" nav entry) plus mode-specific pages. In hub mode
 * this includes MyServersPage (`/app/servers`), ServerDetailPage (`/app/server/:id`),
 * FederationPage (`/app/federation`), FederationSharesPage (`/app/federation/shares`),
 * ManageSharesPage (`/app/shares`), SharedWithMePage (`/app/shared`), InviteLinksPage
 * (`/app/invites`), AcceptInvitePage (`/app/accept-invite/:token` — deep-link
 * only, no nav entry; the token arrives as a route prop because the vendored
 * component declares a `token` prop), and the hub-admin section. Server mode
 * adds LibraryScanPage.
 * Mirrors the server/hub web-uis. Routes carry the full `/app` prefix (history base is '/').
 */
export function buildExtraRoutes(appMode: 'server' | 'hub'): RouteRecordRaw[] {
  if (appMode === 'hub') {
    return [
      { path: '/app/servers', name: 'my-servers', component: MyServersPage },
      { path: '/app/server/:id', name: 'server-detail', component: ServerDetailPage },
      { path: '/app/federation', name: 'federation', component: FederationPage },
      { path: '/app/federation/shares', name: 'federation-shares', component: FederationSharesPage },
      { path: '/app/shares', name: 'manage-shares', component: ManageSharesPage },
      { path: '/app/shared', name: 'shared-with-me', component: SharedWithMePage },
      { path: '/app/invites', name: 'invite-links', component: InviteLinksPage },
      { path: '/app/accept-invite/:token', name: 'accept-invite', props: true, component: AcceptInvitePage },
      ...buildHubAdminRoutes()
    ];
  }
  return [
    ...buildAdminRoutes(),
    {
      // ADMIN-ONLY (estate L-4 follow-up, mirrors server web-ui 114c9aaf).
      // /api/v1/libraries strips absolute-fs `paths` for non-admins, and the
      // scan surface is operator-facing — the vendored @phlix/ui authGuard
      // (wa() in createPhlixApp.ts) checks `to.meta?.requiresAdmin === true`:
      // a logged-in non-admin bounces to browse pre-render, an anonymous
      // visitor gets login. The marker must equal the admin section routes'
      // own meta — pinned in tests/unit/library-scan-route.test.ts.
      path: '/app/library/scan',
      name: 'library-scan',
      meta: { requiresAdmin: true },
      component: LibraryScanPage
    }
  ];
}

/**
 * The boot-time version gate's verdict, derived from the bridge type itself —
 * a second hand-written declaration could drift; this cannot (electron.d.ts is
 * the renderer-side source of truth, mirroring src/main/versionCheck.ts).
 */
type ServerVersionCheckResult = Awaited<ReturnType<NonNullable<typeof window.electronAPI>['checkServerVersion']>>;

/**
 * M-WINDOWS-02: persistent user-facing screen for the version gate's ONE
 * blocking verdict (server explicitly reports a version below the minimum).
 * Before this cure the too-old outcome was a log-only boot abort — the window
 * was already shown, nothing mounted into it, and the user stared at a dark
 * empty frame forever with zero explanation.
 *
 * M-WINDOWS-16 (review windows__gameux): completes that cure's missing arm —
 * the screen was dialog + copy + versions but the only remediation was the
 * copy's "restart this app" ceremony. The Retry button re-runs the SAME check
 * (the gate verdict/policy is untouched — this is rendering, not enforcement)
 * and either resumes the boot in place when the server was updated meanwhile,
 * or re-renders with the freshest verdict. r1 noted that claim as unsupported
 * for a fourth outcome (a resumed boot() rejecting left the clicked button
 * disabled forever); r2 caught it — so the law now holds by construction:
 * every outcome that leaves this screen visible leaves its Retry live, and
 * every outcome that replaces the screen replaces it with a working surface.
 *
 * Every string goes through textContent (NEVER innerHTML): the server-reported
 * version is network input and must never be parsed as HTML. The windows-own
 * catalog has no interpolation seam (its documented YAGNI law), so the dynamic
 * values render as separate label + value rows.
 */
function renderIncompatibleServerScreen(
  result: ServerVersionCheckResult,
  retryCheck: () => Promise<ServerVersionCheckResult>
): void {
  const container = document.getElementById('phlix-app') ?? document.body;
  // M-WINDOWS-01: this screen renders in place of mounting, so nothing else
  // will retire the pre-JS boot splash — remove it here or it covers the
  // incompatibility message forever.
  document.getElementById('boot-splash')?.remove();
  document.title = tWin('boot.incompatibleTitle');
  applyFailureScreenContainer(container);

  const box = document.createElement('div');
  box.setAttribute('role', 'alert');

  const heading = document.createElement('h1');
  heading.textContent = tWin('boot.incompatibleTitle');
  heading.setAttribute('style', 'font-size:22px;margin:0 0 12px;');

  const intro = document.createElement('p');
  intro.textContent = tWin('boot.incompatibleIntro');
  intro.setAttribute('style', 'font-size:15px;margin:0 0 20px;');

  const action = document.createElement('p');
  action.textContent = tWin('boot.incompatibleAction');
  action.setAttribute('style', 'font-size:14px;margin:20px 0 0;opacity:0.85;');

  const versionRow = (label: string, value: string): HTMLParagraphElement => {
    const row = document.createElement('p');
    row.setAttribute('style', 'font-size:14px;margin:0 0 6px;');
    const strong = document.createElement('strong');
    strong.textContent = label;
    const span = document.createElement('span');
    span.textContent = ` ${value}`;
    row.appendChild(strong);
    row.appendChild(span);
    return row;
  };

  box.appendChild(heading);
  box.appendChild(intro);
  box.appendChild(versionRow(`${tWin('boot.reportedVersion')}:`, result.serverVersion ?? 'unknown'));
  box.appendChild(versionRow(`${tWin('boot.requiredVersion')}:`, result.minimumVersion));
  box.appendChild(action);

  const retryButton = document.createElement('button');
  retryButton.type = 'button';
  retryButton.textContent = tWin('boot.incompatibleRetry');
  retryButton.style.margin = '24px auto 0';
  styleRecoveryButton(retryButton, 'primary');
  retryButton.addEventListener('click', () => {
    // One attempt in flight at a time; the re-render path re-arms a fresh button.
    setRecoveryBusy(retryButton, true, tWin('boot.checking'));
    // MW-119 fold (w13L10 review minor #3): the Change arm already silences
    // the WHOLE row in flight (shared boot pipeline — a Change click during
    // a Retry-driven boot() could race a second mount); Retry must honor the
    // same law in the other direction. TDZ is safe: this closure only runs
    // after changeButton is declared below.
    setRecoveryBusy(changeButton, true);
    void retryCheck().then(
      (next) => {
        if (next.compatible) {
          // The gate opened while the screen was up (server updated, URL
          // corrected). The aborted boot installed NOTHING — no Vue app, no
          // bridge, no deeplink listener — so re-running boot() from scratch
          // is safe: it re-reads config, re-checks (passes now) and mounts
          // into the same #phlix-app container, replacing this screen.
          //
          // M-WINDOWS-16 r2 (review windows__gameux MINOR-1): that resumed
          // boot() can itself reject BEFORE it owns the window — its fail-fast
          // config IPC (a DPAPI custody failure, say) throws out of the
          // awaiting boot(). Discarded with `void`, the rejection stranded
          // this clicked button permanently disabled on a stale screen.
          // Catching and re-arming makes the surface law true by construction.
          boot().catch((err: unknown) => {
            log.error('[Boot] Resumed boot failed:', err);
            // Only a surface still in the document can be re-armed: once
            // boot() reached mounting, the app owns the window even if the
            // mount then threw, and this off-document button is no longer the
            // user's reality (a stale "too old" re-render would be a lie —
            // the verdict in hand is compatible).
            if (retryButton.isConnected) {
              setRecoveryBusy(retryButton, false);
              // MW-119 fold: the pair was muzzled together — it returns
              // together (each button only ever touches a still-live one).
              if (changeButton.isConnected) {
                setRecoveryBusy(changeButton, false);
              }
            }
          });
        } else {
          // Still too old: re-render with the freshest verdict. The new
          // screen carries its own Retry — no quit-and-relaunch ceremony.
          renderIncompatibleServerScreen(next, retryCheck);
        }
      },
      (err: unknown) => {
        // The main-process check catches every failure mode itself (all
        // network paths return fail-open verdicts), so this arm fires only
        // if the IPC transport itself breaks. Re-arm the button rather than
        // strand the surface disabled — the window must never dead-end.
        log.error('[Boot] Retry could not run:', err);
        setRecoveryBusy(retryButton, false);
        // MW-119 fold: the pair was muzzled together; re-arm it together.
        if (changeButton.isConnected) {
          setRecoveryBusy(changeButton, false);
        }
      }
    );
  });
  box.appendChild(retryButton);

  // MW-119 (review windows__casualgamer 1): the too-old screen used to be a
  // dead end for the WRONG-URL case — the copy admitted "there is no in-app
  // way to point it at a different server", but a mistyped/retired address
  // produces the exact same verdict as a genuinely old one, and the user had
  // to quit and edit storage by hand. The escape hatch: clear the persisted
  // URL (the legal ''-clear on app:set-server-url), then re-run boot(). With
  // nothing persisted and no env seed, resolveAppConfig yields an empty base,
  // the version gate fail-opens on an empty probe (versionCheck.ts inactive
  // arms), and requireConnection:true routes the fresh mount to the Connect
  // screen. Retry keeps autofocus (windows__gameux 5: one Enter from the
  // primary recovery); this is the secondary surface.
  const changeButton = document.createElement('button');
  changeButton.type = 'button';
  changeButton.textContent = tWin('boot.incompatibleChange');
  changeButton.style.margin = '24px 0 0 12px';
  styleRecoveryButton(changeButton, 'secondary');
  changeButton.addEventListener('click', () => {
    // Same surface law as Retry, extended across BOTH buttons: an attempt in
    // flight silences the whole recovery row (they share one boot pipeline —
    // a Retry mid-change-server flight could race a second mount), and every
    // rejection path re-arms the still-connected screen instead of stranding
    // dead buttons.
    setRecoveryBusy(changeButton, true, tWin('boot.checking'));
    setRecoveryBusy(retryButton, true);
    const reseat = async (): Promise<void> => {
      // Hub mode is NOT enterable in this build (M-WINDOWS-17: the hub-config
      // writer has zero production callers), so clearing the server URL is
      // the complete state reset — no dead hub-clear code is added here.
      await window.electronAPI?.setServerUrl('');
      await boot();
    };
    void reseat().catch((err: unknown) => {
      // Either the storage clear or the resumed boot() threw BEFORE the app
      // owned the window (fail-fast config IPC class, same as Retry's r2
      // arm). If boot() instead reached a still-incompatible verdict, it
      // re-rendered this whole screen with fresh enabled buttons and this
      // off-document pair must not touch anyone's state.
      log.error('[Boot] Change-server attempt failed:', err);
      if (changeButton.isConnected) {
        setRecoveryBusy(changeButton, false);
        setRecoveryBusy(retryButton, false);
      }
    });
  });
  box.appendChild(changeButton);

  container.replaceChildren(box);

  // windows__gameux 5[m] (MW-089): one-Enter-away from recovery BY
  // CONSTRUCTION. Pre-fix the screen painted with focus on <body> — Enter did
  // nothing, no ring was visible, and the copy telling the user to press
  // "Try again" gave no cue that a Tab came first. The button is in the
  // document the moment replaceChildren returns, so focus() lands.
  retryButton.focus();
}

export async function boot(): Promise<void> {
  const api = window.electronAPI;

  // Deep link queue: stores URLs that arrived before router was ready
  const deeplinkQueue: string[] = [];

  // Read Electron-persisted config defensively so the renderer still boots in a
  // plain browser dev context where window.electronAPI is undefined.
  // Parallelize three independent IPC calls to minimize first-paint latency.
  // Running them concurrently vs sequentially shaves ~2/3 of the IPC round-trip time.
  // Why Promise.all instead of Promise.allSettled: these three IPC calls are all
  // required for a meaningful boot. hubGetConfig, deviceId, and serverUrl must all
  // succeed — if any one of them fails there is no point painting the UI (no server to
  // talk to, no device identity, etc.). This is a deliberate fail-fast design: one
  // broken dependency aborts the entire boot rather than silently painting a broken
  // state. The three calls are independent, so Promise.all parallelizes them optimally.
  const bootStart = performance.now();
  const [hubResult, deviceIdResult, serverUrlResult] = api
    ? await Promise.all([
        api.hubGetConfig(),
        api.getDeviceId(),
        api.getServerUrl()
      ])
    : [null, null, null];
  const bootEnd = performance.now();
  log.info(`[Boot] IPC parallelization: first paint data loaded in ${(bootEnd - bootStart).toFixed(1)}ms`);

  const hub = hubResult;
  const deviceId =
    deviceIdResult ??
    (() => {
      const fallbackId = `browser-${crypto.randomUUID()}`;
      log.warn('[Phlix] Electron bridge unavailable — using per-session device ID:', fallbackId);
      return fallbackId;
    })();
  const serverUrl = serverUrlResult;
  const envUrl = import.meta.env.VITE_PHLIX_SERVER_URL ?? null;

  const { app: appMode, apiBase } = resolveAppConfig({ hub, serverUrl, envUrl });

  // W7.6: Enforce minimum server version (1.1.0) before mounting the renderer.
  // Design decision, UNCHANGED by M-WINDOWS-02: fail-open for unknown servers.
  // Pre-1.1.0 servers that don't implement the root /system/info endpoint may
  // still work for basic features; blocking boot on an unknown server would
  // break existing deployments. The gate blocks ONLY when the server explicitly
  // reports a version below the minimum (src/main/versionCheck.ts is the SSOT
  // for that policy and for the endpoint path — this comment formerly cited a
  // nonexistent /api/v1/server/version).
  if (api) {
    // M-WINDOWS-16: the SAME closure serves the initial gate and every Retry
    // click — one check, one policy (src/main/versionCheck.ts stays the SSOT;
    // retry changes rendering, never verdicts).
    const checkVersion = (): Promise<ServerVersionCheckResult> => api.checkServerVersion(apiBase);
    const versionCheck = await checkVersion();
    if (!versionCheck.compatible) {
      // Too-old server. The main process has already shown the explanatory
      // error dialog (M-WINDOWS-02); mount the persistent counterpart instead
      // of aborting into a dark window, then stop the boot — no Vue app over
      // a server we refuse to talk to. The screen carries a Retry button so
      // the user is never quit-only (M-WINDOWS-16).
      //
      // M-WINDOWS-39: the rejection ALSO rides the native notification
      // surface. The incompatible screen renders into a window that at cold
      // start may be hidden-to-tray — a banner nobody sees is not a reply.
      // showNotification is pref-gated, payload-capped and rate-limited
      // main-side (M-WINDOWS-33/40); this boot path is its consumer, which
      // is exactly the orphan-class answer this batch's inventory pins.
      // The regular setWindowLocale below never runs on this early-return
      // path, so pin the locale here before tWin reads it.
      setWindowLocale(resolveLocale());
      try {
        void api.showNotification?.(tWin('boot.incompatibleTitle'), tWin('boot.incompatibleIntro'));
      } catch (err) {
        log.warn('[Boot] Native notification unavailable:', err);
      }
      log.error('[Boot] Server version check failed — showing the incompatible-server screen');
      renderIncompatibleServerScreen(versionCheck, checkVersion);
      return;
    }
  }

  const deviceHeaders = buildPhlixHeaders({
    deviceId,
    deviceName: 'Phlix for Windows',
    deviceType: 'windows'
  });

  const isHub = appMode === 'hub';

  // i18n: resolve the locale (VITE_PHLIX_LOCALE → navigator.language → 'en') and
  // hand @phlix/ui only the client's override map for it. Undefined means
  // "nothing to override" — the key is omitted so ui renders its English
  // defaults untouched (byte-identical to every pre-seam build).
  const locale = resolveLocale();
  const messages = messagesForLocale(locale);
  // Same tag drives the windows-own nav catalog (buildMenu labels the ui seam
  // cannot reach) BEFORE the menu is assembled below.
  const windowLocale = setWindowLocale(locale);
  log.info(`[Boot] UI locale: ${locale}${messages ? ' (client message overrides applied)' : ''}`);
  if (windowLocale !== 'en') {
    log.info(`[Boot] Windows-own nav catalog: ${windowLocale}`);
  }

  // M-WINDOWS-04 rider, second leg (tag-wave C4, @phlix/ui v0.99.12): the
  // SyncPlay socket hint. Server mode ONLY — in hub mode the same wsUrl seam
  // overrides the :8804 relay dial wholesale (upstream hubRelay.ts), so the
  // global stays untouched there. Derived from the EFFECTIVE base (persisted
  // URL or env seed); '' (Connect screen) derives null = NO_HINT.
  const syncPlayWsUrl = isHub ? null : deriveSyncPlayWsUrl(apiBase);

  // Verbatim window mirror. Its starting shape is the ui-side readConfig()
  // defaults (measured at the pinned peel) so the merged fullConfig stays
  // byte-identical to a default-path boot; bootConfig is folded in right
  // below it is built. Rewritten WHOLE on every connection change — no partial
  // merge, no stale residue across re-boots (the M-WINDOWS-16 Retry path
  // re-runs boot(), reassigning fresh). In hub mode it is never written.
  const syncPlayHintBase: BootConfig = {
    app: 'server',
    apiBase: '',
    routerBase: '/app',
    menu: [],
    extraRoutes: [],
    features: {},
    deviceHeaders: {}
  };
  const applySyncPlaySocketHint = (wsUrl: string | null): void => {
    if (isHub || typeof window === 'undefined') return;
    window.__PHLIX__ = { ...syncPlayHintBase, wsUrl };
  };

  // M4: DPAPI token custody. When the vault bridge is live, hand the vendored
  // app a TokenStore whose rows seal into main-process safeStorage instead of
  // plaintext localStorage — and first fold any pre-M4 plaintext rows across
  // (vault-wins, plaintext cleared only after a confirmed seal). Browser-dev /
  // bridge-less boots omit the key entirely: the vendored default store stays,
  // which is a dev-context posture, never a packaged one.
  const tokenStore = createVaultTokenStore(api);
  if (tokenStore) {
    foldPlaintextTokensToVault(tokenStore);
  }

  // MW-110 [review windows__casualgamer 1 — card w14/L4]: the gate above can
  // only vet the PERSISTED serverUrl — the Connect screen decides its base
  // AFTER mount, through onConnectionChange below. Pre-cure, a first-time
  // connect to a too-old server mounted the full app against a base the boot
  // gate would have refused, and the check only fired next launch: a gate
  // that cannot see the decision it exists to police is theater. Every
  // persisted connection change now re-runs THE SAME gate (same api, same
  // verdict SSOT in src/main/versionCheck.ts — zero new policy here). A
  // too-old verdict is honest teardown: unmount the silently-mounted app,
  // release the bridge + deeplink subscriptions (cleanupRenderer), and hand
  // the window to the same persistent screen whose Retry/Change row re-boots
  // legally. connectionGateSeq lets ONLY the latest attempt act on its
  // verdict — a slow stale TOO_OLD must never tear down a newer, good one.
  //
  // Disclosed boundary: between this teardown and the next boot()'s
  // handshake, main still believes the receiver is live (no new IPC channel
  // is invented here — the M-WINDOWS-06 handshake law stands untouched).
  // Deep links fired inside that window are lost exactly as they were to a
  // crashed renderer sitting on the recovery dialog; the Retry re-boot's
  // notifyDeeplinkReady re-announces and repairs the state.
  let mountedApp: { unmount(): void } | null = null;
  let connectionGateSeq = 0;
  const recheckConnectionGate = (base: string): void => {
    if (!api) {
      return; // bridge-less browser boot: there is no gate to re-run
    }
    const seq = ++connectionGateSeq;
    void api.checkServerVersion(base).then(
      (verdict) => {
        if (seq !== connectionGateSeq) {
          return; // a newer connection attempt owns the answer now
        }
        if (verdict.compatible) {
          return; // the mounted app may keep running against this base
        }
        log.error('[Boot] Connection change failed the server-version gate — replacing the mounted app with the incompatible-server screen');
        mountedApp?.unmount();
        cleanupRenderer();
        setWindowLocale(resolveLocale());
        try {
          void api.showNotification?.(tWin('boot.incompatibleTitle'), tWin('boot.incompatibleIntro'));
        } catch (err) {
          log.warn('[Boot] Native notification unavailable:', err);
        }
        renderIncompatibleServerScreen(verdict, () => api.checkServerVersion(base));
      },
      (err: unknown) => {
        // Same fail-open transport posture as the boot gate's check: the
        // check catches its own failure modes main-side; a broken IPC here
        // leaves the running app alone rather than punishing it for a
        // verdict it never received.
        log.error('[Boot] Connection-change version check could not run:', err);
      }
    );
  };

  const bootConfig: BootConfig = {
    app: appMode,
    apiBase,
    // This desktop app ships with no server baked in. When `apiBase` is empty
    // (nothing persisted/seeded yet) @phlix/ui routes to its first-run Connect
    // screen instead of showing a login form aimed at nothing. Mirror the chosen
    // URL back into Electron-store so resolveAppConfig re-seeds it next launch.
    requireConnection: true,
    onConnectionChange: (url) => {
      if (api) {
        void api.setServerUrl(url ?? '');
      } else {
        // m20 (review secnet m3): the raw base is user-entered server data —
        // electron-log's file transport persists renderer warns too, so this
        // goes through the same scheme+host summary law as the main process.
        log.warn(`[Phlix] Cannot persist server URL: Electron bridge unavailable, URL was: ${summarizeUrlForLog(url ?? '')}`);
      }
      // Keep the hint in lock-step with the user's choice: socketHint.ts reads
      // window.__PHLIX__ live at EVERY dial, so this rewrite takes effect on
      // the next SyncPlay connection without a restart. Hub mode never
      // touched the global and must keep not touching it (relay hijack).
      if (!isHub) {
        applySyncPlaySocketHint(deriveSyncPlayWsUrl(url ?? null));
      }
      // MW-110: persisting a choice is a CONNECTION event — vet it with the
      // same gate boot ran, or the first connect to a too-old server boots
      // silently. An empty base (a clear) re-runs the gate's own inactive
      // fail-open probe: no-op by construction, identical to boot.
      recheckConnectionGate(url ?? '');
    },
    // In hub mode, land on the servers directory (not the media-server Browse page,
    // whose server-only endpoints 404 on the hub) and skip continue-watching.
    ...(isHub ? { home: '/app/servers', features: { resumeSync: false } } : {}),
    // Top-bar nav (incl. the admin-gated "Admin" entry) + the admin section / mode
    // pages, mirroring the server & hub web-uis.
    menu: buildMenu(appMode),
    extraRoutes: buildExtraRoutes(appMode),
    deviceHeaders,
    ...(tokenStore ? { tokenStore } : {}),
    // M-WINDOWS-04 (explicit non-feature): boot always pins Nocturne — the
    // client deliberately does NOT mirror the OS dark/light scheme. One
    // consistent look across every launch is the estate-wide brand posture
    // (server/hub web-uis fixed-default the same); a personal choice still
    // exists in in-app Settings and flows from the server, never from the OS.
    defaultTheme: 'nocturne',
    branding: { wordmark: 'Phlix' },
    ...(messages ? { messages } : {}),
    // Mirror the hint into the config too (one source; socketHint still reads
    // the global live, which is what makes connection changes work). Hub
    // config carries NO wsUrl key at all — the seam-free state stays seam-free.
    ...(isHub ? {} : { wsUrl: syncPlayWsUrl })
  };

  if (!isHub) {
    Object.assign(syncPlayHintBase, bootConfig);
    applySyncPlaySocketHint(syncPlayWsUrl);
  }

  const app = createPhlixApp(bootConfig);
  // MW-110: register the live instance BEFORE mount — a connection verdict
  // racing in on the mount tick must find its subject.
  mountedApp = app;

  app.mount('#phlix-app');

  // M-WINDOWS-01: Vue owns the window now — retire the pre-JS boot splash.
  document.getElementById('boot-splash')?.remove();

  // Wire Electron media events to @phlix/ui player store
  _cleanupBridge = installElectronBridge(app);

  // M-WINDOWS-35: the former second-installer call site lived here, running
  // AFTER the vendored store's capability-gated mediaSession handlers and
  // clobbering them. Removed; the store owns the SMTC transport alone.

  // Hand the phlix-ui router to the overlay so it can subscribe to navigation
  // events (module-local hand-off, WIN-48 — no window globals); published
  // together with the pinia below, before the overlay is (re)mounted.
  const phlixRouter = app.config?.globalProperties?.$router;

  // Flush deep link queue once router is ready
  const router = app.config?.globalProperties?.$router as { isReady?: () => Promise<void>; push: (to: string) => unknown } | undefined;
  if (router) {
    if (router.isReady) {
      router.isReady().then(() => {
        for (const path of deeplinkQueue) {
          router.push(path);
        }
        deeplinkQueue.length = 0;
      });
    }
  }

  // Listen for deep links from main process (W4.4). m3 (casualgamer #5):
  // hub-only routes must not dead-end a direct-server window on the shared
  // shell's 404 page after consent — `/app/accept-invite/:token` and
  // `/app/server/:id` exist ONLY in hub mode's extraRoutes, so any other
  // mode refuses with an explicit native notification: never a silent 404.
  // The compare below folds case (vue-router resolves records case-free;
  // REVIEW-w09L2windows mirror of the main gate — the token keeps its case).
  const HUB_ONLY_ROUTES: ReadonlyArray<{ prefix: string; bodyKey: 'deeplink.inviteBody' | 'deeplink.serverBody' }> = [
    { prefix: '/app/accept-invite/', bodyKey: 'deeplink.inviteBody' },
    { prefix: '/app/server/', bodyKey: 'deeplink.serverBody' }
  ];
  const routeDeepLink = (path: string): void => {
    if (appMode !== 'hub') {
      const hubOnly = HUB_ONLY_ROUTES.find((r) => path.toLowerCase().startsWith(r.prefix));
      if (hubOnly) {
        log.warn(`[deeplink] hub-only route refused in ${appMode} mode: ${hubOnly.prefix}`);
        if (api?.showNotification) {
          void api.showNotification(tWin('deeplink.hubOnlyTitle'), tWin(hubOnly.bodyKey));
        }
        return;
      }
    }
    if (router && router.isReady && router.push) {
      router.isReady().then(() => {
        router.push(path);
      });
    } else {
      deeplinkQueue.push(path);
    }
  };
  if (api && api.onDeeplink) {
    _cleanupDeeplink = api.onDeeplink((path: string) => {
      routeDeepLink(path);
    });
    // M-WINDOWS-06: the listener is live only NOW — announce readiness so the
    // main process drains its pending-deeplink queue (cold-start links wait
    // there until this point, instead of racing a fixed timer). Links
    // arriving after the announce but before router.isReady() resolve are
    // caught by this file's own deeplinkQueue above. The browser dev-context
    // path (no electronAPI) has nothing to drain and never announces.
    api.notifyDeeplinkReady();
  }

  // M1 (2026-11 review): the overlay second app must read the SAME pinia
  // instance the vendored engine mutates (a fresh createPinia() there meant the
  // PiP/sleep overlays watched a private, never-updating store copy). Handed
  // over through ./overlayShared BEFORE the overlay builds its app.
  const phlixPinia = app.config?.globalProperties?.$pinia;
  setOverlayShared({ router: phlixRouter, pinia: phlixPinia });

  // Mount Vue overlay for P3-S4 player UX features (skip/sleep/PiP)
  // Imported dynamically after Vue app mounts so the shared Pinia is exposed.
  // The first import mounts at module load; the module is then cached, so every
  // later boot must remount() it against the fresh pinia/router (WIN-7).
  const overlayAlreadyLoaded = overlayLoaded;
  overlayLoaded = true;
  void import('./overlay').then((overlay) => {
    if (overlayAlreadyLoaded) overlay.remount();
  });
}

// Auto-boot only when the mount target exists. Unit tests import this module for
// buildMenu/buildExtraRoutes; running boot() there would mount into a nonexistent
// element and leave async work (e.g. the dynamic overlay import) that resolves
// after the test environment is torn down.
if (typeof document !== 'undefined' && document.getElementById('phlix-app')) {
  // m7(a) (review casualgamer #4): boot() fail-fasts on config IPC by design
  // (a half-applied custody state must not mount), but the discarded promise
  // meant a main-side throw — DPAPI fault, corrupt vault — left the pre-JS
  // splash spinning forever: no explanation, no Retry, quit-only. Visible
  // affordance now; the detail lands in the log, not on screen.
  void boot().catch((err: unknown) => {
    log.error('[Boot] boot() failed:', err);
    renderBootFailure();
  });
}

/**
 * m7(a): the boot-failure counterpart of renderIncompatibleServerScreen —
 * same sibling-of-#phlix-app discipline (the mount point stays intact for a
 * resumed boot), same splash retirement, same "Retry re-arms, never strands"
 * rule from M-WINDOWS-16 r2. No error detail is rendered: messages reaching
 * here can carry paths/custody wording, and the screen is a dead-end user
 * surface, not a debugger.
 */
export function renderBootFailure(): void {
  if (typeof document === 'undefined') return;
  // The catch may fire before boot()'s own locale pass ran — pin it first,
  // exactly as the incompatible-server early-return does.
  setWindowLocale(resolveLocale());
  document.getElementById('boot-splash')?.remove();
  if (document.getElementById('boot-failure')) return; // already surfaced
  const panel = document.createElement('div');
  panel.id = 'boot-failure';
  panel.setAttribute('role', 'alert');
  applyFailureScreenContainer(panel, { overlay: true });
  const card = document.createElement('div');
  card.style.maxWidth = '520px';
  const title = document.createElement('h1');
  title.textContent = tWin('boot.failTitle');
  title.setAttribute('style', 'font-size:22px;margin:0 0 12px;');
  const message = document.createElement('p');
  message.textContent = tWin('boot.failMessage');
  message.setAttribute('style', 'font-size:15px;margin:0 0 20px;');
  const retry = document.createElement('button');
  retry.type = 'button';
  retry.textContent = tWin('boot.failRetry');
  styleRecoveryButton(retry, 'primary');
  retry.addEventListener('click', () => {
    // Deliberate re-run: config IPC + version gate are all re-readable, and
    // a panel is only still mounted while nothing else owns the window —
    // the same resumed-boot reasoning as the incompatible screen's Retry.
    setRecoveryBusy(retry, true, tWin('boot.checking'));
    void boot().catch((err: unknown) => {
      log.error('[Boot] retried boot() failed:', err);
      setRecoveryBusy(retry, false);
      renderBootFailure();
    });
  });
  card.appendChild(title);
  card.appendChild(message);
  card.appendChild(retry);
  panel.appendChild(card);
  document.body.appendChild(panel);
  // windows__gameux 5[m] (MW-089): the boot-failure counterpart of the
  // incompatible screen's focus-by-construction law — Retry owns keyboard
  // focus the moment the panel lands in the document.
  retry.focus();
}
