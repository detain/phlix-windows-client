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

/**
 * Boot-time server-version gate verdict (M-WINDOWS-02). Mirror of the SSOT
 * declaration in src/main/versionCheck.ts — same pattern as HubConfig above
 * (the renderer cannot import from the main process, so the shape is
 * restated here and pinned by tests/unit/main.test.ts consumers).
 */
interface ServerVersionCheck {
  /** False ONLY when the server explicitly reported a version below `minimumVersion`. */
  compatible: boolean;
  /** The version string the server reported, or null when no version could be read (fail-open paths). */
  serverVersion: string | null;
  /** The minimum supported server version this gate enforces (semver X.Y.Z). */
  minimumVersion: string;
}

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
      // M-WINDOWS-35: the seek-to / previous / next subscription declarations
      // and the seven SMTC invoke wrappers removed with the shell's second
      // installer (see preload + mediaSession headers).
      onOpenSettings: (callback: () => void) => () => void;
      hubGetConfig: () => Promise<HubConfig>;
      /** M-WINDOWS-34: resolves true when the write was accepted, false when a field failed validation (malformed values are refused, never stored). */
      hubSetConfig: (config: { hubUrl?: string | null; activeServerId?: string | null; connectionMode?: string | null }) => Promise<boolean>;
      getServerUrl: () => Promise<string | null>;
      /** M-WINDOWS-34: '' is the legal clear-signal; any other value must pass isFetchableApiBase. Resolves the accept verdict. */
      setServerUrl: (url: string | null) => Promise<boolean>;
      /** Returns a stable, per-install device identifier. Generated once and persisted to electron-store. */
      getDeviceId: () => Promise<string>;
      /**
       * M-WINDOWS-11: read a decrypted value from the main-process DPAPI vault
       * (secrets.json). Null when absent, undecryptable, or rejected. Sync by
       * contract — mirrors @phlix/ui's synchronous TokenStore.
       */
      vaultGet: (key: string) => string | null;
      /** M-WINDOWS-11: seal and persist a vault entry; false on guard rejection. */
      vaultSet: (key: string, value: string) => boolean;
      /** M-WINDOWS-11: remove a vault entry; false on guard rejection. */
      vaultDelete: (key: string) => boolean;
      /** M-WINDOWS-11: whether OS encryption (safeStorage/DPAPI) backs the vault right now. */
      vaultIsAvailable: () => boolean;
      /** Receives deep link paths from the main process (W4.4). Returns cleanup function. */
      onDeeplink: (callback: (path: string) => void) => () => void;
      /** M-WINDOWS-06: tells main this renderer's deeplink listener is subscribed, so it may drain its pending queue (see src/preload/index.ts). */
      notifyDeeplinkReady: () => void;
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
      // M-WINDOWS-35: the seven SMTC action-invoke declarations were removed
      // — the shell's second installer (see ./mediaSession era notes) was
      // their only caller.
      /** W7.6: runtime server version enforcement — checks server meets minimum 1.1.0. M-WINDOWS-02: structured verdict so every blocking outcome carries the versions that decided it (mirrors ServerVersionCheck in src/main/versionCheck.ts). */
      checkServerVersion: (apiBase: string) => Promise<ServerVersionCheck>;
    };
  }
}
