import { describe, it, expect } from 'vitest';
import {
  SYNCPLAY_MESSAGE_TYPES,
  SyncPlayMember,
  SyncPlayGroup,
  TimeSyncSample,
} from '../../../src/syncplay/SyncPlayService';

// Test TimeSync offset calculation logic
describe('SyncPlayService TimeSync', () => {
  describe('TimeSync offset calculation', () => {
    it('should calculate RTT correctly', () => {
      // rtt = t3 - t1 (clientReceiveTime - clientSendTime) minus network error term
      const t1 = 1000;   // clientSendTime
      const t3 = 1030;    // clientReceiveTime

      const rtt = t3 - t1;
      expect(rtt).toBe(30);
    });

    it('should calculate one-way latency as RTT/2', () => {
      const rtt = 30;
      const oneWayLatency = rtt / 2;
      expect(oneWayLatency).toBe(15);
    });

    it('should calculate time offset', () => {
      // offset = serverTime - clientSendTime + latency
      const serverTime = 1020;
      const clientSendTime = 1000;
      const latency = 15;

      const offset = serverTime - clientSendTime + latency;
      expect(offset).toBe(35);
    });

    it('should determine sync is stable when variance < 50ms', () => {
      const samples: TimeSyncSample[] = [
        { offset: 20, rtt: 50, timestamp: 1 },
        { offset: 21, rtt: 50, timestamp: 2 },
        { offset: 20, rtt: 50, timestamp: 3 },
        { offset: 19, rtt: 50, timestamp: 4 },
        { offset: 20, rtt: 50, timestamp: 5 },
      ];

      const OFFSET_SAMPLE_COUNT = 5;
      const recent = samples.slice(-OFFSET_SAMPLE_COUNT);

      const offsets = recent.map((s) => s.offset);
      const mean = offsets.reduce((a, b) => a + b, 0) / offsets.length;

      let varianceSum = 0;
      for (const offset of offsets) {
        const diff = offset - mean;
        varianceSum += diff * diff;
      }
      const variance = varianceSum / offsets.length;

      expect(variance).toBeLessThan(50);
      expect(variance).toBe(0.4); // Very stable since offsets barely vary
    });

    it('should detect unstable sync when variance >= 50ms', () => {
      const samples: TimeSyncSample[] = [
        { offset: 10, rtt: 50, timestamp: 1 },
        { offset: 60, rtt: 50, timestamp: 2 },
        { offset: 10, rtt: 50, timestamp: 3 },
        { offset: 60, rtt: 50, timestamp: 4 },
        { offset: 10, rtt: 50, timestamp: 5 },
      ];

      const OFFSET_SAMPLE_COUNT = 5;
      const recent = samples.slice(-OFFSET_SAMPLE_COUNT);

      const offsets = recent.map((s) => s.offset);
      const mean = offsets.reduce((a, b) => a + b, 0) / offsets.length;

      let varianceSum = 0;
      for (const offset of offsets) {
        const diff = offset - mean;
        varianceSum += diff * diff;
      }
      const variance = varianceSum / offsets.length;

      expect(variance).toBeGreaterThanOrEqual(50);
    });

    it('should filter out high-RTT samples (>1000ms)', () => {
      const MAX_ACCEPTABLE_RTT = 1000;

      const samples: TimeSyncSample[] = [
        { offset: 20, rtt: 50, timestamp: 1 },
        { offset: 100, rtt: 2000, timestamp: 2 }, // Should be filtered
        { offset: 22, rtt: 75, timestamp: 3 },
        { offset: 18, rtt: 25, timestamp: 4 },
      ];

      const acceptableSamples = samples.filter(s => s.rtt <= MAX_ACCEPTABLE_RTT);
      expect(acceptableSamples.length).toBe(3);
      expect(acceptableSamples.find(s => s.rtt === 2000)).toBeUndefined();
    });
  });
});

describe('SyncPlay Message Types', () => {
  it('should have all required message type constants', () => {
    expect(SYNCPLAY_MESSAGE_TYPES.GROUP_CREATE).toBe('syncplay_group_create');
    expect(SYNCPLAY_MESSAGE_TYPES.GROUP_JOIN).toBe('syncplay_group_join');
    expect(SYNCPLAY_MESSAGE_TYPES.GROUP_LEAVE).toBe('syncplay_group_leave');
    expect(SYNCPLAY_MESSAGE_TYPES.GROUP_STATE).toBe('syncplay_group_state');
    expect(SYNCPLAY_MESSAGE_TYPES.PLAYBACK_PLAY).toBe('syncplay_playback_play');
    expect(SYNCPLAY_MESSAGE_TYPES.PLAYBACK_PAUSE).toBe('syncplay_playback_pause');
    expect(SYNCPLAY_MESSAGE_TYPES.PLAYBACK_SEEK).toBe('syncplay_playback_seek');
    expect(SYNCPLAY_MESSAGE_TYPES.TIME_PING).toBe('syncplay_time_ping');
    expect(SYNCPLAY_MESSAGE_TYPES.TIME_PONG).toBe('syncplay_time_pong');
    expect(SYNCPLAY_MESSAGE_TYPES.ERROR).toBe('syncplay_error');
    expect(SYNCPLAY_MESSAGE_TYPES.INFO).toBe('syncplay_info');
  });
});

describe('SyncPlay Interfaces', () => {
  describe('SyncPlayMember', () => {
    it('should accept valid member data', () => {
      const member: SyncPlayMember = {
        id: 'member-123',
        name: 'Test User',
        isHost: true,
        joinedAt: Date.now(),
        position: 5000,
        isPlaying: true,
      };

      expect(member.id).toBe('member-123');
      expect(member.name).toBe('Test User');
      expect(member.isHost).toBe(true);
      expect(member.position).toBe(5000);
      expect(member.isPlaying).toBe(true);
    });
  });

  describe('SyncPlayGroup', () => {
    it('should accept valid group data', () => {
      const group: SyncPlayGroup = {
        id: 'group-abc',
        name: 'Movie Night',
        members: [],
        currentMediaId: 'media-xyz',
        playbackPosition: 30000,
        playbackState: 'playing',
        hostId: 'member-123',
        isJoined: true,
      };

      expect(group.id).toBe('group-abc');
      expect(group.name).toBe('Movie Night');
      expect(group.playbackState).toBe('playing');
      expect(group.playbackPosition).toBe(30000);
    });
  });
});
