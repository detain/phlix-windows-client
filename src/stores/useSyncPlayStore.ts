/**
 * Phlix Media Server Client for Windows.
 *
 * SyncPlay state management store.
 * Handles room management, session state, and WebSocket connectivity
 * for collaborative playback via electronBridge.
 *
 * @copyright 2026 Joe Huss <detain@interserver.net>
 */

import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import type {
  SyncPlayRoom,
  SyncPlaySession,
  SyncPlayPlaybackCommand,
  SyncPlayMessage,
  SyncPlayStateUpdate,
  SyncPlayMemberUpdate
} from '../renderer/types/electron.d';

/** API base URL for SyncPlay REST endpoints */
const SYNCPLAY_API_ROOMS = '/api/v1/syncplay/rooms';

export interface UseSyncPlayStoreState {
  /** Current room the user is in, if any */
  currentRoom: SyncPlayRoom | null;
  /** Current SyncPlay session */
  session: SyncPlaySession | null;
  /** List of public rooms available to join */
  publicRooms: SyncPlayRoom[];
  /** Whether we're currently connected to a SyncPlay WebSocket */
  isConnected: boolean;
  /** Loading states for async operations */
  isLoading: boolean;
  /** Error message if last operation failed */
  error: string | null;
  /** Server URL for WebSocket connection */
  serverUrl: string | null;
}

export const useSyncPlayStore = defineStore('phlix-syncplay', () => {
  // State refs
  const currentRoom = ref<SyncPlayRoom | null>(null);
  const session = ref<SyncPlaySession | null>(null);
  const publicRooms = ref<SyncPlayRoom[]>([]);
  const isConnected = ref(false);
  const isLoading = ref(false);
  const error = ref<string | null>(null);
  const serverUrl = ref<string | null>(null);

  // Computed
  const isInRoom = computed(() => currentRoom.value !== null && session.value !== null);
  const memberCount = computed(() => session.value?.activeUsers.length ?? 0);
  const roomName = computed(() => currentRoom.value?.name ?? null);

  /**
   * Set up WebSocket event listeners.
   * Must be called after electronBridge is installed.
   */
  function setupWebSocketListeners(): () => void {
    const api = window.electronAPI;
    if (!api) return () => {};

    const cleanups: Array<() => void> = [];

    cleanups.push(
      api.onSyncPlayMessage((message: SyncPlayMessage) => {
        handleWebSocketMessage(message);
      })
    );

    cleanups.push(
      api.onSyncPlayConnected((roomId: string) => {
        isConnected.value = true;
        error.value = null;
        console.info(`SyncPlay connected to room: ${roomId}`);
      })
    );

    cleanups.push(
      api.onSyncPlayDisconnected(() => {
        isConnected.value = false;
        console.info('SyncPlay disconnected');
      })
    );

    return () => {
      for (const cleanup of cleanups) {
        cleanup();
      }
    };
  }

  /**
   * Handle incoming WebSocket message.
   * Follows Early Exit and Intentional Naming principles.
   */
  function handleWebSocketMessage(message: SyncPlayMessage): void {
    switch (message.kind) {
      case 'state':
        handleStateUpdate(message.data);
        break;
      case 'member':
        handleMemberUpdate(message.data);
        break;
      case 'command':
        // Commands are handled by electronBridge directly
        break;
      case 'error':
        handleError(message.data);
        break;
    }
  }

  function handleStateUpdate(data: SyncPlayStateUpdate): void {
    // Update session state with new playback position
    if (session.value) {
      session.value = {
        ...session.value,
        playbackPosition: data.playbackPosition,
        playbackRate: data.playbackRate,
        serverTime: data.serverTime,
        lastSync: data.timestamp
      };
    }
  }

  function handleMemberUpdate(data: SyncPlayMemberUpdate): void {
    if (!session.value) return;

    switch (data.action) {
      case 'join':
        // New user joined - add to activeUsers if not already present
        if (data.members) {
          session.value.activeUsers = data.members;
        }
        break;
      case 'leave':
        // User left - remove from activeUsers
        session.value.activeUsers = session.value.activeUsers.filter(
          (u) => u.id !== data.userId
        );
        break;
      case 'update':
        // Members list updated
        if (data.members) {
          session.value.activeUsers = data.members;
        }
        break;
    }
  }

  function handleError(data: { message: string }): void {
    error.value = data.message;
    console.error('SyncPlay error:', data.message);
  }

  /**
   * Connect to a SyncPlay room's WebSocket.
   * Uses electronBridge for native WebSocket handling.
   */
  async function connectToRoom(roomId: string, token: string): Promise<void> {
    // Early exit if not connected to server
    if (!serverUrl.value) {
      throw new Error('Server URL not set. Cannot connect to SyncPlay room.');
    }

    const api = window.electronAPI;
    if (!api) {
      throw new Error('Electron API not available. SyncPlay requires Electron.');
    }

    isLoading.value = true;
    error.value = null;

    try {
      await api.syncPlayConnect(roomId, serverUrl.value, token);
      // Connection state is updated via the onSyncPlayConnected listener
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to connect to room';
      error.value = message;
      throw new Error(message);
    } finally {
      isLoading.value = false;
    }
  }

  /**
   * Disconnect from the current SyncPlay room.
   */
  async function disconnect(): Promise<void> {
    const api = window.electronAPI;
    if (!api) return;

    try {
      await api.syncPlayDisconnect();
    } finally {
      isConnected.value = false;
      currentRoom.value = null;
      session.value = null;
    }
  }

  /**
   * Send a playback command to the room.
   */
  async function sendCommand(command: SyncPlayPlaybackCommand): Promise<void> {
    const api = window.electronAPI;
    if (!api || !isConnected.value) {
      console.warn('Cannot send SyncPlay command: not connected');
      return;
    }

    await api.syncPlaySend(command);
  }

  /**
   * Fetch list of public rooms from the server.
   */
  async function fetchPublicRooms(): Promise<void> {
    if (!serverUrl.value) return;

    isLoading.value = true;
    error.value = null;

    try {
      const response = await fetch(`${serverUrl.value}${SYNCPLAY_API_ROOMS}`);
      if (!response.ok) {
        throw new Error(`Failed to fetch rooms: ${response.statusText}`);
      }
      const data = await response.json();
      publicRooms.value = Array.isArray(data) ? data : [];
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to fetch public rooms';
      error.value = message;
      publicRooms.value = [];
    } finally {
      isLoading.value = false;
    }
  }

  /**
   * Create a new SyncPlay room.
   */
  async function createRoom(name: string, isPublic: boolean): Promise<{ roomId: string; sessionId: string }> {
    if (!serverUrl.value) {
      throw new Error('Server URL not set. Cannot create room.');
    }

    if (!name.trim()) {
      throw new Error('Room name cannot be empty.');
    }

    isLoading.value = true;
    error.value = null;

    try {
      const response = await fetch(`${serverUrl.value}${SYNCPLAY_API_ROOMS}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ name: name.trim(), isPublic })
      });

      if (!response.ok) {
        throw new Error(`Failed to create room: ${response.statusText}`);
      }

      const data = await response.json();
      return {
        roomId: data.roomId,
        sessionId: data.sessionId
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to create room';
      error.value = message;
      throw new Error(message);
    } finally {
      isLoading.value = false;
    }
  }

  /**
   * Join an existing SyncPlay room.
   */
  async function joinRoom(roomId: string): Promise<void> {
    if (!serverUrl.value) {
      throw new Error('Server URL not set. Cannot join room.');
    }

    isLoading.value = true;
    error.value = null;

    try {
      const response = await fetch(`${serverUrl.value}${SYNCPLAY_API_ROOMS}/${encodeURIComponent(roomId)}/join`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`Failed to join room: ${response.statusText}`);
      }

      const data = await response.json();

      // Find the room in publicRooms or create a basic room object
      const room = publicRooms.value.find((r) => r.id === roomId) || {
        id: roomId,
        name: `Room ${roomId.slice(0, 8)}`,
        isPublic: false,
        memberCount: 0
      };

      currentRoom.value = room;
      session.value = data.currentState || null;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to join room';
      error.value = message;
      throw new Error(message);
    } finally {
      isLoading.value = false;
    }
  }

  /**
   * Leave the current SyncPlay room.
   */
  async function leaveRoom(): Promise<void> {
    if (!currentRoom.value || !serverUrl.value) return;

    const roomId = currentRoom.value.id;

    isLoading.value = true;
    error.value = null;

    try {
      await fetch(`${serverUrl.value}${SYNCPLAY_API_ROOMS}/${encodeURIComponent(roomId)}/leave`, {
        method: 'DELETE'
      });
    } catch (err) {
      // Log but don't throw - we want to disconnect regardless
      console.error('Error leaving room:', err);
    } finally {
      // Always disconnect the WebSocket and clear state
      await disconnect();
      isLoading.value = false;
    }
  }

  /**
   * Set the server URL for API and WebSocket connections.
   */
  function setServerUrl(url: string | null): void {
    serverUrl.value = url;
  }

  /**
   * Clear any error state.
   */
  function clearError(): void {
    error.value = null;
  }

  return {
    // State
    currentRoom,
    session,
    publicRooms,
    isConnected,
    isLoading,
    error,
    serverUrl,
    // Computed
    isInRoom,
    memberCount,
    roomName,
    // Actions
    setupWebSocketListeners,
    connectToRoom,
    disconnect,
    sendCommand,
    fetchPublicRooms,
    createRoom,
    joinRoom,
    leaveRoom,
    setServerUrl,
    clearError
  };
});
