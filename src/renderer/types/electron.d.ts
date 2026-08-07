/**
 * Phlix Media Server Client for Windows.
 *
 * @copyright 2026 Joe Huss <detain@interserver.net>
 */

export {};

interface HubConfig {
  hubUrl: string | null;
  activeServerId: string | null;
  connectionMode: string | null;
}

/** SyncPlay types imported from @phlix/contracts (SyncPlayRoom, SyncPlaySession, SyncPlayUser, SyncPlayRole, SyncPlayPermission) */

declare global {
  interface Window {
    electronAPI?: {
      getAppPath: () => Promise<string>;
      getVersion: () => Promise<string>;
      setAlwaysOnTop: (value: boolean) => void;
      minimizeToTray: () => void;
      getMinimizeToTray: () => Promise<boolean>;
      setMinimizeToTray: (val: boolean) => void;
      onMediaPlayPause: (callback: () => void) => () => void;
      onMediaStop: (callback: () => void) => () => void;
      onMediaRewind: (callback: () => void) => () => void;
      onMediaForward: (callback: () => void) => () => void;
      onOpenSettings: (callback: () => void) => () => void;
      hubGetConfig: () => Promise<HubConfig>;
      hubSetConfig: (config: { hubUrl?: string; activeServerId?: string; connectionMode?: string }) => Promise<void>;
      getServerUrl: () => Promise<string | null>;
      setServerUrl: (url: string) => Promise<void>;
      /** Returns a stable, per-install device identifier. Generated once and persisted to electron-store. */
      getDeviceId: () => Promise<string>;
      /** Receives deep link paths from the main process (W4.4). Returns cleanup function. */
      onDeeplink: (callback: (path: string) => void) => () => void;
      /** W4.5: refreshes the taskbar thumbnail play/pause button tooltip */
      updateThumbar: (state: { playing: boolean }) => void;
      /** W4.5: sets the taskbar progress bar (current/total). Pass total=0 to clear. */
      setPlaybackProgress: (current: number, total: number) => void;
      /** W4.6: prevents display sleep during playback */
      updatePowerBlocker: (playing: boolean) => void;
      /** W4.7: shows a native system notification; returns true if shown, false if not */
      showNotification: (title: string, body: string, clickAction?: string) => Promise<boolean>;
      /** W4.12: gets the disableHardwareAcceleration preference */
      getDisableHardwareAcceleration: () => Promise<boolean>;
      /** W4.12: sets the disableHardwareAcceleration preference */
      setDisableHardwareAcceleration: (value: boolean) => Promise<void>;
      /** W4.12: gets GPU feature status for diagnostics */
      getGpuFeatureStatus: () => Promise<Electron.GPUFeatureStatus>;
    };
  }
}
