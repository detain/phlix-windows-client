import React, { useState, useCallback } from 'react';
import { useSyncPlayStore } from '../../store/syncplayStore';
import './SyncPlayPanel.css';

interface SyncPlayPanelProps {
  onClose: () => void;
}

export const SyncPlayPanel: React.FC<SyncPlayPanelProps> = ({
  onClose,
}) => {
  const [groupName, setGroupName] = useState('');
  const [password, setPassword] = useState('');
  const [joinGroupId, setJoinGroupId] = useState('');

  const {
    isConnected,
    currentGroup,
    isCreatingGroup,
    isJoiningGroup,
    error,
    timeOffset,
    isTimeSyncStable,
    createGroup,
    joinGroup,
    leaveGroup,
    setPanelOpen,
    clearError,
  } = useSyncPlayStore();

  const handleCreateGroup = useCallback(() => {
    if (!groupName.trim()) return;
    createGroup(groupName.trim(), password || undefined);
  }, [groupName, password, createGroup]);

  const handleJoinGroup = useCallback(() => {
    if (!joinGroupId.trim()) return;
    joinGroup(joinGroupId.trim(), password || undefined);
  }, [joinGroupId, password, joinGroup]);

  const handleLeaveGroup = useCallback(() => {
    leaveGroup();
  }, [leaveGroup]);

  const handleClose = useCallback(() => {
    setPanelOpen(false);
    onClose();
  }, [setPanelOpen, onClose]);

  const formatTimeOffset = (offset: number): string => {
    const sign = offset >= 0 ? '+' : '';
    return `${sign}${offset}ms`;
  };

  return (
    <div className="syncplay-panel">
      <div className="syncplay-panel-header">
        <h3>SyncPlay</h3>
        <button className="syncplay-close-btn" onClick={handleClose}>
          ×
        </button>
      </div>

      <div className="syncplay-panel-body">
        {/* Connection Status */}
        <div className="syncplay-status">
          <div className={`syncplay-status-indicator ${isConnected ? 'connected' : 'disconnected'}`}>
            <span className="syncplay-status-dot" />
            <span>{isConnected ? 'Connected' : 'Disconnected'}</span>
          </div>
          {isConnected && (
            <div className="syncplay-time-sync-info">
              <span>Offset: {formatTimeOffset(timeOffset)}</span>
              <span className={`syncplay-sync-status ${isTimeSyncStable ? 'stable' : 'syncing'}`}>
                {isTimeSyncStable ? 'Synced' : 'Syncing...'}
              </span>
            </div>
          )}
        </div>

        {/* Error Display */}
        {error && (
          <div className="syncplay-error">
            <span>{error.message}</span>
            <button onClick={clearError}>Dismiss</button>
          </div>
        )}

        {/* Not in Group - Show Create/Join options */}
        {!currentGroup && (
          <div className="syncplay-group-options">
            {/* Create Group */}
            <div className="syncplay-group-action">
              <h4>Create Group</h4>
              <input
                type="text"
                placeholder="Group name"
                value={groupName}
                onChange={(e) => setGroupName(e.target.value)}
                disabled={isCreatingGroup}
              />
              <input
                type="password"
                placeholder="Password (optional)"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={isCreatingGroup}
              />
              <button
                className="syncplay-btn primary"
                onClick={handleCreateGroup}
                disabled={!groupName.trim() || isCreatingGroup}
              >
                {isCreatingGroup ? 'Creating...' : 'Create Group'}
              </button>
            </div>

            {/* Join Group */}
            <div className="syncplay-group-action">
              <h4>Join Group</h4>
              <input
                type="text"
                placeholder="Group ID"
                value={joinGroupId}
                onChange={(e) => setJoinGroupId(e.target.value)}
                disabled={isJoiningGroup}
              />
              <input
                type="password"
                placeholder="Password (optional)"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={isJoiningGroup}
              />
              <button
                className="syncplay-btn primary"
                onClick={handleJoinGroup}
                disabled={!joinGroupId.trim() || isJoiningGroup}
              >
                {isJoiningGroup ? 'Joining...' : 'Join Group'}
              </button>
            </div>
          </div>
        )}

        {/* In Group - Show Members and Controls */}
        {currentGroup && (
          <div className="syncplay-group-view">
            <div className="syncplay-group-info">
              <h4>{currentGroup.name}</h4>
              <span className="syncplay-group-id">ID: {currentGroup.id}</span>
            </div>

            {/* Members List */}
            <div className="syncplay-members">
              <h4>Members ({currentGroup.members.length})</h4>
              <ul>
                {currentGroup.members.map((member) => (
                  <li key={member.id} className={member.isHost ? 'host' : ''}>
                    <span className="syncplay-member-name">
                      {member.name}
                      {member.isHost && ' (Host)'}
                    </span>
                    <span className="syncplay-member-status">
                      {member.isPlaying !== undefined && (
                        <span className={`syncplay-playing-indicator ${member.isPlaying ? 'playing' : 'paused'}`}>
                          {member.isPlaying ? '▶' : '⏸'}
                        </span>
                      )}
                    </span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Playback State */}
            <div className="syncplay-playback-state">
              <span>
                {currentGroup.playbackState === 'playing' ? '▶ Playing' :
                 currentGroup.playbackState === 'paused' ? '⏸ Paused' : '⏹ Stopped'}
              </span>
              {currentGroup.currentMediaId && (
                <span className="syncplay-media-info">
                  Media: {currentGroup.currentMediaId}
                </span>
              )}
            </div>

            {/* Leave Group Button */}
            <button className="syncplay-btn danger" onClick={handleLeaveGroup}>
              Leave Group
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default SyncPlayPanel;
