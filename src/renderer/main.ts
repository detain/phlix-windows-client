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
    deviceHeaders,
    defaultTheme: 'nocturne',
    branding: { wordmark: 'Phlix' }
  });

  app.mount('#phlix-app');

  installElectronBridge(app);
}

void boot();
