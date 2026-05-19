import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useDownloadStore, DownloadItem, DownloadQuality } from '../../src/store/downloadStore';
import * as downloadService from '../../src/services/DownloadService';

// Mock the entire download service module
vi.mock('../../src/services/DownloadService', async () => {
  const mockDownloadItem: DownloadItem = {
    id: 'download-123',
    mediaItemId: 'media-123',
    title: 'Test Movie',
    status: 'queued',
    quality: 'high' as DownloadQuality,
    progress: 0,
    downloadedBytes: 0,
    totalBytes: 10000000,
    localPath: null,
    error: null,
    startedAt: null,
    completedAt: null,
    qualityProfile: 'high'
  };

  const mockService = {
    getAllDownloads: vi.fn().mockReturnValue([]),
    getDownload: vi.fn().mockReturnValue(mockDownloadItem),
    addToQueue: vi.fn().mockResolvedValue(mockDownloadItem),
    pauseDownload: vi.fn(),
    resumeDownload: vi.fn(),
    cancelDownload: vi.fn().mockResolvedValue(undefined),
    removeDownload: vi.fn().mockResolvedValue(undefined),
    getTotalStorageUsed: vi.fn().mockReturnValue(0),
    isMediaDownloaded: vi.fn().mockReturnValue(null)
  };

  return {
    downloadService: mockService,
    default: mockService
  };
});

describe('useDownloadStore', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();

    // Reset store state
    useDownloadStore.setState({
      downloads: [],
      isLoading: false,
      error: null,
      totalStorageUsed: 0
    });
  });

  afterEach(() => {
    localStorage.clear();
  });

  describe('loadDownloads', () => {
    it('should load downloads from service', () => {
      const mockDownload: DownloadItem = {
        id: 'download-1',
        mediaItemId: 'media-1',
        title: 'Test Movie',
        status: 'completed',
        quality: 'high',
        progress: 100,
        downloadedBytes: 10000000,
        totalBytes: 10000000,
        localPath: '/path/to/file.mp4',
        error: null,
        startedAt: Date.now() - 60000,
        completedAt: Date.now(),
        qualityProfile: 'high'
      };

      (downloadService.downloadService.getAllDownloads as any).mockReturnValueOnce([mockDownload]);
      (downloadService.downloadService.getTotalStorageUsed as any).mockReturnValueOnce(10000000);

      useDownloadStore.getState().loadDownloads();

      const state = useDownloadStore.getState();
      expect(state.downloads.length).toBe(1);
      expect(state.downloads[0].title).toBe('Test Movie');
      expect(state.totalStorageUsed).toBe(10000000);
    });
  });

  describe('addDownload', () => {
    it('should add download to queue', async () => {
      const mediaItem = { Id: 'media-1', Name: 'Test Movie', Type: 'Movie' };

      await useDownloadStore.getState().addDownload(mediaItem, 'high');

      expect(downloadService.downloadService.addToQueue).toHaveBeenCalledWith(mediaItem, 'high');
    });

    it('should set loading state while adding', async () => {
      const mediaItem = { Id: 'media-1', Name: 'Test Movie', Type: 'Movie' };

      const promise = useDownloadStore.getState().addDownload(mediaItem);
      expect(useDownloadStore.getState().isLoading).toBe(true);

      await promise;
      expect(useDownloadStore.getState().isLoading).toBe(false);
    });

    it('should set error if already downloaded', async () => {
      const mediaItem = { Id: 'media-1', Name: 'Test Movie', Type: 'Movie' };

      (downloadService.downloadService.isMediaDownloaded as any).mockReturnValueOnce({
        id: 'existing-download',
        mediaItemId: 'media-1',
        status: 'completed'
      });

      await useDownloadStore.getState().addDownload(mediaItem);

      expect(useDownloadStore.getState().error).toBeTruthy();
    });
  });

  describe('pauseDownload', () => {
    it('should call service pauseDownload', () => {
      useDownloadStore.getState().pauseDownload('download-123');
      expect(downloadService.downloadService.pauseDownload).toHaveBeenCalledWith('download-123');
    });
  });

  describe('resumeDownload', () => {
    it('should call service resumeDownload', () => {
      useDownloadStore.getState().resumeDownload('download-123');
      expect(downloadService.downloadService.resumeDownload).toHaveBeenCalledWith('download-123');
    });
  });

  describe('cancelDownload', () => {
    it('should cancel download and remove from list', async () => {
      const mockDownload: DownloadItem = {
        id: 'download-1',
        mediaItemId: 'media-1',
        title: 'Test Movie',
        status: 'downloading',
        quality: 'high',
        progress: 50,
        downloadedBytes: 5000000,
        totalBytes: 10000000,
        localPath: null,
        error: null,
        startedAt: Date.now() - 30000,
        completedAt: null,
        qualityProfile: 'high'
      };

      (downloadService.downloadService.getAllDownloads as any).mockReturnValue([mockDownload]);
      (downloadService.downloadService.getTotalStorageUsed as any).mockReturnValue(5000000);

      useDownloadStore.setState({ downloads: [mockDownload] });

      await useDownloadStore.getState().cancelDownload('download-1');

      expect(downloadService.downloadService.cancelDownload).toHaveBeenCalledWith('download-1');
    });
  });

  describe('removeDownload', () => {
    it('should remove completed download', async () => {
      await useDownloadStore.getState().removeDownload('download-123');
      expect(downloadService.downloadService.removeDownload).toHaveBeenCalledWith('download-123');
    });
  });

  describe('isItemDownloaded', () => {
    it('should return true if item is downloaded', () => {
      useDownloadStore.setState({
        downloads: [
          {
            id: 'download-1',
            mediaItemId: 'media-1',
            title: 'Test',
            status: 'completed',
            quality: 'high' as DownloadQuality,
            progress: 100,
            downloadedBytes: 10000000,
            totalBytes: 10000000,
            localPath: '/path',
            error: null,
            startedAt: null,
            completedAt: null,
            qualityProfile: 'high'
          }
        ]
      });

      expect(useDownloadStore.getState().isItemDownloaded('media-1')).toBe(true);
      expect(useDownloadStore.getState().isItemDownloaded('media-2')).toBe(false);
    });
  });

  describe('getDownloadedItem', () => {
    it('should return downloaded item for media ID', () => {
      const downloadedItem: DownloadItem = {
        id: 'download-1',
        mediaItemId: 'media-1',
        title: 'Test',
        status: 'completed',
        quality: 'high' as DownloadQuality,
        progress: 100,
        downloadedBytes: 10000000,
        totalBytes: 10000000,
        localPath: '/path',
        error: null,
        startedAt: null,
        completedAt: null,
        qualityProfile: 'high'
      };

      useDownloadStore.setState({ downloads: [downloadedItem] });

      const result = useDownloadStore.getState().getDownloadedItem('media-1');
      expect(result).toEqual(downloadedItem);

      const notFound = useDownloadStore.getState().getDownloadedItem('media-2');
      expect(notFound).toBeNull();
    });
  });

  describe('refreshStorageUsage', () => {
    it('should update totalStorageUsed', () => {
      (downloadService.downloadService.getTotalStorageUsed as any).mockReturnValueOnce(50000000);

      useDownloadStore.getState().refreshStorageUsage();

      expect(useDownloadStore.getState().totalStorageUsed).toBe(50000000);
    });
  });

  describe('clearCompleted', () => {
    it('should remove all completed downloads', async () => {
      const downloads: DownloadItem[] = [
        {
          id: 'download-1',
          mediaItemId: 'media-1',
          title: 'Test 1',
          status: 'completed',
          quality: 'high' as DownloadQuality,
          progress: 100,
          downloadedBytes: 10000000,
          totalBytes: 10000000,
          localPath: '/path1',
          error: null,
          startedAt: null,
          completedAt: null,
          qualityProfile: 'high'
        },
        {
          id: 'download-2',
          mediaItemId: 'media-2',
          title: 'Test 2',
          status: 'downloading',
          quality: 'high' as DownloadQuality,
          progress: 50,
          downloadedBytes: 5000000,
          totalBytes: 10000000,
          localPath: null,
          error: null,
          startedAt: null,
          completedAt: null,
          qualityProfile: 'high'
        }
      ];

      (downloadService.downloadService.getAllDownloads as any).mockReturnValue([downloads[1]]);
      (downloadService.downloadService.getTotalStorageUsed as any).mockReturnValue(5000000);

      useDownloadStore.setState({ downloads });

      await useDownloadStore.getState().clearCompleted();

      expect(downloadService.downloadService.removeDownload).toHaveBeenCalledTimes(1);
      expect(useDownloadStore.getState().downloads.length).toBe(1);
      expect(useDownloadStore.getState().downloads[0].id).toBe('download-2');
    });
  });
});
