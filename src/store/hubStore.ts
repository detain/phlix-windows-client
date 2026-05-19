import { create } from 'zustand';
import hubService, { HubSession, HubServer } from '../hub/HubService';

interface HubState {
  hubUrl: string | null;
  session: HubSession | null;
  servers: HubServer[];
  activeServerId: string | null;
  connectionMode: 'direct' | 'relay';
  isLoading: boolean;
  error: string | null;

  // Computed
  effectiveServerUrl: string;

  // Actions
  signIn: (username: string, password: string) => Promise<void>;
  signOut: () => void;
  refreshSession: () => Promise<void>;
  fetchServers: () => Promise<void>;
  setActiveServer: (serverId: string) => void;
  setConnectionMode: (mode: 'direct' | 'relay') => void;
  setHubUrl: (url: string) => void;
  restoreSession: () => Promise<boolean>;
}

// Helper to compute effective server URL
function computeEffectiveUrl(
  servers: HubServer[],
  activeServerId: string | null,
  connectionMode: 'direct' | 'relay',
  hubUrl: string | null
): string {
  if (!activeServerId || servers.length === 0) {
    return hubUrl || '';
  }
  const activeServer = servers.find(s => s.serverId === activeServerId);
  if (!activeServer) return hubUrl || '';

  if (connectionMode === 'direct') {
    return `http://${activeServer.hostname}`;
  } else {
    // Relay mode - route through hub
    return `${hubUrl}/api/v1/relay/${activeServerId}`;
  }
}

export const useHubStore = create<HubState>((set, get) => ({
  hubUrl: null,
  session: null,
  servers: [],
  activeServerId: null,
  connectionMode: 'direct',
  isLoading: false,
  error: null,
  effectiveServerUrl: '',

  signIn: async (username: string, password: string) => {
    const { hubUrl } = get();
    if (!hubUrl) {
      set({ error: 'Hub URL not configured' });
      return;
    }

    set({ isLoading: true, error: null });
    try {
      const session = await hubService.signIn(hubUrl, username, password);
      const servers = await hubService.listServers(session);

      // Persist session and hub URL
      localStorage.setItem('hub_session', JSON.stringify(session));
      localStorage.setItem('hub_url', hubUrl);

      const activeServerId = servers.length > 0 ? servers[0].serverId : null;
      set({
        session,
        servers,
        activeServerId,
        isLoading: false,
        effectiveServerUrl: computeEffectiveUrl(servers, activeServerId, get().connectionMode, hubUrl)
      });
    } catch (err) {
      set({
        error: err instanceof Error ? err.message : 'Sign in failed',
        isLoading: false
      });
    }
  },

  signOut: () => {
    hubService.signOut();
    set({
      hubUrl: null,
      session: null,
      servers: [],
      activeServerId: null,
      effectiveServerUrl: '',
      error: null
    });
  },

  refreshSession: async () => {
    const { session, hubUrl } = get();
    if (!session?.refreshToken || !hubUrl) {
      set({ error: 'No refresh token available' });
      return;
    }

    set({ isLoading: true, error: null });
    try {
      const newSession = await hubService.refresh(session.refreshToken);
      localStorage.setItem('hub_session', JSON.stringify(newSession));
      set({ session: newSession, isLoading: false });
    } catch (err) {
      set({
        error: err instanceof Error ? err.message : 'Session refresh failed',
        isLoading: false
      });
    }
  },

  fetchServers: async () => {
    const { session, hubUrl } = get();
    if (!session || !hubUrl) {
      set({ error: 'Not signed in to hub' });
      return;
    }

    set({ isLoading: true, error: null });
    try {
      const servers = await hubService.listServers(session);
      const activeServerId = servers.length > 0 ? servers[0].serverId : null;
      set({
        servers,
        activeServerId,
        isLoading: false,
        effectiveServerUrl: computeEffectiveUrl(servers, activeServerId, get().connectionMode, hubUrl)
      });
    } catch (err) {
      set({
        error: err instanceof Error ? err.message : 'Failed to fetch servers',
        isLoading: false
      });
    }
  },

  setActiveServer: (serverId: string) => {
    const { servers, connectionMode, hubUrl } = get();
    set({
      activeServerId: serverId,
      effectiveServerUrl: computeEffectiveUrl(servers, serverId, connectionMode, hubUrl)
    });
  },

  setConnectionMode: (mode: 'direct' | 'relay') => {
    const { servers, activeServerId, hubUrl } = get();
    set({
      connectionMode: mode,
      effectiveServerUrl: computeEffectiveUrl(servers, activeServerId, mode, hubUrl)
    });
  },

  setHubUrl: (url: string) => {
    const { servers, activeServerId, connectionMode } = get();
    localStorage.setItem('hub_url', url);
    set({
      hubUrl: url,
      effectiveServerUrl: computeEffectiveUrl(servers, activeServerId, connectionMode, url)
    });
  },

  restoreSession: async () => {
    const hubUrl = localStorage.getItem('hub_url');
    const sessionJson = localStorage.getItem('hub_session');

    if (!hubUrl || !sessionJson) {
      return false;
    }

    try {
      const session = JSON.parse(sessionJson) as HubSession;

      // Check if session is expired
      if (session.expiresAt < Date.now()) {
        // Try to refresh
        try {
          const newSession = await hubService.refresh(session.refreshToken);
          localStorage.setItem('hub_session', JSON.stringify(newSession));
          set({ session: newSession, hubUrl });
        } catch {
          // Refresh failed, need to re-login
          return false;
        }
      } else {
        set({ session, hubUrl });
      }

      // Fetch servers
      const servers = await hubService.listServers(session || JSON.parse(sessionJson));
      const activeServerId = servers.length > 0 ? servers[0].serverId : null;

      set({
        servers,
        activeServerId,
        effectiveServerUrl: computeEffectiveUrl(servers, activeServerId, get().connectionMode, hubUrl)
      });

      return true;
    } catch {
      return false;
    }
  }
}));
