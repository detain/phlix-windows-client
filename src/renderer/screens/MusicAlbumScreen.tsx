/**
 * Phlix Media Server Client for Windows.
 *
 * @copyright 2026 Joe Huss <detain@interserver.net>
 */

import { defineComponent, ref, computed, onMounted } from 'vue';
import { ApiClient } from '@phlix/ui';
import { useMediaApiBase } from '@phlix/ui';
import type { MusicAlbum } from '@phlix/contracts';
import MusicAlbumCard from '../components/MusicAlbumCard';

interface Props {
  artistId: number;
  onBack?: () => void;
  onTrackPlay?: (id: number) => void;
}

function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

const MusicAlbumScreen = defineComponent<Props>((props) => {
  const apiBase = useMediaApiBase();
  const artistAlbums = ref<MusicAlbum[]>([]);
  const currentAlbum = ref<MusicAlbum | null>(null);
  const loading = ref(true);
  const error = ref<string | null>(null);

  const allAlbums = ref<MusicAlbum[]>([]);

  const filteredAlbums = computed(() => {
    if (!props.artistId) return allAlbums.value;
    return allAlbums.value.filter((a) => a.artistId === props.artistId);
  });

  async function load(): Promise<void> {
    loading.value = true;
    error.value = null;
    try {
      const client = new ApiClient({ baseUrl: apiBase.value });
      const data = await client.get<{ albums: MusicAlbum[] }>('/api/v1/music/albums');
      allAlbums.value = data.albums ?? [];
      artistAlbums.value = filteredAlbums.value;
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Failed to load albums';
    } finally {
      loading.value = false;
    }
  }

  async function loadAlbum(id: number): Promise<void> {
    loading.value = true;
    error.value = null;
    currentAlbum.value = null;
    try {
      const client = new ApiClient({ baseUrl: apiBase.value });
      const data = await client.get<MusicAlbum>(`/api/v1/music/albums/${id}`);
      currentAlbum.value = data;
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Failed to load album';
    } finally {
      loading.value = false;
    }
  }

  function handleAlbumSelect(id: number): void {
    void loadAlbum(id);
  }

  function handleTrackPlay(id: number): void {
    props.onTrackPlay?.(id);
  }

  onMounted(load);

  return () => (
    <div class="music-album-screen">
      {currentAlbum.value ? (
        <>
          <div class="album-header">
            <button class="back-btn" onClick={() => { currentAlbum.value = null; }}>
              Back to Albums
            </button>
            <div class="album-info">
              {currentAlbum.value.albumArtUrl ? (
                <img
                  src={currentAlbum.value.albumArtUrl}
                  alt={currentAlbum.value.title}
                  class="album-art"
                />
              ) : (
                <div class="album-art placeholder">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                    <circle cx="12" cy="12" r="10" />
                    <circle cx="12" cy="12" r="3" />
                    <path d="M12 2v3M12 19v3M2 12h3M19 12h3" />
                  </svg>
                </div>
              )}
              <div class="album-details">
                <h2 class="album-title">{currentAlbum.value.title}</h2>
                {currentAlbum.value.artist && (
                  <p class="album-artist">{currentAlbum.value.artist.name}</p>
                )}
                {currentAlbum.value.year && (
                  <p class="album-year">
                    {currentAlbum.value.year} · {currentAlbum.value.totalTracks} tracks
                  </p>
                )}
              </div>
            </div>
          </div>
          <div class="track-list">
            {currentAlbum.value.tracks?.map((track) => (
              <div
                key={track.id}
                class="track-item"
                onClick={() => handleTrackPlay(track.id)}
              >
                <span class="track-number">
                  {track.trackNumber ?? '—'}
                </span>
                <div class="track-info">
                  <span class="track-title">{track.title}</span>
                  {track.artist && (
                    <span class="track-artist">{track.artist.name}</span>
                  )}
                </div>
                <span class="track-duration">{formatDuration(track.durationSecs)}</span>
                <button
                  class="play-btn"
                  onClick={(e) => { e.stopPropagation(); handleTrackPlay(track.id); }}
                >
                  <svg viewBox="0 0 24 24" fill="currentColor">
                    <path d="M8 5v14l11-7z" />
                  </svg>
                </button>
              </div>
            ))}
          </div>
        </>
      ) : (
        <>
          <div class="album-header">
            <button class="back-btn" onClick={props.onBack}>
              Back
            </button>
            <h2 class="album-list-title">Albums</h2>
          </div>
          {loading.value && <div class="loading">Loading...</div>}
          {error.value && <div class="error">{error.value}</div>}
          {!loading.value && filteredAlbums.value.length === 0 && (
            <div class="empty">No albums found</div>
          )}
          {!loading.value && filteredAlbums.value.length > 0 && (
            <div class="music-album-screen__grid">
              {filteredAlbums.value.map((album) => (
                <MusicAlbumCard
                  key={album.id}
                  album={album}
                  onSelect={handleAlbumSelect}
                />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
});

export default MusicAlbumScreen;
