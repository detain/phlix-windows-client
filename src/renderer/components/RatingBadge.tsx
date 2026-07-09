/**
 * Phlix Media Server Client for Windows.
 *
 * @copyright 2026 Joe Huss <detain@interserver.net>
 */

import { defineComponent, computed } from 'vue';

interface Props {
  score: number | null;
}

/**
 * RatingBadge displays a 5-star visual rating with half-star precision
 * and a numeric label showing the score out of 10.
 *
 * Designed for Electron/Windows dark theme (nocturne).
 */
const RatingBadge = defineComponent<Props>((props) => {
  /**
   * Converts a 0-10 score to a 0-5 star rating with half-star precision.
   * A score of 7.5 => 3.75 stars
   */
  const starRating = computed(() => {
    if (props.score === null) return 0;
    return props.score / 2;
  });

  /**
   * Returns an array of 5 items representing star fill states:
   * 'full', 'half', 'empty'
   */
  const stars = computed(() => {
    const rating = starRating.value;
    return Array.from({ length: 5 }, (_, i) => {
      const starValue = i + 1;
      if (rating >= starValue) return 'full';
      if (rating >= starValue - 0.5) return 'half';
      return 'empty';
    });
  });

  const scoreLabel = computed(() => {
    if (props.score === null) return '—';
    return `${props.score.toFixed(1)}/10`;
  });

  return () => (
    <div class="rating-badge" title={`Score: ${props.score ?? 'unrated'}`}>
      <div class="rating-stars" aria-label={`Rating: ${starRating.value} out of 5 stars`}>
        {stars.value.map((fill, i) => (
          <span
            key={i}
            class={`rating-star rating-star--${fill}`}
            aria-hidden="true"
          >
            {fill === 'full' ? '★' : fill === 'half' ? '★' : '☆'}
          </span>
        ))}
      </div>
      <span class="rating-label">{scoreLabel.value}</span>
    </div>
  );
});

export default RatingBadge;
