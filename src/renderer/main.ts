import type { MenuItem } from '@phlix/ui';
import type { RouteRecordRaw } from 'vue-router';
import {
  createPhlixApp,
  buildAdminRoutes,
  buildHubAdminRoutes,
  LibraryScanPage,
  MyServersPage,
  FederationPage,
  ManageSharesPage
} from '@phlix/ui';
import { buildPhlixHeaders } from '@phlix/contracts';
import '@phlix/ui/style.css';
import '@phlix/ui/fonts.css';
import { resolveAppConfig } from './resolveConfig';
import { installElectronBridge } from './electronBridge';

/**
 * Top-bar nav for the current app mode. Mirrors the server and hub web-uis so the
 * desktop client gets the same surfaces — crucially the gated "Admin" entry,
 * which the shell shows only for an authenticated admin (`useAuthStore().isAdmin`).
 * Without a supplied `menu` the shell renders NO nav at all (no Browse/Admin), so
 * this is what makes the admin section reachable in the Windows client.
 */
export function buildMenu(appMode: 'server' | 'hub'): MenuItem[] {
  if (appMode === 'hub') {
    return [
      { id: 'my-servers', label: 'My Servers', to: '/app/servers' },
      { id: 'federation', label: 'Federation', to: '/app/federation' },
      { id: 'manage-shares', label: 'Shares', to: '/app/shares' },
      { id: 'admin', label: 'Admin', to: '/app/admin/dashboard', requiresAdmin: true }
    ];
  }
  return [
    // `libraryLinks` expands Browse into one nav link per library (fetched from
    // /api/v1/libraries), matching the per-library Browse sections.
    { id: 'browse', label: 'Browse', to: '/app', libraryLinks: true },
    { id: 'settings', label: 'Settings', to: '/app/settings' },
    { id: 'admin', label: 'Admin', to: '/app/admin/dashboard', requiresAdmin: true }
  ];
}

/**
 * Routes for the current app mode: the shared Vue admin section (`/app/admin/*`,
 * reachable via the gated "Admin" nav entry) plus each mode's own pages. Mirrors
 * the server/hub web-uis. Routes carry the full `/app` prefix (history base is '/').
 */
export function buildExtraRoutes(appMode: 'server' | 'hub'): RouteRecordRaw[] {
  if (appMode === 'hub') {
    return [
      { path: '/app/servers', name: 'my-servers', component: MyServersPage },
      { path: '/app/federation', name: 'federation', component: FederationPage },
      { path: '/app/shares', name: 'manage-shares', component: ManageSharesPage },
      ...buildHubAdminRoutes()
    ];
  }
  return [
    ...buildAdminRoutes(),
    { path: '/app/library/scan', name: 'library-scan', component: LibraryScanPage }
  ];
}

export async function boot(): Promise<void> {
  const api = window.electronAPI;

  // Read Electron-persisted config defensively so the renderer still boots in a
  // plain browser dev context where window.electronAPI is undefined.
  const hub = api ? await api.hubGetConfig() : null;
  const deviceId = api ? await api.getDeviceId() : 'windows-dev';
  const serverUrl = api ? await api.getServerUrl() : null;
  const envUrl = import.meta.env.VITE_PHLIX_SERVER_URL ?? null;

  const { app: appMode, apiBase } = resolveAppConfig({ hub, serverUrl, envUrl });

  const deviceHeaders = buildPhlixHeaders({
    deviceId,
    deviceName: 'Phlix for Windows',
    deviceType: 'windows'
  });

  const isHub = appMode === 'hub';

  const app = createPhlixApp({
    app: appMode,
    apiBase,
    // This desktop app ships with no server baked in. When `apiBase` is empty
    // (nothing persisted/seeded yet) @phlix/ui routes to its first-run Connect
    // screen instead of showing a login form aimed at nothing. Mirror the chosen
    // URL back into Electron-store so resolveAppConfig re-seeds it next launch.
    requireConnection: true,
    onConnectionChange: (url) => {
      void api?.setServerUrl(url ?? '');
    },
    // In hub mode, land on the servers directory (not the media-server Browse page,
    // whose server-only endpoints 404 on the hub) and skip continue-watching.
    ...(isHub ? { home: '/app/servers', features: { resumeSync: false } } : {}),
    // Top-bar nav (incl. the admin-gated "Admin" entry) + the admin section / mode
    // pages, mirroring the server & hub web-uis.
    menu: buildMenu(appMode),
    extraRoutes: buildExtraRoutes(appMode),
    deviceHeaders,
    defaultTheme: 'nocturne',
    branding: { wordmark: 'Phlix' }
  });

  app.mount('#phlix-app');

  installElectronBridge(app);
}

void boot();
