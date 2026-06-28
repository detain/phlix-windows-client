import { createPhlixApp } from '@phlix/ui';
import { buildPhlixHeaders } from '@phlix/contracts';
import '@phlix/ui/style.css';
import '@phlix/ui/fonts.css';
import { resolveAppConfig } from './resolveConfig';
import { installElectronBridge } from './electronBridge';

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
    deviceHeaders,
    defaultTheme: 'nocturne',
    branding: { wordmark: 'Phlix' }
  });

  app.mount('#phlix-app');

  installElectronBridge(app);
}

void boot();
