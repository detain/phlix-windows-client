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

/** SyncPlay types from @phlix/contracts */
export interface SyncPlayRoom {
  id: string;
  name: string;
  description?: string;
  isPublic: boolean;
  currentSession?: SyncPlaySession;
  memberCount: number;
}

export interface SyncPlaySession {
  id: string;
  roomId: string;
  serverId: string;
  createdBy: string;
  createdAt: string;
  state: 'waiting' | 'playing' | 'paused' | 'ended';
  playbackPosition: number;
  playbackRate: number;
  serverTime: number;
  lastSync: string;
  activeUsers: SyncPlayUser[];
  roles: Record<string, SyncPlayRole>;
  permissions: Record<string, SyncPlayPermission[]>;
}

export type SyncPlayRole = 'none' | 'contributor' | 'editor' | 'owner';
export type SyncPlayPermission = 'play' | 'pause' | 'seek' | 'chat' | 'control';

export interface SyncPlayUser {
  id: string;
  name: string;
  profileId: number;
  role: SyncPlayRole;
  isOnline: boolean;
  lastSeen: string;
}

export interface SyncPlayPlaybackCommand {
  type: 'play' | 'pause' | 'seek' | 'sync';
  position?: number;
  rate?: number;
  issuedBy: string;
  issuedAt: string;
}

/** SyncPlay WebSocket message types */
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
  members?: SyncPlayUser[];
}

export type SyncPlayMessage =
  | { kind: 'state'; data: SyncPlayStateUpdate }
  | { kind: 'member'; data: SyncPlayMemberUpdate }
  | { kind: 'command'; data: SyncPlayPlaybackCommand }
  | { kind: 'error'; data: { message: string } };

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
