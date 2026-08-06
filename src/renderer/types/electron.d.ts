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
      onFileOpened: (callback: (filePath: string) => void) => () => void;
      onOpenSettings: (callback: () => void) => () => void;
      hubGetConfig: () => Promise<HubConfig>;
      hubSetConfig: (config: { hubUrl?: string; activeServerId?: string; connectionMode?: string }) => Promise<void>;
      getServerUrl: () => Promise<string | null>;
      setServerUrl: (url: string) => Promise<void>;
      /** Returns a stable, per-install device identifier. Generated once and persisted to electron-store. */
      getDeviceId: () => Promise<string>;
    };
  }
}
