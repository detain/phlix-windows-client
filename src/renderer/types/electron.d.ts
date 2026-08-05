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

/**
 * Bridge-specific SyncPlay types not in @phlix/contracts.
 * These support the renderer bridge's WebSocket message handling.
 */
export interface SyncPlayPlaybackCommand {
  type: 'play' | 'pause' | 'seek' | 'sync';
  position?: number;
  rate?: number;
  issuedBy: string;
  issuedAt: string;
}

/** SyncPlay WebSocket message types for bridge handling */
export interface SyncPlayStateUpdate {
  sessionId: string;
  playbackPosition: number;
  playbackRate: number;
  serverTime: number;
  timestamp: string;
}

export interface SyncPlayMemberUpdate {
  userId: string;
  userName: string;
  action: 'join' | 'leave' | 'update';
  members?: import('@phlix/contracts').SyncPlayUser[];
}

/**
 * SyncPlay WebSocket message union for bridge message handling.
 * The 'kind' discriminator enables type-safe message routing.
 */
export type SyncPlayMessage =
  | { kind: 'state'; data: SyncPlayStateUpdate }
  | { kind: 'member'; data: SyncPlayMemberUpdate }
  | { kind: 'command'; data: SyncPlayPlaybackCommand }
  | { kind: 'error'; data: { message: string } };

declare global {
  interface Window {
    electronAPI?: {
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
      /** Returns a stable, per-install device identifier. Generated once and persisted to electron-store. */
      getDeviceId: () => Promise<string>;
      /** SyncPlay WebSocket management */
      syncPlayConnect: (roomId: string, serverUrl: string, token: string) => Promise<void>;
      syncPlayDisconnect: () => Promise<void>;
      syncPlaySend: (message: SyncPlayPlaybackCommand) => Promise<void>;
      onSyncPlayMessage: (callback: (message: SyncPlayMessage) => void) => () => void;
      onSyncPlayConnected: (callback: (roomId: string) => void) => () => void;
      onSyncPlayDisconnected: (callback: () => void) => () => void;
    };
  }
}
