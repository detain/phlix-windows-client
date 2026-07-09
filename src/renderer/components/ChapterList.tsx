/**
 * Phlix Media Server Client for Windows.
 *
 * @copyright 2026 Joe Huss <detain@interserver.net>
 */

import { defineComponent } from 'vue';

export interface ChapterMarker {
  title: string;
  startMs: number;
}

interface Props {
  chapters: ChapterMarker[];
  onChapterSeek: (startMs: number) => void;
}

/**
 * ChapterList displays a scrollable list of chapter markers with titles
 * and start times. Clicking a chapter triggers onChapterSeek.
 *
 * Designed for Electron/Windows dark theme (nocturne).
 */
const ChapterList = defineComponent<Props>((props) => {
  /**
   * Formats milliseconds to mm:ss or h:mm:ss format.
   */
  const formatTime = (ms: number): string => {
    const totalSeconds = Math.floor(ms / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    }
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  const handleChapterClick = (startMs: number) => {
    props.onChapterSeek(startMs);
  };

  return () => (
    <div class="chapter-list" role="list" aria-label="Chapter list">
      {props.chapters.length === 0 ? (
        <div class="chapter-list-empty">No chapters available</div>
      ) : (
        props.chapters.map((chapter, index) => (
          <button
            key={index}
            class="chapter-item"
            role="listitem"
            onClick={() => handleChapterClick(chapter.startMs)}
            aria-label={`${chapter.title} at ${formatTime(chapter.startMs)}`}
          >
            <span class="chapter-index">{index + 1}</span>
            <span class="chapter-time">{formatTime(chapter.startMs)}</span>
            <span class="chapter-title">{chapter.title}</span>
          </button>
        ))
      )}
    </div>
  );
});

ChapterList.props = {
  chapters: {
    type: Array as unknown as () => ChapterMarker[],
    default: () => []
  },
  onChapterSeek: {
    type: Function as unknown as () => (startMs: number) => void,
    required: true
  }
};

export default ChapterList;