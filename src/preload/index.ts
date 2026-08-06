/**
 * Phlix Media Server Client for Windows.
 *
 * @copyright 2026 Joe Huss <detain@interserver.net>
 */

import { contextBridge, ipcRenderer } from 'electron';

// Expose protected methods to renderer
contextBridge.exposeInMainWorld('electronAPI', {
  // App info
  getAppPath: () => ipcRenderer.invoke('get-app-path'),
  getVersion: () => ipcRenderer.invoke('get-version'),

  // Window controls
  setAlwaysOnTop: (value: boolean) => ipcRenderer.send('set-always-on-top', value),
  minimizeToTray: () => ipcRenderer.send('minimize-to-tray'),
  getMinimizeToTray: () => ipcRenderer.invoke('tray:get-minimize-to-tray'),
  setMinimizeToTray: (val: boolean) => ipcRenderer.send('tray:set-minimize-to-tray', val),

  // Media controls from main process
  onMediaPlayPause: (callback: () => void) => {
    ipcRenderer.on('media-play-pause', callback);
    return () => ipcRenderer.removeListener('media-play-pause', callback);
  },
  onMediaStop: (callback: () => void) => {
    ipcRenderer.on('media-stop', callback);
    return () => ipcRenderer.removeListener('media-stop', callback);
  },
  onMediaRewind: (callback: () => void) => {
    ipcRenderer.on('media-rewind', callback);
    return () => ipcRenderer.removeListener('media-rewind', callback);
  },
  onMediaForward: (callback: () => void) => {
    ipcRenderer.on('media-forward', callback);
    return () => ipcRenderer.removeListener('media-forward', callback);
  },

  // Settings
  onOpenSettings: (callback: () => void) => {
    ipcRenderer.on('open-settings', callback);
    return () => ipcRenderer.removeListener('open-settings', callback);
  },

  // Hub configuration handlers
  hubGetConfig: () => ipcRenderer.invoke('hub:get-config'),
  hubSetConfig: (config: { hubUrl?: string; activeServerId?: string; connectionMode?: string }) =>
    ipcRenderer.invoke('hub:set-config', config),

  // Direct server URL
  getServerUrl: () => ipcRenderer.invoke('app:get-server-url'),
  setServerUrl: (url: string) => ipcRenderer.invoke('app:set-server-url', url),

  // Stable device id
  /** Returns a persistent, per-install device identifier. See main process handler for details. */
  getDeviceId: () => ipcRenderer.invoke('app:get-device-id'),
});
