import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { SkipButton } from '../../../src/renderer/components/SkipButton';
import type { PlaybackMarkers } from '../../../src/renderer/utils/api';

// Mock CSS imports
vi.mock('../../../src/renderer/components/SkipButton.css', () => ({}));

describe('SkipButton', () => {
  const defaultMarkers: PlaybackMarkers = {
    skip_intro_start: 10,
    skip_intro_end: 90,
    skip_outro_start: 2340,
    skip_outro_end: 2520
  };

  const mockOnSkip = vi.fn();

  beforeEach(() => {
    mockOnSkip.mockClear();
  });

  describe('button visibility', () => {
    it('shows Skip Intro button when currentTime is within intro marker range', () => {
      render(
        <SkipButton
          markers={defaultMarkers}
          currentTime={50}
          onSkip={mockOnSkip}
        />
      );

      expect(screen.getByText('Skip Intro')).toBeInTheDocument();
      expect(screen.queryByText('Skip Outro')).not.toBeInTheDocument();
    });

    it('shows Skip Outro button when currentTime is within outro marker range', () => {
      render(
        <SkipButton
          markers={defaultMarkers}
          currentTime={2400}
          onSkip={mockOnSkip}
        />
      );

      expect(screen.getByText('Skip Outro')).toBeInTheDocument();
      expect(screen.queryByText('Skip Intro')).not.toBeInTheDocument();
    });

    it('hides button when currentTime is outside all marker ranges', () => {
      render(
        <SkipButton
          markers={defaultMarkers}
          currentTime={500}
          onSkip={mockOnSkip}
        />
      );

      expect(screen.queryByText('Skip Intro')).not.toBeInTheDocument();
      expect(screen.queryByText('Skip Outro')).not.toBeInTheDocument();
    });

    it('shows nothing when markers is null', () => {
      render(
        <SkipButton
          markers={null}
          currentTime={50}
          onSkip={mockOnSkip}
        />
      );

      expect(screen.queryByText('Skip Intro')).not.toBeInTheDocument();
      expect(screen.queryByText('Skip Outro')).not.toBeInTheDocument();
    });

    it('shows nothing when markers is undefined', () => {
      render(
        <SkipButton
          markers={undefined}
          currentTime={50}
          onSkip={mockOnSkip}
        />
      );

      expect(screen.queryByText('Skip Intro')).not.toBeInTheDocument();
      expect(screen.queryByText('Skip Outro')).not.toBeInTheDocument();
    });
  });

  describe('button behavior at boundary times', () => {
    it('shows intro button at exact intro start time', () => {
      render(
        <SkipButton
          markers={defaultMarkers}
          currentTime={10}
          onSkip={mockOnSkip}
        />
      );

      expect(screen.getByText('Skip Intro')).toBeInTheDocument();
    });

    it('shows intro button at exact intro end time', () => {
      render(
        <SkipButton
          markers={defaultMarkers}
          currentTime={90}
          onSkip={mockOnSkip}
        />
      );

      expect(screen.getByText('Skip Intro')).toBeInTheDocument();
    });

    it('shows outro button at exact outro start time', () => {
      render(
        <SkipButton
          markers={defaultMarkers}
          currentTime={2340}
          onSkip={mockOnSkip}
        />
      );

      expect(screen.getByText('Skip Outro')).toBeInTheDocument();
    });

    it('shows outro button at exact outro end time', () => {
      render(
        <SkipButton
          markers={defaultMarkers}
          currentTime={2520}
          onSkip={mockOnSkip}
        />
      );

      expect(screen.getByText('Skip Outro')).toBeInTheDocument();
    });
  });

  describe('seek action', () => {
    it('seeks to skip_intro_end when Skip Intro button is clicked', () => {
      render(
        <SkipButton
          markers={defaultMarkers}
          currentTime={50}
          onSkip={mockOnSkip}
        />
      );

      fireEvent.click(screen.getByText('Skip Intro'));
      expect(mockOnSkip).toHaveBeenCalledWith(90);
    });

    it('seeks to skip_outro_end when Skip Outro button is clicked', () => {
      render(
        <SkipButton
          markers={defaultMarkers}
          currentTime={2400}
          onSkip={mockOnSkip}
        />
      );

      fireEvent.click(screen.getByText('Skip Outro'));
      expect(mockOnSkip).toHaveBeenCalledWith(2520);
    });
  });

  describe('null marker handling', () => {
    it('shows nothing when skip_intro_start is null', () => {
      const markersWithNullIntro: PlaybackMarkers = {
        skip_intro_start: null,
        skip_intro_end: null,
        skip_outro_start: 2340,
        skip_outro_end: 2520
      };

      render(
        <SkipButton
          markers={markersWithNullIntro}
          currentTime={50}
          onSkip={mockOnSkip}
        />
      );

      expect(screen.queryByText('Skip Intro')).not.toBeInTheDocument();
    });

    it('shows nothing when skip_outro_start is null', () => {
      const markersWithNullOutro: PlaybackMarkers = {
        skip_intro_start: 10,
        skip_intro_end: 90,
        skip_outro_start: null,
        skip_outro_end: null
      };

      render(
        <SkipButton
          markers={markersWithNullOutro}
          currentTime={2400}
          onSkip={mockOnSkip}
        />
      );

      expect(screen.queryByText('Skip Outro')).not.toBeInTheDocument();
    });

    it('shows intro button even when outro markers are null', () => {
      const markersWithNullOutro: PlaybackMarkers = {
        skip_intro_start: 10,
        skip_intro_end: 90,
        skip_outro_start: null,
        skip_outro_end: null
      };

      render(
        <SkipButton
          markers={markersWithNullOutro}
          currentTime={50}
          onSkip={mockOnSkip}
        />
      );

      expect(screen.getByText('Skip Intro')).toBeInTheDocument();
      expect(screen.queryByText('Skip Outro')).not.toBeInTheDocument();
    });

    it('shows outro button even when intro markers are null', () => {
      const markersWithNullIntro: PlaybackMarkers = {
        skip_intro_start: null,
        skip_intro_end: null,
        skip_outro_start: 2340,
        skip_outro_end: 2520
      };

      render(
        <SkipButton
          markers={markersWithNullIntro}
          currentTime={2400}
          onSkip={mockOnSkip}
        />
      );

      expect(screen.getByText('Skip Outro')).toBeInTheDocument();
      expect(screen.queryByText('Skip Intro')).not.toBeInTheDocument();
    });
  });
});
