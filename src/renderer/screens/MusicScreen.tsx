/**
 * Phlix Media Server Client for Windows.
 *
 * @copyright 2026 Joe Huss <detain@interserver.net>
 */

import { defineComponent, ref, onMounted } from 'vue';
import { ApiClient } from '@phlix/ui';
import { useMediaApiBase } from '@phlix/ui';
import type { MusicArtist, MusicAlbum } from '@phlix/contracts';
import MusicArtistCard from '../components/MusicArtistCard';

interface Props {
  onArtistSelect?: (id: number) => void;
  onAlbumSelect?: (id: number) => void;
}

const MusicScreen = defineComponent<Props>((props) => {
  const apiBase = useMediaApiBase();
  const artists = ref<MusicArtist[]>([]);
  const albums = ref<MusicAlbum[]>([]);
  const loading = ref(true);
  const error = ref<string | null>(null);

  async function load(): Promise<void> {
    loading.value = true;
    error.value = null;
    try {
      const client = new ApiClient({ baseUrl: apiBase.value });
      const [artistsData, albumsData] = await Promise.all([
        client.get<{ artists: MusicArtist[] }>('/api/v1/music/artists'),
        client.get<{ albums: MusicAlbum[] }>('/api/v1/music/albums'),
      ]);
      artists.value = artistsData.artists ?? [];
      albums.value = albumsData.albums ?? [];
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Failed to load music';
    } finally {
      loading.value = false;
    }
  }

  function handleArtistSelect(id: number): void {
    props.onArtistSelect?.(id);
  }

  onMounted(load);

  return () => (
    <div class="music-screen">
      <h2 class="music-screen__title">Artists</h2>
      {loading.value && <div class="loading">Loading...</div>}
      {error.value && <div class="error">{error.value}</div>}
      {!loading.value && artists.value.length === 0 && (
        <div class="empty">No artists found</div>
      )}
      {!loading.value && artists.value.length > 0 && (
        <div class="music-screen__grid">
          {artists.value.map((artist) => (
            <MusicArtistCard
              key={artist.id}
              artist={artist}
              onSelect={handleArtistSelect}
            />
          ))}
        </div>
      )}
    </div>
  );
});

export default MusicScreen;
