import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import hubService from '../../../src/hub/HubService';

// Mock fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('HubService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.removeItem('hub_url');
    localStorage.removeItem('hub_session');
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('signIn', () => {
    it('test_signIn_returns_session', async () => {
      const mockSession = {
        access_token: 'test-access-token',
        refresh_token: 'test-refresh-token',
        expires_in: 3600,
        user_id: 'user-123'
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockSession
      });

      const result = await hubService.signIn('https://hub.example.com', 'testuser', 'password123');

      expect(result).toEqual({
        accessToken: 'test-access-token',
        refreshToken: 'test-refresh-token',
        expiresAt: expect.any(Number),
        userId: 'user-123'
      });
      expect(result.expiresAt).toBeGreaterThan(Date.now());
      expect(mockFetch).toHaveBeenCalledWith(
        'https://hub.example.com/api/v1/auth/login',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username: 'testuser', password: 'password123' })
        }
      );
    });

    it('test_signIn_throws_on_failure', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401
      });

      await expect(
        hubService.signIn('https://hub.example.com', 'testuser', 'wrongpassword')
      ).rejects.toThrow('Hub auth failed: 401');
    });
  });

  describe('listServers', () => {
    it('test_listServers_returns_array', async () => {
      const mockSession = {
        accessToken: 'test-access-token',
        refreshToken: 'test-refresh-token',
        expiresAt: Date.now() + 3600000,
        userId: 'user-123'
      };

      localStorage.setItem('hub_url', 'https://hub.example.com');

      const mockServers = [
        {
          server_id: 'server-1',
          server_name: 'Living Room',
          version: '1.0.0',
          status: 'online',
          hostname: '192.168.1.100:8096',
          relay_hostname: 'relay.example.com',
          capabilities: ['streaming', 'transcoding']
        },
        {
          server_id: 'server-2',
          server_name: 'Bedroom',
          version: '1.0.0',
          status: 'offline',
          hostname: '192.168.1.101:8096',
          capabilities: ['streaming']
        }
      ];

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockServers
      });

      const result = await hubService.listServers(mockSession);

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({
        serverId: 'server-1',
        serverName: 'Living Room',
        version: '1.0.0',
        status: 'online',
        hostname: '192.168.1.100:8096',
        relayHostname: 'relay.example.com',
        capabilities: ['streaming', 'transcoding']
      });
      expect(result[1].status).toBe('offline');
    });

    it('test_listServers_throws_when_not_configured', async () => {
      const mockSession = {
        accessToken: 'test-access-token',
        refreshToken: 'test-refresh-token',
        expiresAt: Date.now() + 3600000,
        userId: 'user-123'
      };

      localStorage.removeItem('hub_url');

      await expect(hubService.listServers(mockSession)).rejects.toThrow('Hub URL not configured');
    });
  });

  describe('refresh', () => {
    it('test_refresh_renews_token', async () => {
      const mockSession = {
        accessToken: 'old-access-token',
        refreshToken: 'test-refresh-token',
        expiresAt: Date.now() + 3600000,
        userId: 'user-123'
      };

      localStorage.setItem('hub_url', 'https://hub.example.com');

      const newSessionResponse = {
        access_token: 'new-access-token',
        refresh_token: 'new-refresh-token',
        expires_in: 7200,
        user_id: 'user-123'
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => newSessionResponse
      });

      const result = await hubService.refresh(mockSession.refreshToken);

      expect(result.accessToken).toBe('new-access-token');
      expect(result.refreshToken).toBe('new-refresh-token');
      expect(result.expiresAt).toBeGreaterThan(Date.now() + 7000000); // At least 7000 seconds in future
    });
  });

  describe('signOut', () => {
    it('test_signOut_clears_storage', () => {
      localStorage.setItem('hub_url', 'https://hub.example.com');
      localStorage.setItem('hub_session', JSON.stringify({ test: 'session' }));

      hubService.signOut();

      expect(localStorage.getItem('hub_url')).toBeNull();
      expect(localStorage.getItem('hub_session')).toBeNull();
    });
  });
});
