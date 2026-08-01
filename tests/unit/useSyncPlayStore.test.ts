/**
 * Phlix Media Server Client for Windows.
 *
 * @copyright 2026 Joe Huss <detain@interserver.net>
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { useSyncPlayStore } from '../../src/stores/useSyncPlayStore';

// Mock window.electronAPI
const makeFakeElectronApi = () => ({
  onSyncPlayMessage: vi.fn(() => vi.fn()),
  onSyncPlayConnected: vi.fn(() => vi.fn()),
  onSyncPlayDisconnected: vi.fn(() => vi.fn()),
  syncPlayConnect: vi.fn(async () => {}),
  syncPlayDisconnect: vi.fn(async () => {}),
  syncPlaySend: vi.fn(async () => {})
});

describe('useSyncPlayStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    (globalThis as unknown as { window: { electronAPI?: unknown } }).window = {
      electronAPI: makeFakeElectronApi()
    };
  });

  afterEach(() => {
    delete (globalThis as unknown as { window?: unknown }).window;
    vi.restoreAllMocks();
  });

  it('initializes with default state', () => {
    const store = useSyncPlayStore();
    expect(store.currentRoom).toBeNull();
    expect(store.session).toBeNull();
    expect(store.publicRooms).toEqual([]);
    expect(store.isConnected).toBe(false);
    expect(store.isLoading).toBe(false);
    expect(store.error).toBeNull();
    expect(store.serverUrl).toBeNull();
  });

  it('computes isInRoom correctly', () => {
    const store = useSyncPlayStore();
    expect(store.isInRoom).toBe(false);

    store.currentRoom = { id: 'room1', name: 'Test Room', isPublic: true, memberCount: 2 } as any;
    expect(store.isInRoom).toBe(false); // session is null

    store.session = { roomId: 'room1', activeUsers: [], playbackPosition: 0, playbackRate: 1, serverTime: 0, lastSync: 0 } as any;
    expect(store.isInRoom).toBe(true);
  });

  it('computes memberCount from session', () => {
    const store = useSyncPlayStore();
    expect(store.memberCount).toBe(0);

    store.session = { roomId: 'room1', activeUsers: [{ id: '1' }, { id: '2' }], playbackPosition: 0, playbackRate: 1, serverTime: 0, lastSync: 0 } as any;
    expect(store.memberCount).toBe(2);
  });

  it('computes roomName from currentRoom', () => {
    const store = useSyncPlayStore();
    expect(store.roomName).toBeNull();

    store.currentRoom = { id: 'room1', name: 'My Room', isPublic: true, memberCount: 2 } as any;
    expect(store.roomName).toBe('My Room');
  });

  describe('setServerUrl', () => {
    it('sets the server URL', () => {
      const store = useSyncPlayStore();
      store.setServerUrl('http://localhost:8096');
      expect(store.serverUrl).toBe('http://localhost:8096');
    });

    it('clears server URL when set to null', () => {
      const store = useSyncPlayStore();
      store.setServerUrl('http://localhost:8096');
      store.setServerUrl(null);
      expect(store.serverUrl).toBeNull();
    });
  });

  describe('clearError', () => {
    it('clears the error state', () => {
      const store = useSyncPlayStore();
      store.error = 'Some error';
      store.clearError();
      expect(store.error).toBeNull();
    });
  });

  describe('setupWebSocketListeners', () => {
    it('returns a cleanup function', () => {
      const store = useSyncPlayStore();
      const cleanup = store.setupWebSocketListeners();
      expect(typeof cleanup).toBe('function');
    });

    it('registers message, connected, and disconnected listeners', () => {
      const api = (globalThis as unknown as { window: { electronAPI: ReturnType<typeof makeFakeElectronApi> } }).window.electronAPI;
      const store = useSyncPlayStore();
      store.setupWebSocketListeners();
      expect(api.onSyncPlayMessage).toHaveBeenCalled();
      expect(api.onSyncPlayConnected).toHaveBeenCalled();
      expect(api.onSyncPlayDisconnected).toHaveBeenCalled();
    });

    it('handles connected event', () => {
      const api = (globalThis as unknown as { window: { electronAPI: ReturnType<typeof makeFakeElectronApi> } }).window.electronAPI;
      const store = useSyncPlayStore();
      store.setupWebSocketListeners();

      // Get the callback and call it
      const connectedCallback = api.onSyncPlayConnected.mock.calls[0][0];
      connectedCallback('room-123');

      expect(store.isConnected).toBe(true);
      expect(store.error).toBeNull();
    });

    it('handles disconnected event', () => {
      const api = (globalThis as unknown as { window: { electronAPI: ReturnType<typeof makeFakeElectronApi> } }).window.electronAPI;
      const store = useSyncPlayStore();
      store.isConnected = true;
      store.setupWebSocketListeners();

      // Get the callback and call it
      const disconnectedCallback = api.onSyncPlayDisconnected.mock.calls[0][0];
      disconnectedCallback();

      expect(store.isConnected).toBe(false);
    });
  });

  describe('connectToRoom', () => {
    it('throws when server URL is not set', async () => {
      const store = useSyncPlayStore();
      await expect(store.connectToRoom('room1', 'token')).rejects.toThrow('Server URL not set');
    });

    it('throws when Electron API is not available', async () => {
      (globalThis as unknown as { window: { electronAPI?: undefined } }).window = {};
      const store = useSyncPlayStore();
      store.setServerUrl('http://localhost:8096');
      await expect(store.connectToRoom('room1', 'token')).rejects.toThrow('Electron API not available');
    });

    it('connects successfully', async () => {
      const api = (globalThis as unknown as { window: { electronAPI: ReturnType<typeof makeFakeElectronApi> } }).window.electronAPI;
      const store = useSyncPlayStore();
      store.setServerUrl('http://localhost:8096');

      await store.connectToRoom('room1', 'token');

      expect(api.syncPlayConnect).toHaveBeenCalledWith('room1', 'http://localhost:8096', 'token');
    });

    it('sets error on connection failure', async () => {
      const api = (globalThis as unknown as { window: { electronAPI: ReturnType<typeof makeFakeElectronApi> } }).window.electronAPI;
      api.syncPlayConnect.mockRejectedValueOnce(new Error('Connection failed'));
      const store = useSyncPlayStore();
      store.setServerUrl('http://localhost:8096');

      await expect(store.connectToRoom('room1', 'token')).rejects.toThrow('Connection failed');
      expect(store.error).toBe('Connection failed');
    });
  });

  describe('disconnect', () => {
    it('disconnects and clears state', async () => {
      const api = (globalThis as unknown as { window: { electronAPI: ReturnType<typeof makeFakeElectronApi> } }).window.electronAPI;
      const store = useSyncPlayStore();
      store.isConnected = true;
      store.currentRoom = { id: 'room1', name: 'Test', isPublic: true, memberCount: 1 } as any;
      store.session = { roomId: 'room1', activeUsers: [], playbackPosition: 0, playbackRate: 1, serverTime: 0, lastSync: 0 } as any;

      await store.disconnect();

      expect(api.syncPlayDisconnect).toHaveBeenCalled();
      expect(store.isConnected).toBe(false);
      expect(store.currentRoom).toBeNull();
      expect(store.session).toBeNull();
    });

    it('does nothing when API is not available', async () => {
      (globalThis as unknown as { window: { electronAPI?: undefined } }).window = {};
      const store = useSyncPlayStore();
      store.isConnected = true;
      // Should not throw
      await store.disconnect();
    });
  });

  describe('sendCommand', () => {
    it('sends command when connected', async () => {
      const api = (globalThis as unknown as { window: { electronAPI: ReturnType<typeof makeFakeElectronApi> } }).window.electronAPI;
      const store = useSyncPlayStore();
      store.isConnected = true;

      await store.sendCommand({ type: 'play' });

      expect(api.syncPlaySend).toHaveBeenCalledWith({ type: 'play' });
    });

    it('warns when not connected', async () => {
      const store = useSyncPlayStore();
      store.isConnected = false;

      await store.sendCommand({ type: 'play' });

      // Should not call syncPlaySend
      const api = (globalThis as unknown as { window: { electronAPI: ReturnType<typeof makeFakeElectronApi> } }).window.electronAPI;
      expect(api.syncPlaySend).not.toHaveBeenCalled();
    });
  });

  describe('fetchPublicRooms', () => {
    it('returns early when server URL is not set', async () => {
      const store = useSyncPlayStore();
      await store.fetchPublicRooms();
      expect(store.publicRooms).toEqual([]);
    });

    it('fetches rooms successfully', async () => {
      const mockResponse = [{ id: 'room1', name: 'Room 1', isPublic: true, memberCount: 5 }];
      global.fetch = vi.fn(async () => ({
        ok: true,
        json: async () => mockResponse
      })) as any;

      const store = useSyncPlayStore();
      store.setServerUrl('http://localhost:8096');

      await store.fetchPublicRooms();

      expect(store.publicRooms).toEqual(mockResponse);
      expect(store.isLoading).toBe(false);
      expect(store.error).toBeNull();
    });

    it('handles fetch failure', async () => {
      global.fetch = vi.fn(async () => {
        throw new Error('Network error');
      }) as any;

      const store = useSyncPlayStore();
      store.setServerUrl('http://localhost:8096');

      await store.fetchPublicRooms();

      expect(store.error).toBe('Network error');
      expect(store.publicRooms).toEqual([]);
    });

    it('handles non-ok response', async () => {
      global.fetch = vi.fn(async () => ({
        ok: false,
        statusText: 'Server Error'
      })) as any;

      const store = useSyncPlayStore();
      store.setServerUrl('http://localhost:8096');

      await store.fetchPublicRooms();

      expect(store.error).toContain('Failed to fetch rooms');
    });
  });

  describe('createRoom', () => {
    it('throws when server URL is not set', async () => {
      const store = useSyncPlayStore();
      await expect(store.createRoom('Test Room', true)).rejects.toThrow('Server URL not set');
    });

    it('throws when name is empty', async () => {
      const store = useSyncPlayStore();
      store.setServerUrl('http://localhost:8096');
      await expect(store.createRoom('', true)).rejects.toThrow('Room name cannot be empty');
      await expect(store.createRoom('   ', true)).rejects.toThrow('Room name cannot be empty');
    });

    it('creates room successfully', async () => {
      global.fetch = vi.fn(async () => ({
        ok: true,
        json: async () => ({ roomId: 'new-room', sessionId: 'session-123' })
      })) as any;

      const store = useSyncPlayStore();
      store.setServerUrl('http://localhost:8096');

      const result = await store.createRoom('Test Room', true);

      expect(result).toEqual({ roomId: 'new-room', sessionId: 'session-123' });
      expect(store.isLoading).toBe(false);
    });
  });

  describe('joinRoom', () => {
    it('throws when server URL is not set', async () => {
      const store = useSyncPlayStore();
      await expect(store.joinRoom('room1')).rejects.toThrow('Server URL not set');
    });

    it('joins room successfully', async () => {
      global.fetch = vi.fn(async () => ({
        ok: true,
        json: async () => ({ currentState: { roomId: 'room1', activeUsers: [], playbackPosition: 0, playbackRate: 1, serverTime: 0, lastSync: 0 } })
      })) as any;

      const store = useSyncPlayStore();
      store.setServerUrl('http://localhost:8096');
      store.publicRooms = [{ id: 'room1', name: 'Test Room', isPublic: true, memberCount: 2 }] as any;

      await store.joinRoom('room1');

      expect(store.currentRoom).toEqual({ id: 'room1', name: 'Test Room', isPublic: true, memberCount: 2 });
      expect(store.session).toBeDefined();
    });

    it('creates placeholder room when not in publicRooms', async () => {
      global.fetch = vi.fn(async () => ({
        ok: true,
        json: async () => ({ currentState: null })
      })) as any;

      const store = useSyncPlayStore();
      store.setServerUrl('http://localhost:8096');

      await store.joinRoom('abc12345');

      expect(store.currentRoom).toEqual({
        id: 'abc12345',
        name: 'Room abc12345',
        isPublic: false,
        memberCount: 0
      });
    });
  });

  describe('leaveRoom', () => {
    it('returns early when not in a room', async () => {
      const store = useSyncPlayStore();
      store.currentRoom = null;
      await store.leaveRoom();
      // Should not throw
    });

    it('leaves room and disconnects', async () => {
      global.fetch = vi.fn(async () => ({})) as any;
      const store = useSyncPlayStore();
      store.currentRoom = { id: 'room1', name: 'Test', isPublic: true, memberCount: 1 } as any;
      store.session = { roomId: 'room1', activeUsers: [], playbackPosition: 0, playbackRate: 1, serverTime: 0, lastSync: 0 } as any;
      store.setServerUrl('http://localhost:8096');
      store.isConnected = true;

      await store.leaveRoom();

      expect(global.fetch).toHaveBeenCalled();
      expect(store.currentRoom).toBeNull();
      expect(store.session).toBeNull();
      expect(store.isConnected).toBe(false);
    });

    it('handles fetch error gracefully', async () => {
      global.fetch = vi.fn(async () => {
        throw new Error('Network error');
      }) as any;

      const store = useSyncPlayStore();
      store.currentRoom = { id: 'room1', name: 'Test', isPublic: true, memberCount: 1 } as any;
      store.session = { roomId: 'room1', activeUsers: [], playbackPosition: 0, playbackRate: 1, serverTime: 0, lastSync: 0 } as any;
      store.setServerUrl('http://localhost:8096');
      store.isConnected = true;

      // Should not throw
      await store.leaveRoom();

      // State should still be cleared
      expect(store.currentRoom).toBeNull();
    });
  });
});
