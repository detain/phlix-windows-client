/**
 * Phlix Media Server Client for Windows.
 *
 * @copyright 2026 Joe Huss <detain@interserver.net>
 */

import { defineComponent } from 'vue';
import type { UserRecommendation } from '@phlix/contracts';

interface Props {
  item: UserRecommendation;
  onSelect?: (id: string) => void;
}

const RecommendationCard = defineComponent<Props>((props) => {
  const scorePercent = Math.round(props.item.score * 100);

  return () => (
    <div class="recommendation-card" onClick={() => props.onSelect?.(props.item.id)}>
      <div class="poster-container">
        {props.item.posterUrl ? (
          <img src={props.item.posterUrl} alt={props.item.title} class="poster" />
        ) : (
          <div class="poster placeholder" />
        )}
      </div>
      <div class="info">
        <span class="title">{props.item.title}</span>
        {props.item.year && <span class="year">{props.item.year}</span>}
        <span class="reason-badge">Because You Watched</span>
        <span class="score">{scorePercent}% match</span>
      </div>
    </div>
  );
});

export default RecommendationCard;
