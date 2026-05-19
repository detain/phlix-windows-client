import { create } from 'zustand';
import syncPlayService, { SyncPlayGroup, SyncPlayMember } from '../syncplay/SyncPlayService';

interface SyncPlayState {
  // Connection state
  isConnected: boolean;
  isConnecting: boolean;

  // Time sync state
  timeOffset: number;
  timeLatency: number;
  isTimeSyncStable: boolean;

  // Current group
  currentGroup: SyncPlayGroup | null;

  // Error state
  error: { code: string; message: string } | null;

  // UI state
  isPanelOpen: boolean;
  isCreatingGroup: boolean;
  isJoiningGroup: boolean;

  // Actions - Connection
  connect: (serverUrl: string, accessToken: string, userId: string, userName: string) => void;
  disconnect: () => void;
  setConnected: (connected: boolean) => void;

  // Actions - Time sync
  setTimeSyncUpdate: (offset: number, isStable: boolean) => void;

  // Actions - Group management
  createGroup: (name: string, password?: string) => void;
  joinGroup: (groupId: string, password?: string) => void;
  leaveGroup: () => void;
  setGroup: (group: SyncPlayGroup) => void;
  clearGroup: () => void;

  // Actions - Group state updates
  updateMemberPosition: (memberId: string, position: number, isPlaying: boolean) => void;
  setGroupPlaybackState: (state: 'playing' | 'paused' | 'stopped', position: number) => void;

  // Actions - Playback sync
  onPlaybackCommand: (type: 'play' | 'pause' | 'seek', position: number) => void;

  // Actions - UI
  setPanelOpen: (open: boolean) => void;
  setCreatingGroup: (creating: boolean) => void;
  setJoiningGroup: (joining: boolean) => void;

  // Actions - Error
  setError: (code: string, message: string) => void;
  clearError: () => void;

  // Computed helpers
  isInGroup: () => boolean;
  isHost: () => boolean;
  getMembers: () => SyncPlayMember[];
}

/**
 * SyncPlay Store - Zustand state management for SyncPlay functionality
 *
 * Manages connection state, time synchronization, group state,
 * and UI state for the SyncPlay feature.
 */
export const useSyncPlayStore = create<SyncPlayState>((set, get) => ({
  // Initial state
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

  // Connection actions
  connect: (serverUrl: string, accessToken: string, userId: string, userName: string) => {
    set({ isConnecting: true, error: null });

    syncPlayService.connect({
      serverUrl,
      accessToken,
      userId,
      userName,
      onGroupStateUpdate: (group) => {
        set({ currentGroup: group, isConnecting: false });
      },
      onPlaybackCommand: (type, position) => {
        get().onPlaybackCommand(type, position);
      },
      onMemberJoined: (member) => {
        const currentGroup = get().currentGroup;
        if (currentGroup) {
          set({
            currentGroup: {
              ...currentGroup,
              members: [...currentGroup.members, member],
            },
          });
        }
      },
      onMemberLeft: (memberId) => {
        const currentGroup = get().currentGroup;
        if (currentGroup) {
          set({
            currentGroup: {
              ...currentGroup,
              members: currentGroup.members.filter((m) => m.id !== memberId),
            },
          });
        }
      },
      onError: (code, message) => {
        set({ error: { code, message } });
      },
      onTimeSyncUpdate: (offset, isStable) => {
        set({
          timeOffset: offset,
          isTimeSyncStable: isStable,
          isConnected: true,
          isConnecting: false,
        });
      },
    });
  },

  disconnect: () => {
    syncPlayService.disconnect();
    set({
      isConnected: false,
      isConnecting: false,
      currentGroup: null,
      timeOffset: 0,
      timeLatency: 0,
      isTimeSyncStable: false,
      error: null,
    });
  },

  setConnected: (connected: boolean) => {
    set({ isConnected: connected, isConnecting: false });
  },

  // Time sync actions
  setTimeSyncUpdate: (offset: number, isStable: boolean) => {
    set({
      timeOffset: offset,
      isTimeSyncStable: isStable,
      isConnected: true,
      isConnecting: false,
    });
  },

  // Group management actions
  createGroup: (name: string, password?: string) => {
    set({ isCreatingGroup: true, error: null });
    syncPlayService.createGroup(name, password);
  },

  joinGroup: (groupId: string, password?: string) => {
    set({ isJoiningGroup: true, error: null });
    syncPlayService.joinGroup(groupId, password);
  },

  leaveGroup: () => {
    syncPlayService.leaveGroup();
    set({ currentGroup: null, isCreatingGroup: false, isJoiningGroup: false });
  },

  setGroup: (group: SyncPlayGroup) => {
    set({ currentGroup: group, isCreatingGroup: false, isJoiningGroup: false });
  },

  clearGroup: () => {
    set({ currentGroup: null, isCreatingGroup: false, isJoiningGroup: false });
  },

  // Group state update actions
  updateMemberPosition: (memberId: string, position: number, isPlaying: boolean) => {
    const currentGroup = get().currentGroup;
    if (!currentGroup) return;

    set({
      currentGroup: {
        ...currentGroup,
        members: currentGroup.members.map((m) =>
          m.id === memberId ? { ...m, position, isPlaying } : m
        ),
      },
    });
  },

  setGroupPlaybackState: (state: 'playing' | 'paused' | 'stopped', position: number) => {
    const currentGroup = get().currentGroup;
    if (!currentGroup) return;

    set({
      currentGroup: {
        ...currentGroup,
        playbackState: state,
        playbackPosition: position,
      },
    });
  },

  // Playback sync actions
  onPlaybackCommand: (type: 'play' | 'pause' | 'seek', position: number) => {
    const currentGroup = get().currentGroup;
    if (!currentGroup) return;

    set({
      currentGroup: {
        ...currentGroup,
        playbackState: type === 'play' ? 'playing' : type === 'pause' ? 'paused' : currentGroup.playbackState,
        playbackPosition: position,
      },
    });
  },

  // UI actions
  setPanelOpen: (open: boolean) => {
    set({ isPanelOpen: open });
  },

  setCreatingGroup: (creating: boolean) => {
    set({ isCreatingGroup: creating });
  },

  setJoiningGroup: (joining: boolean) => {
    set({ isJoiningGroup: joining });
  },

  // Error actions
  setError: (code: string, message: string) => {
    set({ error: { code, message }, isCreatingGroup: false, isJoiningGroup: false });
  },

  clearError: () => {
    set({ error: null });
  },

  // Computed helpers
  isInGroup: () => get().currentGroup !== null,

  isHost: () => {
    const currentGroup = get().currentGroup;
    const memberId = syncPlayService.getMemberId();
    if (!currentGroup || !memberId) return false;
    return currentGroup.hostId === memberId;
  },

  getMembers: () => get().currentGroup?.members || [],
}));
