/**
 * Phlix Media Server Client for Windows.
 *
 * @copyright 2026 Joe Huss <detain@interserver.net>
 */

import { defineComponent, ref, onMounted } from 'vue';
import { ApiClient } from '@phlix/ui';
import { useMediaApiBase } from '@phlix/ui';
import type { UserRecommendation } from '@phlix/contracts';
import RecommendationCard from './RecommendationCard';

const RecommendationsPanel = defineComponent(() => {
  const apiBase = useMediaApiBase();
  const items = ref<UserRecommendation[]>([]);
  const loading = ref(true);
  const error = ref<string | null>(null);

  async function load(): Promise<void> {
    loading.value = true;
    error.value = null;
    try {
      const client = new ApiClient({ baseUrl: apiBase.value });
      const data = await client.get<{ recommendations: UserRecommendation[] }>(
        '/api/v1/me/recommendations',
        { limit: '20' },
      );
      items.value = data.recommendations ?? [];
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Failed to load';
    } finally {
      loading.value = false;
    }
  }

  function onSelect(id: string): void {
    // Navigate to player - use the router
    const router = (window as any).$router;
    if (router) {
      router.push(`/appplayer/${id}`);
    }
  }

  onMounted(load);

  return () => (
    <div class="recommendations-panel">
      <h2>For You</h2>
      {loading.value && <div class="loading">Loading...</div>}
      {error.value && <div class="error">{error.value}</div>}
      {!loading.value && items.value.length === 0 && <div class="empty">No recommendations yet</div>}
      {!loading.value && items.value.length > 0 && (
        <div class="recommendations-grid">
          {items.value.map((item) => (
            <RecommendationCard key={item.id} item={item} onSelect={onSelect} />
          ))}
        </div>
      )}
    </div>
  );
});

export default RecommendationsPanel;
