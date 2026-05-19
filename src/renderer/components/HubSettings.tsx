import React, { useState, useEffect } from 'react';
import { useHubStore } from '../../store/hubStore';

export const HubSettings: React.FC = () => {
  const {
    hubUrl,
    session,
    servers,
    activeServerId,
    connectionMode,
    isLoading,
    error,
    effectiveServerUrl,
    signIn,
    signOut,
    fetchServers,
    setActiveServer,
    setConnectionMode,
    setHubUrl,
    restoreSession
  } = useHubStore();

  const [hubUrlInput, setHubUrlInput] = useState(hubUrl || '');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [localError, setLocalError] = useState<string | null>(null);

  useEffect(() => {
    // Try to restore hub session on mount
    restoreSession();
  }, [restoreSession]);

  const handleHubUrlSave = () => {
    if (hubUrlInput.trim()) {
      setHubUrl(hubUrlInput.trim());
      setLocalError(null);
    }
  };

  const handleSignIn = async () => {
    if (!hubUrl) {
      setLocalError('Please configure hub URL first');
      return;
    }
    if (!username.trim() || !password.trim()) {
      setLocalError('Please enter username and password');
      return;
    }

    setLocalError(null);
    await signIn(username, password);
    // Error state is updated by the store
    if (!useHubStore.getState().error) {
      setUsername('');
      setPassword('');
    }
  };

  const handleSignOut = () => {
    signOut();
    setUsername('');
    setPassword('');
    setLocalError(null);
  };

  const displayError = localError || error;

  return (
    <div className="settings-view">
      <h1 className="section-title">Hub Mode</h1>

      <div className="settings-section">
        <h2 className="settings-section-title">Hub Configuration</h2>

        <div className="setting-item">
          <div className="setting-label">
            <span>Hub URL</span>
            <span className="setting-description">
              {hubUrl || 'Not configured'}
            </span>
          </div>
          <div className="setting-input-group">
            <input
              type="url"
              value={hubUrlInput}
              onChange={(e) => setHubUrlInput(e.target.value)}
              placeholder="https://hub.example.com"
              className="setting-input"
              disabled={!!session}
            />
            {!session && (
              <button
                className="play-button"
                onClick={handleHubUrlSave}
                disabled={!hubUrlInput.trim()}
              >
                Save
              </button>
            )}
          </div>
        </div>

        {hubUrl && !session && (
          <div className="setting-item">
            <div className="setting-label">
              <span>Sign in to Hub</span>
            </div>
            <div className="hub-login-form">
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Username"
                className="setting-input"
                autoComplete="username"
              />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Password"
                className="setting-input"
                autoComplete="current-password"
              />
              <button
                className="play-button"
                onClick={handleSignIn}
                disabled={isLoading || !username.trim() || !password.trim()}
              >
                {isLoading ? 'Signing in...' : 'Sign In'}
              </button>
            </div>
          </div>
        )}

        {session && (
          <div className="setting-item">
            <div className="setting-label">
              <span>Hub Status</span>
              <span className="setting-description">Signed in</span>
            </div>
            <button
              className="play-button"
              onClick={handleSignOut}
              style={{ background: '#ef4444' }}
            >
              Sign Out
            </button>
          </div>
        )}

        {displayError && (
          <div className="setting-item">
            <div className="error-message">{displayError}</div>
          </div>
        )}
      </div>

      {session && servers.length > 0 && (
        <>
          <div className="settings-section">
            <h2 className="settings-section-title">Claimed Servers</h2>

            <div className="server-list">
              {servers.map((server) => (
                <div
                  key={server.serverId}
                  className={`server-item ${server.serverId === activeServerId ? 'active' : ''}`}
                  onClick={() => setActiveServer(server.serverId)}
                >
                  <div className="server-info">
                    <span className="server-name">{server.serverName}</span>
                    <span className="server-version">v{server.version}</span>
                    <span className={`server-status status-${server.status}`}>
                      {server.status}
                    </span>
                  </div>
                  {server.serverId === activeServerId && (
                    <span className="active-indicator">✓</span>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div className="settings-section">
            <h2 className="settings-section-title">Connection Mode</h2>

            <div className="setting-item">
              <div className="connection-mode-toggle">
                <button
                  className={`mode-button ${connectionMode === 'direct' ? 'active' : ''}`}
                  onClick={() => setConnectionMode('direct')}
                >
                  Direct
                </button>
                <button
                  className={`mode-button ${connectionMode === 'relay' ? 'active' : ''}`}
                  onClick={() => setConnectionMode('relay')}
                >
                  Relay
                </button>
              </div>
              <span className="setting-description">
                {connectionMode === 'direct'
                  ? 'Connect directly to server via LAN'
                  : 'Route traffic through hub relay'}
              </span>
            </div>

            <div className="setting-item">
              <div className="setting-label">
                <span>Effective Server URL</span>
              </div>
              <code className="effective-url">{effectiveServerUrl}</code>
            </div>
          </div>
        </>
      )}

      {session && servers.length === 0 && !isLoading && (
        <div className="settings-section">
          <div className="info-message">
            No servers found. Make sure your servers are paired with this hub.
          </div>
          <button className="play-button" onClick={fetchServers}>
            Refresh Servers
          </button>
        </div>
      )}
    </div>
  );
};

export default HubSettings;
