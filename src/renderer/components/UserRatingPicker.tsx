/**
 * Phlix Media Server Client for Windows.
 *
 * @copyright 2026 Joe Huss <detain@interserver.net>
 */

import { defineComponent, ref, onMounted } from 'vue';

interface Props {
  /** The media item ID to rate */
  mediaId: string;
  /** Callback fired after successful rating submission */
  onRated?: (score: number) => void;
}

interface UserRatingState {
  loading: boolean;
  userRating: number | null;
  error: string | null;
}

/**
 * UserRatingPicker provides an interactive 5-star rating input.
 * On mount, it fetches the user's existing rating for the media item.
 * On selection, it POSTs the rating to the ratings API.
 *
 * Designed for Electron/Windows dark theme (nocturne).
 */
const UserRatingPicker = defineComponent<Props>({
  props: {
    mediaId: {
      type: String,
      required: true
    },
    onRated: {
      type: Function as unknown as () => (score: number) => void,
      default: undefined
    }
  },
  setup(props) {
    const state = ref<UserRatingState>({
      loading: true,
      userRating: null,
      error: null
    });

    const hoveredRating = ref<number | null>(null);

    /**
     * Fetches the user's existing rating for this media item.
     * In a real implementation, this would call the ratings API.
     * For now, we simulate the API call structure.
     */
    const fetchUserRating = async (): Promise<void> => {
      state.value.loading = true;
      state.value.error = null;

      try {
        // Simulate API call - in production this would be:
        // const response = await fetch(`/api/v1/ratings/${props.mediaId}`, {
        //   headers: getAuthHeaders()
        // });
        // const data = await response.json();
        // state.value.userRating = data.rating;

        // Placeholder: simulate network delay
        await new Promise((resolve) => setTimeout(resolve, 300));
        state.value.userRating = null; // No rating yet
      } catch (_err) {
        state.value.error = 'Failed to load rating';
      } finally {
        state.value.loading = false;
      }
    };

    /**
     * Submits the user's rating to the API.
     */
    const submitRating = async (rating: number): Promise<void> => {
      state.value.error = null;

      try {
        // Simulate API call - in production this would be:
        // await fetch('/api/v1/ratings', {
        //   method: 'POST',
        //   headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        //   body: JSON.stringify({ mediaId: props.mediaId, rating })
        // });

        // Placeholder: simulate network delay
        await new Promise((resolve) => setTimeout(resolve, 200));
        state.value.userRating = rating;
        props.onRated?.(rating);
      } catch (_err) {
        state.value.error = 'Failed to submit rating';
      }
    };

    const handleStarClick = (rating: number): void => {
      if (state.value.loading) return;
      void submitRating(rating);
    };

    const handleStarHover = (rating: number | null): void => {
      hoveredRating.value = rating;
    };

    const getStarFill = (index: number): 'full' | 'half' | 'empty' => {
      const rating = hoveredRating.value ?? state.value.userRating ?? 0;
      const starValue = index + 1;

      if (rating >= starValue) return 'full';
      if (rating >= starValue - 0.5) return 'half';
      return 'empty';
    };

    onMounted(() => {
      void fetchUserRating();
    });

    return () => (
      <div class="user-rating-picker" role="group" aria-label="Rate this media">
        <div class="rating-picker-label">Your Rating</div>

        {state.value.loading && (
          <div class="rating-picker-loading" aria-live="polite">
            Loading...
          </div>
        )}

        {state.value.error && (
          <div class="rating-picker-error" role="alert">
            {state.value.error}
          </div>
        )}

        {!state.value.loading && !state.value.error && (
          <div
            class="rating-stars-interactive"
            onMouseleave={() => handleStarHover(null)}
          >
            {[1, 2, 3, 4, 5].map((rating) => (
              <button
                key={rating}
                type="button"
                class={`rating-star-btn rating-star--${getStarFill(rating - 1)}`}
                onClick={() => handleStarClick(rating)}
                onMouseenter={() => handleStarHover(rating)}
                disabled={state.value.loading}
                aria-label={`Rate ${rating} out of 5 stars`}
              >
                <span class="rating-star" aria-hidden="true">
                  {getStarFill(rating - 1) === 'full' ? '★' : '☆'}
                </span>
              </button>
            ))}
          </div>
        )}

        {state.value.userRating !== null && !state.value.loading && (
          <div class="rating-picker-status">
            You rated: {state.value.userRating} / 5
          </div>
        )}
      </div>
    );
  }
});

export default UserRatingPicker;
