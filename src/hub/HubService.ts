export interface HubSession {
  accessToken: string;
  refreshToken: string;
  expiresAt: number; // Unix timestamp ms
  userId: string;
}

export interface HubServer {
  serverId: string;
  serverName: string;
  version: string;
  status: 'online' | 'offline';
  hostname: string;
  relayHostname?: string;
  capabilities: string[];
}

export interface HubService {
  signIn(hubUrl: string, username: string, password: string): Promise<HubSession>;
  refresh(refreshToken: string): Promise<HubSession>;
  listServers(session: HubSession): Promise<HubServer[]>;
  signOut(): void;
}

const hubService: HubService = {
  async signIn(hubUrl: string, username: string, password: string): Promise<HubSession> {
    const res = await fetch(`${hubUrl}/api/v1/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });
    if (!res.ok) throw new Error(`Hub auth failed: ${res.status}`);
    const data = await res.json() as {
      access_token: string;
      refresh_token: string;
      expires_in: number;
      user_id: string;
    };
    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresAt: Date.now() + data.expires_in * 1000,
      userId: data.user_id
    };
  },

  async refresh(refreshToken: string): Promise<HubSession> {
    const hubUrl = localStorage.getItem('hub_url');
    if (!hubUrl) throw new Error('Hub URL not configured');

    const res = await fetch(`${hubUrl}/api/v1/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh_token: refreshToken })
    });
    if (!res.ok) throw new Error(`Hub refresh failed: ${res.status}`);
    const data = await res.json() as {
      access_token: string;
      refresh_token: string;
      expires_in: number;
      user_id: string;
    };
    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresAt: Date.now() + data.expires_in * 1000,
      userId: data.user_id
    };
  },

  async listServers(session: HubSession): Promise<HubServer[]> {
    const hubUrl = localStorage.getItem('hub_url');
    if (!hubUrl) throw new Error('Hub URL not configured');

    const res = await fetch(`${hubUrl}/api/v1/me/servers`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${session.accessToken}`,
        'Content-Type': 'application/json'
      }
    });
    if (!res.ok) throw new Error(`List servers failed: ${res.status}`);
    const data = await res.json() as Array<{
      server_id: string;
      server_name: string;
      version: string;
      status: 'online' | 'offline';
      hostname: string;
      relay_hostname?: string;
      capabilities: string[];
    }>;
    return data.map(server => ({
      serverId: server.server_id,
      serverName: server.server_name,
      version: server.version,
      status: server.status,
      hostname: server.hostname,
      relayHostname: server.relay_hostname,
      capabilities: server.capabilities
    }));
  },

  signOut(): void {
    localStorage.removeItem('hub_session');
    localStorage.removeItem('hub_url');
  }
};

export default hubService;
