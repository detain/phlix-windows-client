import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { downloadService, DownloadItem, DownloadQuality } from '../../src/services/DownloadService';

// Mock the hubAwareClient
vi.mock('../../src/api/hubAwareClient', () => ({
  default: {
    get: vi.fn()
  }
}));

// Mock window.electronAPI
const mockElectronAPI = {
  getDownloadPath: vi.fn().mockResolvedValue('/mock/downloads/file.mp4'),
  startDownload: vi.fn().mockResolvedValue(undefined),
  getDownloadProgress: vi.fn().mockResolvedValue({ percent: 50, downloadedBytes: 5000000 }),
  waitForDownloadComplete: vi.fn().mockResolvedValue({ success: true }),
  deleteFile: vi.fn().mockResolvedValue(undefined),
  getAppPath: vi.fn().mockResolvedValue('/mock/app'),
  getVersion: vi.fn().mockResolvedValue('1.0.0'),
  setAlwaysOnTop: vi.fn(),
  minimizeToTray: vi.fn(),
  onMediaPlayPause: vi.fn(),
  onMediaStop: vi.fn(),
  onMediaRewind: vi.fn(),
  onMediaForward: vi.fn(),
  onFileOpened: vi.fn(),
  onOpenSettings: vi.fn()
};

describe('DownloadService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Cast window to any to set mock
    (window as any).electronAPI = mockElectronAPI;

    // Reset localStorage
    localStorage.removeItem('download_queue');
  });

  afterEach(() => {
    localStorage.clear();
  });

  describe('getAllDownloads', () => {
    it('should return empty array when no downloads', () => {
      const downloads = downloadService.getAllDownloads();
      expect(downloads).toEqual([]);
    });
  });

  describe('getTotalStorageUsed', () => {
    it('should return 0 when no downloads', () => {
      const total = downloadService.getTotalStorageUsed();
      expect(total).toBe(0);
    });
  });

  describe('pauseDownload', () => {
    it('should not throw when pausing non-existent download', () => {
      expect(() => {
        downloadService.pauseDownload('non-existent-id');
      }).not.toThrow();
    });
  });

  describe('resumeDownload', () => {
    it('should not throw when resuming non-existent download', () => {
      expect(() => {
        downloadService.resumeDownload('non-existent-id');
      }).not.toThrow();
    });
  });

  describe('cancelDownload', () => {
    it('should not throw when cancelling non-existent download', async () => {
      await expect(
        downloadService.cancelDownload('non-existent-id')
      ).resolves.not.toThrow();
    });
  });

  describe('removeDownload', () => {
    it('should not throw when removing non-existent download', async () => {
      await expect(
        downloadService.removeDownload('non-existent-id')
      ).resolves.not.toThrow();
    });
  });

  describe('isMediaDownloaded', () => {
    it('should return null when media is not downloaded', () => {
      const result = downloadService.isMediaDownloaded('non-existent-media');
      expect(result).toBeNull();
    });
  });

  describe('getDownloadsByStatus', () => {
    it('should return downloads filtered by status', () => {
      // Initially should return empty array
      const queuedDownloads = downloadService.getDownloadsByStatus('queued');
      expect(Array.isArray(queuedDownloads)).toBe(true);
    });
  });

  describe('getDownload', () => {
    it('should return undefined for non-existent download', () => {
      const result = downloadService.getDownload('non-existent-id');
      expect(result).toBeUndefined();
    });
  });
});
