import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useSyncPlayStore } from '../../../src/store/syncplayStore';

// Mock the syncPlayService
vi.mock('../../../src/syncplay/SyncPlayService', () => ({
  default: {
    connect: vi.fn(),
    disconnect: vi.fn(),
    createGroup: vi.fn(),
    joinGroup: vi.fn(),
    leaveGroup: vi.fn(),
    sendPlay: vi.fn(),
    sendPause: vi.fn(),
    sendSeek: vi.fn(),
    getMemberId: vi.fn(() => 'test-member-id'),
    getTimeOffset: vi.fn(() => 0),
    getAdjustedTime: vi.fn(() => Date.now()),
  },
  syncPlayService: {
    connect: vi.fn(),
    disconnect: vi.fn(),
    createGroup: vi.fn(),
    joinGroup: vi.fn(),
    leaveGroup: vi.fn(),
    sendPlay: vi.fn(),
    sendPause: vi.fn(),
    sendSeek: vi.fn(),
    getMemberId: vi.fn(() => 'test-member-id'),
    getTimeOffset: vi.fn(() => 0),
    getAdjustedTime: vi.fn(() => Date.now()),
  },
}));

describe('useSyncPlayStore', () => {
  beforeEach(() => {
    // Reset store state before each test
    useSyncPlayStore.setState({
      isConnected: false,
      isConnecting: false,
      timeOffset: 0,
      timeLatency: 0,
      isTimeSyncStable: false,
      currentGroup: null,
      error: null,
      isPanelOpen: false,
      isCreatingGroup: false,
      isJoiningGroup: false,
    });
  });

  describe('Connection State', () => {
    it('should have initial disconnected state', () => {
      const state = useSyncPlayStore.getState();
      expect(state.isConnected).toBe(false);
      expect(state.isConnecting).toBe(false);
    });

    it('should set connected state', () => {
      useSyncPlayStore.getState().setConnected(true);
      const state = useSyncPlayStore.getState();
      expect(state.isConnected).toBe(true);
      expect(state.isConnecting).toBe(false);
    });

    it('should update time sync info', () => {
      useSyncPlayStore.getState().setTimeSyncUpdate(150, true);
      const state = useSyncPlayStore.getState();
      expect(state.timeOffset).toBe(150);
      expect(state.isTimeSyncStable).toBe(true);
      expect(state.isConnected).toBe(true);
    });
  });

  describe('Group Management', () => {
    it('should set group state', () => {
      const mockGroup = {
        id: 'group-1',
        name: 'Test Group',
        members: [
          { id: 'member-1', name: 'User 1', isHost: true, joinedAt: Date.now() },
        ],
        currentMediaId: null,
        playbackPosition: 0,
        playbackState: 'stopped' as const,
        hostId: 'member-1',
        isJoined: true,
      };

      useSyncPlayStore.getState().setGroup(mockGroup);
      const state = useSyncPlayStore.getState();

      expect(state.currentGroup).toEqual(mockGroup);
      expect(state.isCreatingGroup).toBe(false);
      expect(state.isJoiningGroup).toBe(false);
    });

    it('should clear group state', () => {
      const mockGroup = {
        id: 'group-1',
        name: 'Test Group',
        members: [],
        currentMediaId: null,
        playbackPosition: 0,
        playbackState: 'stopped' as const,
        hostId: null,
        isJoined: true,
      };

      useSyncPlayStore.setState({ currentGroup: mockGroup });
      useSyncPlayStore.getState().clearGroup();

      const state = useSyncPlayStore.getState();
      expect(state.currentGroup).toBe(null);
    });

    it('should update member position', () => {
      const mockGroup = {
        id: 'group-1',
        name: 'Test Group',
        members: [
          { id: 'member-1', name: 'User 1', isHost: true, joinedAt: Date.now() },
          { id: 'member-2', name: 'User 2', isHost: false, joinedAt: Date.now() },
        ],
        currentMediaId: null,
        playbackPosition: 0,
        playbackState: 'stopped' as const,
        hostId: 'member-1',
        isJoined: true,
      };

      useSyncPlayStore.setState({ currentGroup: mockGroup });
      useSyncPlayStore.getState().updateMemberPosition('member-2', 5000, true);

      const state = useSyncPlayStore.getState();
      const member = state.currentGroup?.members.find((m) => m.id === 'member-2');
      expect(member?.position).toBe(5000);
      expect(member?.isPlaying).toBe(true);
    });
  });

  describe('UI State', () => {
    it('should toggle panel open state', () => {
      useSyncPlayStore.getState().setPanelOpen(true);
      expect(useSyncPlayStore.getState().isPanelOpen).toBe(true);

      useSyncPlayStore.getState().setPanelOpen(false);
      expect(useSyncPlayStore.getState().isPanelOpen).toBe(false);
    });

    it('should set creating group state', () => {
      useSyncPlayStore.getState().setCreatingGroup(true);
      expect(useSyncPlayStore.getState().isCreatingGroup).toBe(true);
    });

    it('should set joining group state', () => {
      useSyncPlayStore.getState().setJoiningGroup(true);
      expect(useSyncPlayStore.getState().isJoiningGroup).toBe(true);
    });
  });

  describe('Error Handling', () => {
    it('should set error state', () => {
      useSyncPlayStore.getState().setError('ERR001', 'Test error message');
      const state = useSyncPlayStore.getState();

      expect(state.error).toEqual({ code: 'ERR001', message: 'Test error message' });
      expect(state.isCreatingGroup).toBe(false);
      expect(state.isJoiningGroup).toBe(false);
    });

    it('should clear error state', () => {
      useSyncPlayStore.setState({
        error: { code: 'ERR001', message: 'Test error' },
      });
      useSyncPlayStore.getState().clearError();

      expect(useSyncPlayStore.getState().error).toBe(null);
    });
  });

  describe('Computed Helpers', () => {
    it('should correctly report not in group', () => {
      useSyncPlayStore.setState({ currentGroup: null });
      expect(useSyncPlayStore.getState().isInGroup()).toBe(false);
    });

    it('should correctly report in group', () => {
      useSyncPlayStore.setState({
        currentGroup: {
          id: 'group-1',
          name: 'Test',
          members: [],
          currentMediaId: null,
          playbackPosition: 0,
          playbackState: 'stopped' as const,
          hostId: null,
          isJoined: true,
        },
      });
      expect(useSyncPlayStore.getState().isInGroup()).toBe(true);
    });

    it('should return empty members when no group', () => {
      useSyncPlayStore.setState({ currentGroup: null });
      expect(useSyncPlayStore.getState().getMembers()).toEqual([]);
    });
  });
});
