/**
 * Phlix Media Server Client for Windows.
 *
 * @copyright 2026 Joe Huss <detain@interserver.net>
 */

import { defineComponent } from 'vue';
import type { SubtitleTrack } from '@phlix/contracts';

export interface StreamSubtitleTrack extends SubtitleTrack {
  forced?: boolean;
  default?: boolean;
}

export const SUBTITLE_OFF = 'off';

export interface SubtitleTrackListProps {
  tracks: StreamSubtitleTrack[];
  selectedTrackId: string | null;
  onTrackSelect: (trackId: string | null) => void;
}

/**
 * SubtitleTrackList displays a scrollable list of subtitle tracks with language,
 * codec, and forced/default badges. Includes an "Off" option to disable subtitles.
 * Clicking a track selects it.
 *
 * Designed for Electron/Windows dark theme (nocturne).
 */
const SubtitleTrackList = defineComponent<SubtitleTrackListProps>({
  props: {
    tracks: {
      type: Array as unknown as () => StreamSubtitleTrack[],
      default: () => []
    },
    selectedTrackId: {
      type: [String, null] as unknown as () => string | null,
      default: null
    },
    onTrackSelect: {
      type: Function as unknown as () => (trackId: string | null) => void,
      required: true
    }
  },
  setup(props) {
    const handleTrackClick = (trackId: string | null) => {
      props.onTrackSelect(trackId);
    };

    const isSelected = (trackId: string | null): boolean => {
      if (trackId === null) return props.selectedTrackId === null;
      return props.selectedTrackId === trackId;
    };

    return () => (
      <div class="subtitle-track-list" role="list" aria-label="Subtitle track list">
        <button
          class={`subtitle-track-item ${isSelected(null) ? 'subtitle-track-item--selected' : ''}`}
          role="listitem"
          onClick={() => handleTrackClick(null)}
          aria-label="Subtitles off"
          aria-pressed={isSelected(null)}
        >
          <span class="subtitle-track-language">Off</span>
        </button>

        {props.tracks.length === 0 ? (
          <div class="subtitle-track-list-empty">No subtitle tracks available</div>
        ) : (
          props.tracks.map((track) => (
            <button
              key={track.id}
              class={`subtitle-track-item ${isSelected(track.id) ? 'subtitle-track-item--selected' : ''}`}
              role="listitem"
              onClick={() => handleTrackClick(track.id)}
              aria-label={`${track.display_title || track.language || 'Unknown'}, ${track.codec}${track.forced ? ', forced' : ''}${track.default ? ', default' : ''}`}
              aria-pressed={isSelected(track.id)}
            >
              <span class="subtitle-track-language">{track.display_title || track.language || 'Unknown'}</span>
              <span class="subtitle-track-badges">
                {track.default && <span class="subtitle-track-badge subtitle-track-badge--default">Default</span>}
                {track.forced && <span class="subtitle-track-badge subtitle-track-badge--forced">Forced</span>}
              </span>
              <span class="subtitle-track-codec">{track.codec}</span>
            </button>
          ))
        )}
      </div>
    );
  }
});

export default SubtitleTrackList;
