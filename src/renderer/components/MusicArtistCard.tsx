/**
 * Phlix Media Server Client for Windows.
 *
 * @copyright 2026 Joe Huss <detain@interserver.net>
 */

import { defineComponent } from 'vue';
import type { MusicArtist } from '@phlix/contracts';

interface Props {
  artist: MusicArtist;
  onSelect?: (id: number) => void;
}

const MusicArtistCard = defineComponent<Props>((props) => {
  return () => (
    <div
      class="music-artist-card"
      onClick={() => props.onSelect?.(props.artist.id)}
    >
      <div class="poster-container">
        {props.artist.imageUrl ? (
          <img src={props.artist.imageUrl} alt={props.artist.name} class="poster" />
        ) : (
          <div class="poster placeholder">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
              <circle cx="12" cy="8" r="4" />
              <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" />
            </svg>
          </div>
        )}
      </div>
      <div class="info">
        <span class="name">{props.artist.name}</span>
        {props.artist.albumCount !== undefined && (
          <span class="album-count">
            {props.artist.albumCount} {props.artist.albumCount === 1 ? 'album' : 'albums'}
          </span>
        )}
      </div>
    </div>
  );
});

export default MusicArtistCard;
