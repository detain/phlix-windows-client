import axios, { AxiosInstance } from 'axios';
import api from '../renderer/utils/api';
import { useHubStore } from '../store/hubStore';

/**
 * Hub-aware API client wrapper
 *
 * When a hub session is active, routes all API calls via the effective server URL
 * (direct-LAN or hub-relay) and injects appropriate authorization headers.
 *
 * - Direct mode: calls server hostname directly
 * - Relay mode: calls ${hubUrl}/api/v1/relay/${serverId}/${path}
 * - Always injects Authorization: Bearer <hub-session-accessToken>
 * - In relay mode, injects X-Server-Id: <serverId>
 */
class HubAwareClient {
  private hubClient: AxiosInstance | null = null;

  /**
   * Get the hub-aware axios instance
   * Creates a new instance if hub session is active and base URL changed
   */
  private getHubClient(): AxiosInstance | null {
    const { session, activeServerId, effectiveServerUrl, hubUrl, connectionMode } = useHubStore.getState();

    if (!session || !effectiveServerUrl) {
      return null;
    }

    // Determine base URL based on connection mode
    let baseUrl: string;
    if (connectionMode === 'relay' && hubUrl && activeServerId) {
      // Relay mode: proxy through hub
      baseUrl = `${hubUrl}/api/v1/relay/${activeServerId}`;
    } else {
      // Direct mode: call server directly
      baseUrl = `${effectiveServerUrl}/api/v1`;
    }

    // Create new client if needed
    if (!this.hubClient || this.hubClient.defaults.baseURL !== baseUrl) {
      this.hubClient = axios.create({
        baseURL: baseUrl,
        timeout: 30000,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.accessToken}`,
          ...(connectionMode === 'relay' && activeServerId ? { 'X-Server-Id': activeServerId } : {})
        }
      });
    } else {
      // Update headers in case session changed
      this.hubClient.defaults.headers.common['Authorization'] = `Bearer ${session.accessToken}`;
      if (connectionMode === 'relay' && activeServerId) {
        this.hubClient.defaults.headers.common['X-Server-Id'] = activeServerId;
      }
    }

    return this.hubClient;
  }

  /**
   * Check if hub mode is active
   */
  isHubMode(): boolean {
    const { session } = useHubStore.getState();
    return session !== null;
  }

  /**
   * Get effective server URL for display purposes
   */
  getEffectiveUrl(): string {
    const { effectiveServerUrl } = useHubStore.getState();
    return effectiveServerUrl;
  }

  /**
   * Make a hub-aware request
   * Falls back to regular API client if not in hub mode
   */
  async request<T>(
    method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH',
    path: string,
    data?: unknown
  ): Promise<T> {
    const hubClient = this.getHubClient();

    if (hubClient) {
      const response = await hubClient.request<T>({ method, url: path, data });
      return response.data;
    }

    // Fallback to regular API client
    return api.request<T>(method, path, data);
  }

  /**
   * Convenience methods matching ApiClient interface
   */
  async get<T>(path: string): Promise<T> {
    return this.request<T>('GET', path);
  }

  async post<T>(path: string, data?: unknown): Promise<T> {
    return this.request<T>('POST', path, data);
  }

  async put<T>(path: string, data?: unknown): Promise<T> {
    return this.request<T>('PUT', path, data);
  }

  async delete<T>(path: string): Promise<T> {
    return this.request<T>('DELETE', path);
  }
}

export const hubAwareClient = new HubAwareClient();
export default hubAwareClient;
