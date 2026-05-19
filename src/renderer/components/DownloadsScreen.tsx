/**
 * Downloads Screen — UI for managing offline downloads
 *
 * Displays download queue with progress, allows pause/resume/cancel,
 * shows storage usage, and provides access to offline playback.
 */

import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDownloadStore } from '../../store/downloadStore';
import { DownloadItem, DownloadStatus } from '../../services/DownloadService';
import './DownloadsScreen.css';

const STATUS_LABELS: Record<DownloadStatus, string> = {
  queued: 'Queued',
  downloading: 'Downloading',
  paused: 'Paused',
  completed: 'Completed',
  error: 'Error'
};

const STATUS_ICONS: Record<DownloadStatus, string> = {
  queued: '⏳',
  downloading: '⬇️',
  paused: '⏸️',
  completed: '✅',
  error: '❌'
};

/**
 * Format bytes to human readable string
 */
function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

export const DownloadsScreen: React.FC = () => {
  const navigate = useNavigate();
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  const {
    downloads,
    totalStorageUsed,
    isLoading,
    error,
    loadDownloads,
    pauseDownload,
    resumeDownload,
    cancelDownload,
    removeDownload,
    retryDownload,
    clearCompleted
  } = useDownloadStore();

  // Listen for online/offline events
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Listen for download updates
  useEffect(() => {
    const handleUpdate = (_event: CustomEvent<DownloadItem>) => {
      loadDownloads();
    };

    const handleRemove = () => {
      loadDownloads();
    };

    window.addEventListener('download-update', handleUpdate as EventListener);
    window.addEventListener('download-remove', handleRemove as EventListener);

    // Initial load
    loadDownloads();

    return () => {
      window.removeEventListener('download-update', handleUpdate as EventListener);
      window.removeEventListener('download-remove', handleRemove as EventListener);
    };
  }, [loadDownloads]);

  // Group downloads by status
  const activeDownloads = downloads.filter(
    d => d.status === 'downloading' || d.status === 'queued'
  );
  const pausedDownloads = downloads.filter(d => d.status === 'paused');
  const completedDownloads = downloads.filter(d => d.status === 'completed');
  const errorDownloads = downloads.filter(d => d.status === 'error');

  const handlePlayOffline = (item: DownloadItem) => {
    if (item.status === 'completed') {
      navigate(`/player/${item.mediaItemId}?offline=true&localPath=${encodeURIComponent(item.localPath || '')}`);
    }
  };

  return (
    <div className="downloads-screen">
      <div className="downloads-header">
        <h1 className="downloads-title">Downloads</h1>
        <div className="downloads-status">
          {!isOnline && (
            <span className="offline-badge">Offline Mode</span>
          )}
          <span className="storage-used">
            Using {formatBytes(totalStorageUsed)}
          </span>
        </div>
      </div>

      {error && (
        <div className="downloads-error">
          {error}
          <button onClick={() => useDownloadStore.setState({ error: null })}>Dismiss</button>
        </div>
      )}

      {isLoading && <div className="downloads-loading">Loading...</div>}

      {/* Active Downloads */}
      {activeDownloads.length > 0 && (
        <section className="downloads-section">
          <h2 className="section-title">
            {STATUS_ICONS.downloading} Active Downloads ({activeDownloads.length})
          </h2>
          <div className="downloads-list">
            {activeDownloads.map(item => (
              <DownloadCard
                key={item.id}
                item={item}
                onPause={() => pauseDownload(item.id)}
                onResume={() => resumeDownload(item.id)}
                onCancel={() => cancelDownload(item.id)}
                onRemove={() => removeDownload(item.id)}
                onRetry={() => retryDownload(item.id)}
                onPlay={() => handlePlayOffline(item)}
              />
            ))}
          </div>
        </section>
      )}

      {/* Paused Downloads */}
      {pausedDownloads.length > 0 && (
        <section className="downloads-section">
          <h2 className="section-title">
            {STATUS_ICONS.paused} Paused ({pausedDownloads.length})
          </h2>
          <div className="downloads-list">
            {pausedDownloads.map(item => (
              <DownloadCard
                key={item.id}
                item={item}
                onPause={() => pauseDownload(item.id)}
                onResume={() => resumeDownload(item.id)}
                onCancel={() => cancelDownload(item.id)}
                onRemove={() => removeDownload(item.id)}
                onRetry={() => retryDownload(item.id)}
                onPlay={() => handlePlayOffline(item)}
              />
            ))}
          </div>
        </section>
      )}

      {/* Error Downloads */}
      {errorDownloads.length > 0 && (
        <section className="downloads-section">
          <h2 className="section-title">
            {STATUS_ICONS.error} Failed ({errorDownloads.length})
          </h2>
          <div className="downloads-list">
            {errorDownloads.map(item => (
              <DownloadCard
                key={item.id}
                item={item}
                onPause={() => pauseDownload(item.id)}
                onResume={() => resumeDownload(item.id)}
                onCancel={() => cancelDownload(item.id)}
                onRemove={() => removeDownload(item.id)}
                onRetry={() => retryDownload(item.id)}
                onPlay={() => handlePlayOffline(item)}
              />
            ))}
          </div>
        </section>
      )}

      {/* Completed Downloads */}
      {completedDownloads.length > 0 && (
        <section className="downloads-section">
          <div className="section-header">
            <h2 className="section-title">
              {STATUS_ICONS.completed} Completed ({completedDownloads.length})
            </h2>
            <button
              className="clear-completed-btn"
              onClick={() => clearCompleted()}
            >
              Clear Completed
            </button>
          </div>
          <div className="downloads-list">
            {completedDownloads.map(item => (
              <DownloadCard
                key={item.id}
                item={item}
                onPause={() => pauseDownload(item.id)}
                onResume={() => resumeDownload(item.id)}
                onCancel={() => cancelDownload(item.id)}
                onRemove={() => removeDownload(item.id)}
                onRetry={() => retryDownload(item.id)}
                onPlay={() => handlePlayOffline(item)}
              />
            ))}
          </div>
        </section>
      )}

      {/* Empty State */}
      {downloads.length === 0 && !isLoading && (
        <div className="downloads-empty">
          <div className="empty-icon">📥</div>
          <h2>No Downloads</h2>
          <p>Downloaded media will appear here for offline playback.</p>
        </div>
      )}
    </div>
  );
};

/**
 * Individual download card component
 */
interface DownloadCardProps {
  item: DownloadItem;
  onPause: () => void;
  onResume: () => void;
  onCancel: () => void;
  onRemove: () => void;
  onRetry: () => void;
  onPlay: () => void;
}

const DownloadCard: React.FC<DownloadCardProps> = ({
  item,
  onPause,
  onResume,
  onCancel,
  onRemove,
  onRetry,
  onPlay
}) => {
  return (
    <div className={`download-card status-${item.status}`}>
      <div className="download-card-info">
        <h3 className="download-card-title">{item.title}</h3>
        <div className="download-card-meta">
          <span className={`status-badge status-${item.status}`}>
            {STATUS_ICONS[item.status]} {STATUS_LABELS[item.status]}
          </span>
          {item.totalBytes > 0 && (
            <span className="download-size">
              {formatBytes(item.downloadedBytes)} / {formatBytes(item.totalBytes)}
            </span>
          )}
          {item.quality && (
            <span className="download-quality">{item.quality}</span>
          )}
        </div>
        {item.error && (
          <p className="download-error">{item.error}</p>
        )}
      </div>

      {/* Progress Bar */}
      {(item.status === 'downloading' || item.status === 'paused') && (
        <div className="download-progress">
          <div
            className="download-progress-bar"
            style={{ width: `${item.progress}%` }}
          />
        </div>
      )}

      <div className="download-card-actions">
        {item.status === 'downloading' && (
          <>
            <button
              className="action-btn pause-btn"
              onClick={onPause}
              title="Pause"
            >
              ⏸️
            </button>
            <button
              className="action-btn cancel-btn"
              onClick={onCancel}
              title="Cancel"
            >
              ✖️
            </button>
          </>
        )}

        {item.status === 'queued' && (
          <button
            className="action-btn cancel-btn"
            onClick={onCancel}
            title="Cancel"
          >
            ✖️
          </button>
        )}

        {item.status === 'paused' && (
          <>
            <button
              className="action-btn resume-btn"
              onClick={onResume}
              title="Resume"
            >
              ▶️
            </button>
            <button
              className="action-btn cancel-btn"
              onClick={onCancel}
              title="Cancel"
            >
              ✖️
            </button>
          </>
        )}

        {item.status === 'completed' && (
          <>
            <button
              className="action-btn play-btn"
              onClick={onPlay}
              title="Play Offline"
            >
              ▶️ Play
            </button>
            <button
              className="action-btn remove-btn"
              onClick={onRemove}
              title="Delete"
            >
              🗑️
            </button>
          </>
        )}

        {item.status === 'error' && (
          <>
            <button
              className="action-btn retry-btn"
              onClick={onRetry}
              title="Retry"
            >
              🔄 Retry
            </button>
            <button
              className="action-btn remove-btn"
              onClick={onRemove}
              title="Remove"
            >
              🗑️
            </button>
          </>
        )}
      </div>
    </div>
  );
};

export default DownloadsScreen;
