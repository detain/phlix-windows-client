/**
 * SyncPlay Service - Client-side SyncPlay implementation
 *
 * Handles WebSocket connection, NTP-style time synchronization,
 * group state management, and playback command dispatch for
 * synchronized multi-user playback sessions.
 *
 * ## TimeSync Protocol
 *
 * 1. Client sends `syncplay_time_ping` with local timestamp (t1)
 * 2. Server responds with `syncplay_time_pong` containing t1, t2 (server receive time)
 * 3. Client calculates: offset = (t2 - t1 - (t3 - t2)) / 2
 *    where t3 is client receive time
 * 4. Maintains rolling average of last OFFSET_SAMPLE_COUNT samples
 * 5. Use `adjustedTime = Date.now() + averageOffset` for position comparisons
 */

import { useSyncPlayStore } from '../store/syncplayStore';
import { useHubStore } from '../store/hubStore';
import { useAuthStore } from '../renderer/stores/authStore';

// Protocol message types
export const SYNCPLAY_MESSAGE_TYPES = {
  GROUP_CREATE: 'syncplay_group_create',
  GROUP_JOIN: 'syncplay_group_join',
  GROUP_LEAVE: 'syncplay_group_leave',
  GROUP_STATE: 'syncplay_group_state',
  GROUP_LIST: 'syncplay_group_list',
  PLAYBACK_PLAY: 'syncplay_playback_play',
  PLAYBACK_PAUSE: 'syncplay_playback_pause',
  PLAYBACK_SEEK: 'syncplay_playback_seek',
  PLAYBACK_SYNC: 'syncplay_playback_sync',
  TIME_PING: 'syncplay_time_ping',
  TIME_PONG: 'syncplay_time_pong',
  ERROR: 'syncplay_error',
  INFO: 'syncplay_info',
} as const;

export type SyncPlayMessageType = typeof SYNCPLAY_MESSAGE_TYPES[keyof typeof SYNCPLAY_MESSAGE_TYPES];

export interface SyncPlayMember {
  id: string;
  name: string;
  isHost: boolean;
  joinedAt: number;
  position?: number;
  isPlaying?: boolean;
}

export interface SyncPlayGroup {
  id: string;
  name: string;
  members: SyncPlayMember[];
  currentMediaId: string | null;
  playbackPosition: number;
  playbackState: 'playing' | 'paused' | 'stopped';
  hostId: string | null;
  isJoined: boolean;
}

export interface TimeSyncSample {
  offset: number;
  rtt: number;
  timestamp: number;
}

export interface SyncPlayServiceConfig {
  serverUrl: string;
  accessToken: string;
  userId: string;
  userName: string;
  onGroupStateUpdate?: (group: SyncPlayGroup) => void;
  onPlaybackCommand?: (type: 'play' | 'pause' | 'seek', position: number) => void;
  onMemberJoined?: (member: SyncPlayMember) => void;
  onMemberLeft?: (memberId: string) => void;
  onError?: (code: string, message: string) => void;
  onTimeSyncUpdate?: (offset: number, isStable: boolean) => void;
}

const OFFSET_SAMPLE_COUNT = 5;
const MAX_ACCEPTABLE_RTT = 1000;
const TIME_SYNC_INTERVAL_MS = 10000;
const RECONNECT_DELAY_MS = 3000;
const MAX_RECONNECT_ATTEMPTS = 5;

/**
 * SyncPlay Service class
 *
 * Manages WebSocket connection, time synchronization, and group state
 * for SyncPlay functionality.
 */
class SyncPlayService {
  private ws: WebSocket | null = null;
  private config: SyncPlayServiceConfig | null = null;
  private offsetSamples: TimeSyncSample[] = [];
  private timeSyncInterval: ReturnType<typeof setInterval> | null = null;
  private positionReportInterval: ReturnType<typeof setInterval> | null = null;
  private reconnectAttempts = 0;
  private isIntentionallyClosed = false;
  private currentGroup: SyncPlayGroup | null = null;
  private memberId: string | null = null;

  /**
   * Initialize SyncPlay service and connect to WebSocket
   */
  connect(config: SyncPlayServiceConfig): void {
    this.config = config;
    this.isIntentionallyClosed = false;
    this.reconnectAttempts = 0;
    this.memberId = `member_${crypto.randomUUID()}`;

    this.connectWebSocket();
    this.startTimeSync();
  }

  /**
   * Disconnect and cleanup
   */
  disconnect(): void {
    this.isIntentionallyClosed = true;
    this.stopTimeSync();
    this.stopPositionReporting();

    if (this.currentGroup) {
      this.leaveGroup();
    }

    if (this.ws) {
      this.ws.close(1000, 'Client disconnect');
      this.ws = null;
    }

    this.config = null;
    this.currentGroup = null;
    this.offsetSamples = [];
  }

  /**
   * Get current estimated time offset from server
   */
  getTimeOffset(): number {
    if (this.offsetSamples.length === 0) {
      return 0;
    }

    const recent = this.offsetSamples.slice(-OFFSET_SAMPLE_COUNT);
    let weightedSum = 0;
    let weightSum = 0;

    for (const sample of recent) {
      const weight = 1 / Math.max(1, sample.rtt);
      weightedSum += sample.offset * weight;
      weightSum += weight;
    }

    return Math.round(weightedSum / Math.max(1, weightSum));
  }

  /**
   * Get estimated one-way latency to server
   */
  getEstimatedLatency(): number {
    if (this.offsetSamples.length === 0) {
      return 0;
    }

    const recent = this.offsetSamples.slice(-OFFSET_SAMPLE_COUNT);
    let totalLatency = 0;

    for (const sample of recent) {
      totalLatency += sample.rtt / 2;
    }

    return Math.round(totalLatency / recent.length);
  }

  /**
   * Check if time synchronization is stable
   */
  isTimeSyncStable(): boolean {
    if (this.offsetSamples.length < OFFSET_SAMPLE_COUNT) {
      return false;
    }

    const recent = this.offsetSamples.slice(-OFFSET_SAMPLE_COUNT);
    const offsets = recent.map(s => s.offset);
    const mean = offsets.reduce((a, b) => a + b, 0) / offsets.length;

    let varianceSum = 0;
    for (const offset of offsets) {
      const diff = offset - mean;
      varianceSum += diff * diff;
    }
    const variance = varianceSum / offsets.length;

    return variance < 50;
  }

  /**
   * Get adjusted time (local time + offset)
   */
  getAdjustedTime(): number {
    return Date.now() + this.getTimeOffset();
  }

  /**
   * Get current group info
   */
  getCurrentGroup(): SyncPlayGroup | null {
    return this.currentGroup;
  }

  /**
   * Get member ID
   */
  getMemberId(): string | null {
    return this.memberId;
  }

  // ====================
  // Group Management
  // ====================

  /**
   * Create a new SyncPlay group
   */
  createGroup(groupName: string, password?: string): void {
    const message: Record<string, unknown> = {
      type: SYNCPLAY_MESSAGE_TYPES.GROUP_CREATE,
      protocol_version: 1,
      group_name: groupName,
      member_id: this.memberId,
      member_name: this.config?.userName,
      timestamp: Date.now(),
    };

    if (password) {
      message.password_hash = this.hashPassword(password);
    }

    this.sendMessage(message);
  }

  /**
   * Join an existing SyncPlay group
   */
  joinGroup(groupId: string, password?: string): void {
    const message: Record<string, unknown> = {
      type: SYNCPLAY_MESSAGE_TYPES.GROUP_JOIN,
      protocol_version: 1,
      group_id: groupId,
      member_id: this.memberId,
      member_name: this.config?.userName,
      timestamp: Date.now(),
    };

    if (password) {
      message.password_hash = this.hashPassword(password);
    }

    this.sendMessage(message);
  }

  /**
   * Leave current SyncPlay group
   */
  leaveGroup(): void {
    if (!this.currentGroup || !this.memberId) {
      return;
    }

    const message = {
      type: SYNCPLAY_MESSAGE_TYPES.GROUP_LEAVE,
      protocol_version: 1,
      group_id: this.currentGroup.id,
      member_id: this.memberId,
      timestamp: Date.now(),
    };

    this.sendMessage(message);

    this.currentGroup = null;
    useSyncPlayStore.getState().clearGroup();
  }

  // ====================
  // Playback Commands
  // ====================

  /**
   * Send play command
   */
  sendPlay(position: number): void {
    if (!this.currentGroup || !this.memberId) {
      return;
    }

    const message = {
      type: SYNCPLAY_MESSAGE_TYPES.PLAYBACK_PLAY,
      protocol_version: 1,
      group_id: this.currentGroup.id,
      member_id: this.memberId,
      position,
      server_time: this.getAdjustedTime(),
      timestamp: Date.now(),
    };

    this.sendMessage(message);
  }

  /**
   * Send pause command
   */
  sendPause(position: number): void {
    if (!this.currentGroup || !this.memberId) {
      return;
    }

    const message = {
      type: SYNCPLAY_MESSAGE_TYPES.PLAYBACK_PAUSE,
      protocol_version: 1,
      group_id: this.currentGroup.id,
      member_id: this.memberId,
      position,
      server_time: this.getAdjustedTime(),
      timestamp: Date.now(),
    };

    this.sendMessage(message);
  }

  /**
   * Send seek command
   */
  sendSeek(fromPosition: number, toPosition: number): void {
    if (!this.currentGroup || !this.memberId) {
      return;
    }

    const message = {
      type: SYNCPLAY_MESSAGE_TYPES.PLAYBACK_SEEK,
      protocol_version: 1,
      group_id: this.currentGroup.id,
      member_id: this.memberId,
      from_position: fromPosition,
      to_position: toPosition,
      server_time: this.getAdjustedTime(),
      timestamp: Date.now(),
    };

    this.sendMessage(message);
  }

  /**
   * Report current position (called periodically)
   */
  reportPosition(position: number, isPlaying: boolean): void {
    if (!this.currentGroup || !this.memberId) {
      return;
    }

    const message = {
      type: 'syncplay_position_report',
      protocol_version: 1,
      group_id: this.currentGroup.id,
      member_id: this.memberId,
      position,
      is_playing: isPlaying,
      server_time: this.getAdjustedTime(),
      timestamp: Date.now(),
    };

    this.sendMessage(message);
  }

  // ====================
  // Private Methods
  // ====================

  private connectWebSocket(): void {
    if (!this.config) {
      return;
    }

    const wsUrl = this.config.serverUrl.replace(/^http/, 'ws') + '/ws/syncplay';
    const token = useHubStore.getState().session?.accessToken || useAuthStore.getState().user ? 'Bearer ' + this.config.accessToken : '';

    try {
      this.ws = new WebSocket(wsUrl, token ? [token] : undefined);

      this.ws.onopen = this.handleOpen.bind(this);
      this.ws.onmessage = this.handleMessage.bind(this);
      this.ws.onclose = this.handleClose.bind(this);
      this.ws.onerror = this.handleError.bind(this);
    } catch (error) {
      console.error('SyncPlay WebSocket connection error:', error); // eslint-disable-line no-console
      this.scheduleReconnect();
    }
  }

  private handleOpen(): void {
    this.reconnectAttempts = 0;
    this.config?.onTimeSyncUpdate?.(this.getTimeOffset(), this.isTimeSyncStable());

    // Request initial time sync
    this.sendTimePing();
  }

  private handleMessage(event: MessageEvent): void {
    try {
      const message = JSON.parse(event.data) as Record<string, unknown>;
      const type = message.type as string;

      switch (type) {
        case SYNCPLAY_MESSAGE_TYPES.TIME_PONG:
          this.handleTimePong(message);
          break;
        case SYNCPLAY_MESSAGE_TYPES.GROUP_STATE:
          this.handleGroupState(message);
          break;
        case SYNCPLAY_MESSAGE_TYPES.PLAYBACK_PLAY:
          this.handlePlaybackPlay(message);
          break;
        case SYNCPLAY_MESSAGE_TYPES.PLAYBACK_PAUSE:
          this.handlePlaybackPause(message);
          break;
        case SYNCPLAY_MESSAGE_TYPES.PLAYBACK_SEEK:
          this.handlePlaybackSeek(message);
          break;
        case SYNCPLAY_MESSAGE_TYPES.INFO:
          this.handleInfo(message);
          break;
        case SYNCPLAY_MESSAGE_TYPES.ERROR:
          this.handleErrorMessage(message);
          break;
        default:
          console.warn('Unknown SyncPlay message type:', type); // eslint-disable-line no-console
      }
    } catch (error) {
      console.error('Error parsing SyncPlay message:', error); // eslint-disable-line no-console
    }
  }

  private handleClose(_event: CloseEvent): void {
    this.stopTimeSync();
    this.stopPositionReporting();

    if (!this.isIntentionallyClosed) {
      this.scheduleReconnect();
    }

    useSyncPlayStore.getState().setConnected(false);
  }

  private handleError(event: Event): void {
    console.error('SyncPlay WebSocket error:', event); // eslint-disable-line no-console
  }

  private handleTimePong(message: Record<string, unknown>): void {
    const clientSendTime = message.client_time as number;
    const serverTime = message.server_time as number;
    const clientReceiveTime = Date.now();

    // Calculate RTT and offset
    const rtt = clientReceiveTime - clientSendTime - (serverTime - clientReceiveTime);
    const oneWayLatency = rtt / 2;
    const offset = serverTime - clientSendTime + Math.round(oneWayLatency);

    // Add sample if RTT is acceptable
    if (rtt <= MAX_ACCEPTABLE_RTT) {
      this.addOffsetSample(offset, rtt);
      this.config?.onTimeSyncUpdate?.(this.getTimeOffset(), this.isTimeSyncStable());
    }
  }

  private handleGroupState(message: Record<string, unknown>): void {
    const groupId = message.group_id as string;
    const members = (message.members as Array<{ id: string; name: string; is_host?: boolean; joined_at?: number }>) || [];
    const currentMediaId = message.current_media_id as string | null;
    const playbackPosition = message.playback_position as number || 0;
    const playbackState = message.playback_state as 'playing' | 'paused' | 'stopped' || 'stopped';
    const hostId = message.host_id as string | null;

    const mappedMembers: SyncPlayMember[] = members.map(m => ({
      id: m.id,
      name: m.name,
      isHost: m.is_host || false,
      joinedAt: m.joined_at || Date.now(),
    }));

    const group: SyncPlayGroup = {
      id: groupId,
      name: message.group_name as string || 'SyncPlay Group',
      members: mappedMembers,
      currentMediaId,
      playbackPosition,
      playbackState,
      hostId,
      isJoined: true,
    };

    this.currentGroup = group;
    useSyncPlayStore.getState().setGroup(group);
    this.config?.onGroupStateUpdate?.(group);
  }

  private handlePlaybackPlay(message: Record<string, unknown>): void {
    const position = message.position as number;
    const memberId = message.member_id as string;

    // Only react to commands from other members
    if (memberId !== this.memberId) {
      this.config?.onPlaybackCommand?.('play', position);
    }
  }

  private handlePlaybackPause(message: Record<string, unknown>): void {
    const position = message.position as number;
    const memberId = message.member_id as string;

    if (memberId !== this.memberId) {
      this.config?.onPlaybackCommand?.('pause', position);
    }
  }

  private handlePlaybackSeek(message: Record<string, unknown>): void {
    const toPosition = message.to_position as number;
    const memberId = message.member_id as string;

    if (memberId !== this.memberId) {
      this.config?.onPlaybackCommand?.('seek', toPosition);
    }
  }

  private handleInfo(message: Record<string, unknown>): void {
    const infoMessage = message.message as string;
    console.info('SyncPlay info:', infoMessage); // eslint-disable-line no-console
  }

  private handleErrorMessage(message: Record<string, unknown>): void {
    const code = message.error_code as string;
    const errorMessage = message.message as string;

    useSyncPlayStore.getState().setError(code, errorMessage);
    this.config?.onError?.(code, errorMessage);
  }

  private sendMessage(message: Record<string, unknown>): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
    }
  }

  private sendTimePing(): void {
    const clientTime = Date.now();

    const message = {
      type: SYNCPLAY_MESSAGE_TYPES.TIME_PING,
      protocol_version: 1,
      client_time: clientTime,
      timestamp: clientTime,
    };

    this.sendMessage(message);
  }

  private addOffsetSample(offset: number, rtt: number): void {
    this.offsetSamples.push({
      offset,
      rtt,
      timestamp: Date.now(),
    });

    // Keep only recent samples
    if (this.offsetSamples.length > OFFSET_SAMPLE_COUNT * 2) {
      this.offsetSamples.shift();
    }
  }

  private startTimeSync(): void {
    this.stopTimeSync();

    // Initial time sync
    setTimeout(() => this.sendTimePing(), 1000);

    // Periodic time sync
    this.timeSyncInterval = setInterval(() => {
      this.sendTimePing();
    }, TIME_SYNC_INTERVAL_MS);
  }

  private stopTimeSync(): void {
    if (this.timeSyncInterval) {
      clearInterval(this.timeSyncInterval);
      this.timeSyncInterval = null;
    }
  }

  private stopPositionReporting(): void {
    if (this.positionReportInterval) {
      clearInterval(this.positionReportInterval);
      this.positionReportInterval = null;
    }
  }

  private scheduleReconnect(): void {
    if (this.isIntentionallyClosed || this.reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
      return;
    }

    this.reconnectAttempts++;

    setTimeout(() => {
      if (!this.isIntentionallyClosed && this.config) {
        this.connectWebSocket();
      }
    }, RECONNECT_DELAY_MS * this.reconnectAttempts);
  }

  private hashPassword(password: string): string {
    // SHA-256 hash
    let hash = 0;
    for (let i = 0; i < password.length; i++) {
      const char = password.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    // Convert to hex-like string
    const hashHex = Math.abs(hash).toString(16).padStart(8, '0');
    return hashHex.repeat(8); // Pad to simulate 64-char hex
  }
}

// Singleton instance
export const syncPlayService = new SyncPlayService();

export default syncPlayService;
