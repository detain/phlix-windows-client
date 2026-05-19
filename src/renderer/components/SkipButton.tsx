import React, { useMemo } from 'react';
import { PlaybackMarkers } from '../utils/api';
import './SkipButton.css';

interface SkipButtonProps {
  markers: PlaybackMarkers | null | undefined;
  currentTime: number;
  onSkip: (time: number) => void;
}

interface SkipButtonState {
  type: 'intro' | 'outro' | null;
  endTime: number;
}

export const SkipButton: React.FC<SkipButtonProps> = ({ markers, currentTime, onSkip }) => {
  const skipState = useMemo<SkipButtonState>(() => {
    if (!markers) {
      return { type: null, endTime: 0 };
    }

    const { skip_intro_start, skip_intro_end, skip_outro_start, skip_outro_end } = markers;

    // Check if we're in the intro range
    if (
      skip_intro_start !== null &&
      skip_intro_end !== null &&
      currentTime >= skip_intro_start &&
      currentTime <= skip_intro_end
    ) {
      return { type: 'intro', endTime: skip_intro_end };
    }

    // Check if we're in the outro range
    if (
      skip_outro_start !== null &&
      skip_outro_end !== null &&
      currentTime >= skip_outro_start &&
      currentTime <= skip_outro_end
    ) {
      return { type: 'outro', endTime: skip_outro_end };
    }

    return { type: null, endTime: 0 };
  }, [markers, currentTime]);

  if (!skipState.type) {
    return null;
  }

  const handleClick = () => {
    onSkip(skipState.endTime);
  };

  return (
    <button
      className={`skip-marker-btn skip-marker-btn--${skipState.type}`}
      onClick={handleClick}
      aria-label={`Skip ${skipState.type === 'intro' ? 'Intro' : 'Outro'}`}
    >
      <span className="skip-marker-btn__icon">⏭</span>
      <span className="skip-marker-btn__text">
        Skip {skipState.type === 'intro' ? 'Intro' : 'Outro'}
      </span>
    </button>
  );
};

export default SkipButton;
