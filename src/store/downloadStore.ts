/**
 * Download Store — Zustand store for download state management
 *
 * Manages download queue state, progress tracking,
 * pause/resume/cancel actions, and persistence.
 */

import { create } from 'zustand';
import downloadService, {
  DownloadItem,
  DownloadQuality
} from '../services/DownloadService';
import { MediaItem } from '../renderer/utils/api';

interface DownloadState {
  // State
  downloads: DownloadItem[];
  isLoading: boolean;
  error: string | null;
  totalStorageUsed: number;

  // Actions
  loadDownloads: () => void;
  addDownload: (mediaItem: MediaItem, quality?: DownloadQuality) => Promise<void>;
  pauseDownload: (downloadId: string) => void;
  resumeDownload: (downloadId: string) => void;
  cancelDownload: (downloadId: string) => Promise<void>;
  removeDownload: (downloadId: string) => Promise<void>;
  retryDownload: (downloadId: string) => void;
  clearCompleted: () => Promise<void>;
  clearAll: () => Promise<void>;
  isItemDownloaded: (mediaItemId: string) => boolean;
  getDownloadedItem: (mediaItemId: string) => DownloadItem | null;
  refreshStorageUsage: () => void;
}

/**
 * Create the downloads store
 */
export const useDownloadStore = create<DownloadState>((set, get) => ({
  downloads: [],
  isLoading: false,
  error: null,
  totalStorageUsed: 0,

  /**
   * Load downloads from service
   */
  loadDownloads: () => {
    const downloads = downloadService.getAllDownloads();
    const totalStorageUsed = downloadService.getTotalStorageUsed();
    set({ downloads, totalStorageUsed });
  },

  /**
   * Add a new download to the queue
   */
  addDownload: async (mediaItem: MediaItem, quality: DownloadQuality = 'high') => {
    set({ isLoading: true, error: null });

    try {
      // Check if already downloaded
      const existing = downloadService.isMediaDownloaded(mediaItem.Id);
      if (existing) {
        set({ error: 'This item is already downloaded', isLoading: false });
        return;
      }

      const downloadItem = await downloadService.addToQueue(mediaItem, quality);
      set((state) => ({
        downloads: [...state.downloads.filter(d => d.id !== downloadItem.id), downloadItem],
        isLoading: false
      }));
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to add download',
        isLoading: false
      });
    }
  },

  /**
   * Pause a download
   */
  pauseDownload: (downloadId: string) => {
    downloadService.pauseDownload(downloadId);
    const item = downloadService.getDownload(downloadId);
    if (item) {
      set((state) => ({
        downloads: state.downloads.map(d => d.id === downloadId ? item : d)
      }));
    }
  },

  /**
   * Resume a paused download
   */
  resumeDownload: (downloadId: string) => {
    downloadService.resumeDownload(downloadId);
    const item = downloadService.getDownload(downloadId);
    if (item) {
      set((state) => ({
        downloads: state.downloads.map(d => d.id === downloadId ? item : d)
      }));
    }
  },

  /**
   * Cancel and remove a download
   */
  cancelDownload: async (downloadId: string) => {
    await downloadService.cancelDownload(downloadId);
    set((state) => ({
      downloads: state.downloads.filter(d => d.id !== downloadId)
    }));
    get().refreshStorageUsage();
  },

  /**
   * Remove a completed download
   */
  removeDownload: async (downloadId: string) => {
    await downloadService.removeDownload(downloadId);
    set((state) => ({
      downloads: state.downloads.filter(d => d.id !== downloadId)
    }));
    get().refreshStorageUsage();
  },

  /**
   * Retry a failed download
   */
  retryDownload: (downloadId: string) => {
    const item = downloadService.getDownload(downloadId);
    if (item && item.status === 'error') {
      // Re-add to queue (cancel/removal removes from queue, so we need to re-add)
      downloadService.addToQueue(
        { Id: item.mediaItemId, Name: item.title, Type: '' } as MediaItem,
        item.quality
      );
      get().loadDownloads();
    }
  },

  /**
   * Clear all completed downloads from the list
   */
  clearCompleted: async () => {
    const state = get();
    const completedIds = state.downloads
      .filter(d => d.status === 'completed')
      .map(d => d.id);

    for (const id of completedIds) {
      await downloadService.removeDownload(id);
    }

    set((state) => ({
      downloads: state.downloads.filter(d => d.status !== 'completed')
    }));
    get().refreshStorageUsage();
  },

  /**
   * Clear all downloads
   */
  clearAll: async () => {
    const state = get();
    for (const download of state.downloads) {
      await downloadService.cancelDownload(download.id);
    }
    set({ downloads: [], totalStorageUsed: 0 });
  },

  /**
   * Check if a media item is already downloaded
   */
  isItemDownloaded: (mediaItemId: string) => {
    const state = get();
    return state.downloads.some(
      d => d.mediaItemId === mediaItemId && d.status === 'completed'
    );
  },

  /**
   * Get the downloaded item for a media ID if it exists
   */
  getDownloadedItem: (mediaItemId: string) => {
    const state = get();
    return state.downloads.find(
      d => d.mediaItemId === mediaItemId && d.status === 'completed'
    ) || null;
  },

  /**
   * Refresh storage usage calculation
   */
  refreshStorageUsage: () => {
    const totalStorageUsed = downloadService.getTotalStorageUsed();
    set({ totalStorageUsed });
  }
}));

export default useDownloadStore;
