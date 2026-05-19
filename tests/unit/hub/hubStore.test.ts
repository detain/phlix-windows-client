import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useHubStore } from '../../../src/store/hubStore';
import hubService from '../../../src/hub/HubService';

// Mock hubService
vi.mock('../../../src/hub/HubService', () => ({
  __esModule: true,
  default: {
    signIn: vi.fn(),
    refresh: vi.fn(),
    listServers: vi.fn(),
    signOut: vi.fn()
  }
}));

describe('hubStore', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.removeItem('hub_url');
    localStorage.removeItem('hub_session');

    // Reset store state
    useHubStore.setState({
      hubUrl: null,
      session: null,
      servers: [],
      activeServerId: null,
      connectionMode: 'direct',
      isLoading: false,
      error: null,
      effectiveServerUrl: ''
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('initial state', () => {
    it('has correct initial values', () => {
      const state = useHubStore.getState();
      expect(state.hubUrl).toBeNull();
      expect(state.session).toBeNull();
      expect(state.servers).toEqual([]);
      expect(state.activeServerId).toBeNull();
      expect(state.connectionMode).toBe('direct');
      expect(state.isLoading).toBe(false);
      expect(state.error).toBeNull();
      expect(state.effectiveServerUrl).toBe('');
    });
  });

  describe('setHubUrl', () => {
    it('updates hubUrl and persists to localStorage', () => {
      const { setHubUrl } = useHubStore.getState();

      setHubUrl('https://hub.example.com');

      const state = useHubStore.getState();
      expect(state.hubUrl).toBe('https://hub.example.com');
      expect(localStorage.getItem('hub_url')).toBe('https://hub.example.com');
    });
  });

  describe('signIn', () => {
    it('test_signIn_sets_session_and_fetches_servers', async () => {
      const mockSession = {
        accessToken: 'test-access-token',
        refreshToken: 'test-refresh-token',
        expiresAt: Date.now() + 3600000,
        userId: 'user-123'
      };

      const mockServers = [
        {
          serverId: 'server-1',
          serverName: 'Living Room',
          version: '1.0.0',
          status: 'online' as const,
          hostname: '192.168.1.100:8096',
          capabilities: ['streaming']
        }
      ];

      (hubService.signIn as ReturnType<typeof vi.fn>).mockResolvedValue(mockSession);
      (hubService.listServers as ReturnType<typeof vi.fn>).mockResolvedValue(mockServers);

      const { setHubUrl, signIn } = useHubStore.getState();
      setHubUrl('https://hub.example.com');

      await signIn('testuser', 'password123');

      const state = useHubStore.getState();
      expect(state.session).toEqual(mockSession);
      expect(state.servers).toEqual(mockServers);
      expect(state.activeServerId).toBe('server-1');
      expect(state.isLoading).toBe(false);
      expect(state.error).toBeNull();
    });

    it('sets error when hubUrl not configured', async () => {
      const { signIn } = useHubStore.getState();

      await signIn('testuser', 'password123');

      const state = useHubStore.getState();
      expect(state.error).toBe('Hub URL not configured');
    });
  });

  describe('setActiveServer', () => {
    it('test_setActiveServer_updates_effectiveUrl', async () => {
      const mockServers = [
        {
          serverId: 'server-1',
          serverName: 'Living Room',
          version: '1.0.0',
          status: 'online' as const,
          hostname: '192.168.1.100:8096',
          capabilities: ['streaming']
        },
        {
          serverId: 'server-2',
          serverName: 'Bedroom',
          version: '1.0.0',
          status: 'online' as const,
          hostname: '192.168.1.101:8096',
          capabilities: ['streaming']
        }
      ];

      // Set up state with servers
      useHubStore.setState({
        hubUrl: 'https://hub.example.com',
        servers: mockServers,
        activeServerId: 'server-1',
        connectionMode: 'direct'
      });

      const { setActiveServer } = useHubStore.getState();
      setActiveServer('server-2');

      const state = useHubStore.getState();
      expect(state.activeServerId).toBe('server-2');
      expect(state.effectiveServerUrl).toBe('http://192.168.1.101:8096');
    });

    it('computes relay URL in relay mode', () => {
      const mockServers = [
        {
          serverId: 'server-1',
          serverName: 'Living Room',
          version: '1.0.0',
          status: 'online' as const,
          hostname: '192.168.1.100:8096',
          capabilities: ['streaming']
        }
      ];

      useHubStore.setState({
        hubUrl: 'https://hub.example.com',
        servers: mockServers,
        activeServerId: 'server-1',
        connectionMode: 'relay'
      });

      const { setActiveServer } = useHubStore.getState();
      setActiveServer('server-1');

      const state = useHubStore.getState();
      expect(state.effectiveServerUrl).toBe('https://hub.example.com/api/v1/relay/server-1');
    });
  });

  describe('setConnectionMode', () => {
    it('updates connection mode and recomputes effectiveUrl', () => {
      const mockServers = [
        {
          serverId: 'server-1',
          serverName: 'Living Room',
          version: '1.0.0',
          status: 'online' as const,
          hostname: '192.168.1.100:8096',
          capabilities: ['streaming']
        }
      ];

      useHubStore.setState({
        hubUrl: 'https://hub.example.com',
        servers: mockServers,
        activeServerId: 'server-1',
        connectionMode: 'direct'
      });

      const { setConnectionMode } = useHubStore.getState();
      setConnectionMode('relay');

      const state = useHubStore.getState();
      expect(state.connectionMode).toBe('relay');
      expect(state.effectiveServerUrl).toBe('https://hub.example.com/api/v1/relay/server-1');
    });
  });

  describe('signOut', () => {
    it('clears all hub state', () => {
      useHubStore.setState({
        hubUrl: 'https://hub.example.com',
        session: {
          accessToken: 'test-token',
          refreshToken: 'test-refresh',
          expiresAt: Date.now() + 3600000,
          userId: 'user-123'
        },
        servers: [
          {
            serverId: 'server-1',
            serverName: 'Test',
            version: '1.0.0',
            status: 'online' as const,
            hostname: '192.168.1.100:8096',
            capabilities: []
          }
        ],
        activeServerId: 'server-1',
        effectiveServerUrl: 'http://192.168.1.100:8096'
      });

      const { signOut } = useHubStore.getState();
      signOut();

      const state = useHubStore.getState();
      expect(state.hubUrl).toBeNull();
      expect(state.session).toBeNull();
      expect(state.servers).toEqual([]);
      expect(state.activeServerId).toBeNull();
      expect(state.effectiveServerUrl).toBe('');
    });
  });
});
