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

declare global {
  interface Window {
    electronAPI: {
      getAppPath: () => Promise<string>;
      getVersion: () => Promise<string>;
      setAlwaysOnTop: (value: boolean) => void;
      minimizeToTray: () => void;
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
      getDeviceId: () => Promise<string>;
    };
  }
}
