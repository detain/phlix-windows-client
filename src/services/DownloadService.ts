/**
 * Download Service for offline media downloads
 *
 * Manages download queue, background downloads with progress tracking,
 * resume capability via range requests, and storage in the user's Documents folder.
 */

import { MediaItem } from '../renderer/utils/api';
import hubAwareClient from '../api/hubAwareClient';

export type DownloadStatus = 'queued' | 'downloading' | 'paused' | 'completed' | 'error';
export type DownloadQuality = 'low' | 'medium' | 'high' | 'original';

export interface DownloadItem {
  id: string;
  mediaItemId: string;
  title: string;
  status: DownloadStatus;
  quality: DownloadQuality;
  progress: number; // 0-100
  downloadedBytes: number;
  totalBytes: number;
  localPath: string | null;
  error: string | null;
  startedAt: number | null;
  completedAt: number | null;
  qualityProfile: string;
}

/**
 * Download URL response from the server
 */
export interface DownloadUrlResponse {
  url: string;
  filename: string;
  size: number;
  container: string;
}

/**
 * Download service class that handles download queue management
 * and actual download operations via Electron's download API.
 */
class DownloadService {
  private downloadQueue: Map<string, DownloadItem> = new Map();
  private activeDownloads: Map<string, AbortController> = new Map();

  constructor() {
    // Restore queue from localStorage on init
    this.restoreQueue();
  }

  /**
   * Get download info for a media item from the server
   */
  async getDownloadInfo(mediaItemId: string, quality: DownloadQuality = 'high'): Promise<DownloadUrlResponse> {
    // Use the API client that respects hub mode
    return hubAwareClient.get<DownloadUrlResponse>(`/Media/${mediaItemId}/Download?quality=${quality}`);
  }

  /**
   * Add a media item to the download queue
   */
  async addToQueue(mediaItem: MediaItem, quality: DownloadQuality = 'high'): Promise<DownloadItem> {
    const id = `download-${mediaItem.Id}-${Date.now()}`;

    const downloadItem: DownloadItem = {
      id,
      mediaItemId: mediaItem.Id,
      title: mediaItem.Name,
      status: 'queued',
      quality,
      progress: 0,
      downloadedBytes: 0,
      totalBytes: 0,
      localPath: null,
      error: null,
      startedAt: null,
      completedAt: null,
      qualityProfile: quality
    };

    this.downloadQueue.set(id, downloadItem);
    this.persistQueue();
    this.emitUpdate(downloadItem);

    // Start download if no active downloads
    if (this.activeDownloads.size === 0) {
      this.processQueue();
    }

    return downloadItem;
  }

  /**
   * Pause a download
   */
  pauseDownload(downloadId: string): void {
    const controller = this.activeDownloads.get(downloadId);
    if (controller) {
      controller.abort();
      this.activeDownloads.delete(downloadId);
    }

    const item = this.downloadQueue.get(downloadId);
    if (item && item.status === 'downloading') {
      item.status = 'paused';
      item.startedAt = null;
      this.downloadQueue.set(downloadId, item);
      this.persistQueue();
      this.emitUpdate(item);
    }
  }

  /**
   * Resume a paused download
   */
  resumeDownload(downloadId: string): void {
    const item = this.downloadQueue.get(downloadId);
    if (item && item.status === 'paused') {
      item.status = 'queued';
      this.downloadQueue.set(downloadId, item);
      this.persistQueue();
      this.emitUpdate(item);
      this.processQueue();
    }
  }

  /**
   * Cancel a download and clean up partial data
   */
  async cancelDownload(downloadId: string): Promise<void> {
    const controller = this.activeDownloads.get(downloadId);
    if (controller) {
      controller.abort();
      this.activeDownloads.delete(downloadId);
    }

    const item = this.downloadQueue.get(downloadId);
    if (item) {
      // If partially downloaded, clean up the file
      if (item.localPath && item.downloadedBytes > 0) {
        await this.deleteLocalFile(item.localPath);
      }
      this.downloadQueue.delete(downloadId);
      this.persistQueue();
      this.emitRemove(downloadId);
    }
  }

  /**
   * Remove a completed download
   */
  async removeDownload(downloadId: string): Promise<void> {
    const item = this.downloadQueue.get(downloadId);
    if (item) {
      if (item.localPath) {
        await this.deleteLocalFile(item.localPath);
      }
      this.downloadQueue.delete(downloadId);
      this.persistQueue();
      this.emitRemove(downloadId);
    }
  }

  /**
   * Delete local file (exposed for IPC to Electron main process)
   */
  async deleteLocalFile(localPath: string): Promise<void> {
    // This will be called via IPC to Electron main process
    // which has access to the file system
    if (window.electronAPI?.deleteFile) {
      await window.electronAPI.deleteFile(localPath);
    }
  }

  /**
   * Get all downloads
   */
  getAllDownloads(): DownloadItem[] {
    return Array.from(this.downloadQueue.values());
  }

  /**
   * Get download by ID
   */
  getDownload(id: string): DownloadItem | undefined {
    return this.downloadQueue.get(id);
  }

  /**
   * Get downloads by status
   */
  getDownloadsByStatus(status: DownloadStatus): DownloadItem[] {
    return this.getAllDownloads().filter(d => d.status === status);
  }

  /**
   * Get total storage used by downloads
   */
  getTotalStorageUsed(): number {
    let total = 0;
    for (const item of this.downloadQueue.values()) {
      if (item.status === 'completed' && item.totalBytes > 0) {
        total += item.totalBytes;
      } else if (item.downloadedBytes > 0) {
        total += item.downloadedBytes;
      }
    }
    return total;
  }

  /**
   * Check if a media item is already downloaded
   */
  isMediaDownloaded(mediaItemId: string): DownloadItem | null {
    for (const item of this.downloadQueue.values()) {
      if (item.mediaItemId === mediaItemId && item.status === 'completed') {
        return item;
      }
    }
    return null;
  }

  /**
   * Process the download queue
   */
  private async processQueue(): Promise<void> {
    // Find next queued item
    const queued = Array.from(this.downloadQueue.values()).find(d => d.status === 'queued');
    if (!queued) return;

    await this.startDownload(queued.id);
  }

  /**
   * Start a download
   */
  private async startDownload(downloadId: string): Promise<void> {
    const item = this.downloadQueue.get(downloadId);
    if (!item) return;

    const controller = new AbortController();
    this.activeDownloads.set(downloadId, controller);

    item.status = 'downloading';
    item.startedAt = Date.now();
    item.error = null;
    this.downloadQueue.set(downloadId, item);
    this.persistQueue();
    this.emitUpdate(item);

    try {
      // Get download URL from server
      const downloadInfo = await this.getDownloadInfo(item.mediaItemId, item.quality);
      item.totalBytes = downloadInfo.size;
      this.downloadQueue.set(downloadId, item);
      this.persistQueue();
      this.emitUpdate(item);

      // Get the appropriate path for storing
      const localPath = await this.getDownloadPath(downloadInfo.filename);
      item.localPath = localPath;
      this.downloadQueue.set(downloadId, item);
      this.emitUpdate(item);

      // Perform the download with progress tracking
      await this.performDownload(downloadId, downloadInfo.url, localPath, controller.signal);

      item.status = 'completed';
      item.progress = 100;
      item.completedAt = Date.now();
      item.downloadedBytes = item.totalBytes;
      this.downloadQueue.set(downloadId, item);
      this.persistQueue();
      this.emitUpdate(item);

    } catch (error) {
      if ((error as Error).name === 'AbortError') {
        // Download was cancelled, don't mark as error
        return;
      }

      item.status = 'error';
      item.error = error instanceof Error ? error.message : 'Download failed';
      this.downloadQueue.set(downloadId, item);
      this.persistQueue();
      this.emitUpdate(item);
    } finally {
      this.activeDownloads.delete(downloadId);
      // Process next in queue
      this.processQueue();
    }
  }

  /**
   * Perform the actual download with progress reporting
   */
  private async performDownload(
    downloadId: string,
    url: string,
    localPath: string,
    signal: AbortSignal
  ): Promise<void> {
    return new Promise(async (resolve, reject) => {
      signal.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')));

      try {
        // Use the Electron main process to handle download
        // since browser fetch doesn't support file system access
        if (window.electronAPI?.startDownload) {
          await window.electronAPI.startDownload({
            id: downloadId,
            url,
            path: localPath,
            headers: {
              'Authorization': `Bearer ${this.getAuthToken()}`
            }
          });

          // Poll for progress
          const checkProgress = async () => {
            if (signal.aborted) return;
            const progress = await window.electronAPI?.getDownloadProgress(downloadId);
            if (progress !== undefined) {
              const item = this.downloadQueue.get(downloadId);
              if (item) {
                item.progress = progress.percent;
                item.downloadedBytes = progress.downloadedBytes;
                this.downloadQueue.set(downloadId, item);
                this.persistQueue();
                this.emitUpdate(item);
              }
            }
            if (this.activeDownloads.has(downloadId)) {
              setTimeout(checkProgress, 1000);
            }
          };
          checkProgress();

          // Wait for download to complete
          const result = await window.electronAPI?.waitForDownloadComplete(downloadId);
          if (result.success) {
            resolve();
          } else {
            reject(new Error(result.error || 'Download failed'));
          }
        } else {
          // Fallback: use XMLHttpRequest for browser environment
          await this.browserDownload(downloadId, url, localPath, signal);
          resolve();
        }
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Browser-based download fallback using XHR
   */
  private async browserDownload(
    downloadId: string,
    url: string,
    _localPath: string,
    signal: AbortSignal
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open('GET', url, true);
      xhr.responseType = 'blob';

      const authToken = this.getAuthToken();
      if (authToken) {
        xhr.setRequestHeader('Authorization', `Bearer ${authToken}`);
      }

      xhr.onprogress = (event) => {
        if (event.lengthComputable) {
          const item = this.downloadQueue.get(downloadId);
          if (item) {
            item.progress = Math.round((event.loaded / event.total) * 100);
            item.downloadedBytes = event.loaded;
            item.totalBytes = event.total;
            this.downloadQueue.set(downloadId, item);
            this.persistQueue();
            this.emitUpdate(item);
          }
        }
      };

      xhr.onload = () => {
        if (xhr.status === 200) {
          // Store in IndexedDB as fallback
          this.storeInIndexedDB(downloadId, xhr.response)
            .then(() => resolve())
            .catch(reject);
        } else {
          reject(new Error(`Download failed with status ${xhr.status}`));
        }
      };

      xhr.onerror = () => reject(new Error('Network error during download'));
      signal.addEventListener('abort', () => {
        xhr.abort();
        reject(new DOMException('Aborted', 'AbortError'));
      });

      xhr.send();
    });
  }

  /**
   * Store downloaded content in IndexedDB as fallback
   */
  private async storeInIndexedDB(downloadId: string, blob: Blob): Promise<void> {
    const db = await this.openIndexedDB();
    const tx = db.transaction('downloads', 'readwrite');
    const store = tx.objectStore('downloads');
    await store.put({ id: downloadId, blob, timestamp: Date.now() });
  }

  /**
   * Open IndexedDB for offline storage
   */
  private openIndexedDB(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open('phlex-downloads', 1);
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result);
      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains('downloads')) {
          db.createObjectStore('downloads', { keyPath: 'id' });
        }
      };
    });
  }

  /**
   * Get download path from Electron main process
   */
  private getDownloadPath(filename: string): Promise<string> {
    if (window.electronAPI?.getDownloadPath) {
      return window.electronAPI.getDownloadPath(filename);
    }
    // Fallback for browser
    return Promise.resolve(`downloads/${filename}`);
  }

  /**
   * Get auth token from localStorage
   */
  private getAuthToken(): string | null {
    return localStorage.getItem('auth_token');
  }

  /**
   * Persist download queue to localStorage
   */
  private persistQueue(): void {
    const data = JSON.stringify(Array.from(this.downloadQueue.entries()));
    localStorage.setItem('download_queue', data);
  }

  /**
   * Restore download queue from localStorage
   */
  private restoreQueue(): void {
    const data = localStorage.getItem('download_queue');
    if (data) {
      try {
        const entries = JSON.parse(data) as [string, DownloadItem][];
        this.downloadQueue = new Map(entries);
      } catch {
        // Invalid data, start fresh
        this.downloadQueue = new Map();
      }
    }
  }

  /**
   * Emit download update event
   */
  private emitUpdate(item: DownloadItem): void {
    window.dispatchEvent(new CustomEvent('download-update', { detail: item }));
  }

  /**
   * Emit download removal event
   */
  private emitRemove(id: string): void {
    window.dispatchEvent(new CustomEvent('download-remove', { detail: { id } }));
  }
}

export const downloadService = new DownloadService();
export default downloadService;
