/**
 * Phlix Media Server Client for Windows.
 *
 * @copyright 2026 Joe Huss <detain@interserver.net>
 */

import { defineComponent } from 'vue';
import type { MusicAlbum } from '@phlix/contracts';

interface Props {
  album: MusicAlbum;
  onSelect?: (id: number) => void;
}

const MusicAlbumCard = defineComponent<Props>((props) => {
  return () => (
    <div
      class="music-album-card"
      onClick={() => props.onSelect?.(props.album.id)}
    >
      <div class="cover-container">
        {props.album.albumArtUrl ? (
          <img src={props.album.albumArtUrl} alt={props.album.title} class="cover" />
        ) : (
          <div class="cover placeholder">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
              <circle cx="12" cy="12" r="10" />
              <circle cx="12" cy="12" r="3" />
              <path d="M12 2v3M12 19v3M2 12h3M19 12h3" />
            </svg>
          </div>
        )}
      </div>
      <div class="info">
        <span class="title">{props.album.title}</span>
        <div class="meta">
          {props.album.year && <span class="year">{props.album.year}</span>}
          <span class="tracks">{props.album.totalTracks} tracks</span>
        </div>
        {props.album.artist && (
          <span class="artist">{props.album.artist.name}</span>
        )}
      </div>
    </div>
  );
});

export default MusicAlbumCard;
