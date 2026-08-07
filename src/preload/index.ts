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
  onMediaSeekTo: (callback: (time: number) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, time: number) => callback(time);
    ipcRenderer.on('media-seek-to', listener);
    return () => ipcRenderer.removeListener('media-seek-to', listener);
  },
  onMediaPrevious: (callback: () => void) => {
    ipcRenderer.on('media-previous', callback);
    return () => ipcRenderer.removeListener('media-previous', callback);
  },
  onMediaNext: (callback: () => void) => {
    ipcRenderer.on('media-next', callback);
    return () => ipcRenderer.removeListener('media-next', callback);
  },

  // W4.5: SMTC action handlers (navigator.mediaSession)
  mediaPlay: () => ipcRenderer.invoke('media:play'),
  mediaPause: () => ipcRenderer.invoke('media:pause'),
  mediaPrevious: () => ipcRenderer.invoke('media:previous'),
  mediaNext: () => ipcRenderer.invoke('media:next'),
  mediaSeekBackward: () => ipcRenderer.invoke('media:seek-backward'),
  mediaSeekForward: () => ipcRenderer.invoke('media:seek-forward'),
  mediaSeekTo: (time: number) => ipcRenderer.invoke('media:seek-to', time),

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

  // W7.6: runtime server version enforcement (1.1.0 minimum)
  checkServerVersion: (apiBase: string) => ipcRenderer.invoke('app:check-server-version', { apiBase }),

  // Stable device id
  /** Returns a persistent, per-install device identifier. See main process handler for details. */
  getDeviceId: () => ipcRenderer.invoke('app:get-device-id'),

  // Deep links (W4.4)
  onDeeplink: (callback: (path: string) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, path: string) => callback(path);
    ipcRenderer.on('deeplink:open', listener);
    return () => ipcRenderer.removeListener('deeplink:open', listener);
  },

  // W4.5: taskbar thumbnail button state (play/pause icon refresh)
  updateThumbar: (state: { playing: boolean }) => ipcRenderer.send('thumbar:update', state),

  // W4.5: taskbar progress bar
  setPlaybackProgress: (current: number, total: number) => ipcRenderer.send('playback:progress', { current, total }),

  // W4.6: power save blocker — prevent display sleep during playback
  updatePowerBlocker: (playing: boolean) => ipcRenderer.send('power:update', { playing }),

  // W4.7: native notifications
  showNotification: (title: string, body: string, clickAction?: string) =>
    ipcRenderer.invoke('notification:show', { title, body, clickAction }),

  // W4.12: GPU escape hatch — get/set disableHardwareAcceleration preference
  getDisableHardwareAcceleration: () => ipcRenderer.invoke('gpu:get-disable-hardware-acceleration'),
  setDisableHardwareAcceleration: (value: boolean) => ipcRenderer.invoke('gpu:set-disable-hardware-acceleration', value),

  // W4.12: GPU feature status for diagnostics
  getGpuFeatureStatus: () => ipcRenderer.invoke('gpu:get-feature-status'),
});
