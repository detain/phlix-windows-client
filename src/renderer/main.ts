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
import { messagesForLocale, resolveLocale } from './i18n';
import { setWindowLocale, tWin } from './i18n/windows-own';
import log from 'electron-log';
import { installElectronBridge } from './electronBridge';
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
  container.setAttribute('style', [
    'display:flex', 'align-items:center', 'justify-content:center', 'height:100vh',
    'padding:24px', 'box-sizing:border-box', 'background:#1a1a2e', 'color:#e8e8f0',
    'font-family:system-ui,-apple-system,"Segoe UI",sans-serif', 'text-align:center'
  ].join(';') + ';');

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
  retryButton.setAttribute('style', [
    'margin:24px auto 0', 'display:inline-block', 'padding:10px 22px',
    'font-size:14px', 'font-family:inherit', 'color:#e8e8f0', 'background:#26264a',
    'border:1px solid #3a3a5e', 'border-radius:6px', 'cursor:pointer'
  ].join(';') + ';');
  retryButton.addEventListener('click', () => {
    // One attempt in flight at a time; the re-render path re-arms a fresh button.
    retryButton.disabled = true;
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
              retryButton.disabled = false;
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
        retryButton.disabled = false;
      }
    );
  });
  box.appendChild(retryButton);

  container.replaceChildren(box);
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
        log.warn('[Phlix] Cannot persist server URL: Electron bridge unavailable, URL was:', url);
      }
      // Keep the hint in lock-step with the user's choice: socketHint.ts reads
      // window.__PHLIX__ live at EVERY dial, so this rewrite takes effect on
      // the next SyncPlay connection without a restart. Hub mode never
      // touched the global and must keep not touching it (relay hijack).
      if (!isHub) {
        applySyncPlaySocketHint(deriveSyncPlayWsUrl(url ?? null));
      }
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

  app.mount('#phlix-app');

  // M-WINDOWS-01: Vue owns the window now — retire the pre-JS boot splash.
  document.getElementById('boot-splash')?.remove();

  // Wire Electron media events to @phlix/ui player store
  _cleanupBridge = installElectronBridge(app);

  // M-WINDOWS-35: the former second-installer call site lived here, running
  // AFTER the vendored store's capability-gated mediaSession handlers and
  // clobbering them. Removed; the store owns the SMTC transport alone.

  // Expose phlix-ui router so overlay components can subscribe to navigation events
  // This is consumed by PlayerSupplement to detect player route changes without polling
  const phlixRouter = app.config?.globalProperties?.$router;
  if (phlixRouter) {
    Object.defineProperty(window, '__phlixRouter', {
      value: phlixRouter,
      writable: false,
      configurable: true
    });
  }

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

  // Listen for deep links from main process (W4.4)
  if (api && api.onDeeplink) {
    _cleanupDeeplink = api.onDeeplink((path: string) => {
      if (router && router.isReady && router.push) {
        router.isReady().then(() => {
          router.push(path);
        });
      } else {
        deeplinkQueue.push(path);
      }
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
  // instance the vendored engine mutates. Exposed with the same window-
  // global pattern as __phlixRouter above; overlay.tsx consumes it BEFORE
  // its module-level app.use() so usePlayerStore() resolves the live stores.
  // A fresh createPinia() there meant the PiP/sleep overlays watched a
  // private, never-updating store copy — they never rendered in production.
  const phlixPinia = app.config?.globalProperties?.$pinia;
  if (phlixPinia) {
    Object.defineProperty(window, '__phlixPinia', {
      value: phlixPinia,
      writable: false,
      configurable: true
    });
  }

  // Mount Vue overlay for P3-S4 player UX features (skip/sleep/PiP)
  // Imported dynamically after Vue app mounts so the shared Pinia is exposed
  void import('./overlay');

  // HMR dispose hook: clean up all renderer resources before Vite replaces the module
  import.meta.hot?.dispose(() => {
    cleanupRenderer();
  });

  // beforeunload cleanup: mirrors HMR dispose for non-HMR page refreshes/navigation
  // Guard with typeof to support test environments (jsdom) that don't provide addEventListener
  if (typeof window.addEventListener === 'function') {
    window.addEventListener('beforeunload', () => {
      cleanupRenderer();
    });
  }
}

// Auto-boot only when the mount target exists. Unit tests import this module for
// buildMenu/buildExtraRoutes; running boot() there would mount into a nonexistent
// element and leave async work (e.g. the dynamic overlay import) that resolves
// after the test environment is torn down.
if (typeof document !== 'undefined' && document.getElementById('phlix-app')) {
  void boot();
}
