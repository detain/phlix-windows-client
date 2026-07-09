/**
 * Phlix Media Server Client for Windows.
 *
 * @copyright 2026 Joe Huss <detain@interserver.net>
 */

import { defineComponent } from 'vue';
import type { AudioTrack } from '@phlix/contracts';

export interface StreamAudioTrack extends AudioTrack {
  bitrate?: number;
}

export interface AudioTrackListProps {
  tracks: StreamAudioTrack[];
  selectedTrackId: string | null;
  onTrackSelect: (trackId: string) => void;
}

/**
 * AudioTrackList displays a scrollable list of audio tracks with language,
 * codec, channels, and bitrate information. Clicking a track selects it.
 *
 * Designed for Electron/Windows dark theme (nocturne).
 */
const AudioTrackList = defineComponent<AudioTrackListProps>({
  props: {
    tracks: {
      type: Array as unknown as () => StreamAudioTrack[],
      default: () => []
    },
    selectedTrackId: {
      type: [String, null] as unknown as () => string | null,
      default: null
    },
    onTrackSelect: {
      type: Function as unknown as () => (trackId: string) => void,
      required: true
    }
  },
  setup(props) {
    /**
     * Formats channel count into a human-readable string.
     */
    const formatChannels = (channels: number): string => {
      if (channels === 1) return 'Mono';
      if (channels === 2) return 'Stereo';
      if (channels === 6) return '5.1';
      if (channels === 8) return '7.1';
      return `${channels} ch`;
    };

    /**
     * Formats bitrate into a human-readable string (kbps or Mbps).
     */
    const formatBitrate = (bitrate: number | undefined): string => {
      if (bitrate === undefined) return '';
      if (bitrate >= 1_000_000) return `${(bitrate / 1_000_000).toFixed(1)} Mbps`;
      if (bitrate >= 1_000) return `${Math.round(bitrate / 1_000)} kbps`;
      return `${bitrate} bps`;
    };

    const handleTrackClick = (trackId: string) => {
      props.onTrackSelect(trackId);
    };

    return () => (
      <div class="audio-track-list" role="list" aria-label="Audio track list">
        {props.tracks.length === 0 ? (
          <div class="audio-track-list-empty">No audio tracks available</div>
        ) : (
          props.tracks.map((track) => (
            <button
              key={track.id}
              class={`audio-track-item ${props.selectedTrackId === track.id ? 'audio-track-item--selected' : ''}`}
              role="listitem"
              onClick={() => handleTrackClick(track.id)}
              aria-label={`${track.display_title || track.language}, ${track.codec}, ${formatChannels(track.channels)}${track.bitrate ? `, ${formatBitrate(track.bitrate)}` : ''}`}
              aria-pressed={props.selectedTrackId === track.id}
            >
              <span class="audio-track-language">{track.display_title || track.language || 'Unknown'}</span>
              <span class="audio-track-meta">
                <span class="audio-track-codec">{track.codec}</span>
                <span class="audio-track-separator">•</span>
                <span class="audio-track-channels">{formatChannels(track.channels)}</span>
                {track.bitrate && (
                  <>
                    <span class="audio-track-separator">•</span>
                    <span class="audio-track-bitrate">{formatBitrate(track.bitrate)}</span>
                  </>
                )}
              </span>
            </button>
          ))
        )}
      </div>
    );
  }
});

export default AudioTrackList;
