/**
 * Phlix Media Server Client for Windows.
 *
 * @copyright 2026 Joe Huss <detain@interserver.net>
 */

import { describe, it, expect } from 'vitest';
import { mount } from '@vue/test-utils';
import ChapterList from '@/components/ChapterList';

describe('ChapterList', () => {
  it('renders empty state when no chapters provided', () => {
    const wrapper = mount(ChapterList, {
      props: {
        chapters: [],
        onChapterSeek: () => {}
      }
    });

    expect(wrapper.find('.chapter-list').exists()).toBe(true);
    expect(wrapper.find('.chapter-list-empty').exists()).toBe(true);
    expect(wrapper.find('.chapter-list-empty').text()).toBe('No chapters available');
  });

  it('renders chapter items with correct content', () => {
    const chapters = [
      { title: 'Introduction', startMs: 0 },
      { title: 'Chapter 1', startMs: 60000 },
      { title: 'Chapter 2', startMs: 180000 }
    ];

    const wrapper = mount(ChapterList, {
      props: { chapters, onChapterSeek: () => {} }
    });

    const items = wrapper.findAll('.chapter-item');
    expect(items).toHaveLength(3);

    expect(items[0].find('.chapter-title').text()).toBe('Introduction');
    expect(items[0].find('.chapter-time').text()).toBe('0:00');

    expect(items[1].find('.chapter-title').text()).toBe('Chapter 1');
    expect(items[1].find('.chapter-time').text()).toBe('1:00');

    expect(items[2].find('.chapter-title').text()).toBe('Chapter 2');
    expect(items[2].find('.chapter-time').text()).toBe('3:00');
  });

  it('formats hours correctly for long chapters', () => {
    const chapters = [
      { title: 'Long Chapter', startMs: 3661000 } // 1h 1m 1s
    ];

    const wrapper = mount(ChapterList, {
      props: { chapters, onChapterSeek: () => {} }
    });

    expect(wrapper.find('.chapter-time').text()).toBe('1:01:01');
  });

  it('calls onChapterSeek with correct startMs on click', () => {
    const chapters = [
      { title: 'Chapter 1', startMs: 60000 },
      { title: 'Chapter 2', startMs: 120000 }
    ];

    const onChapterSeek = vi.fn();
    const wrapper = mount(ChapterList, {
      props: { chapters, onChapterSeek }
    });

    const items = wrapper.findAll('.chapter-item');
    items[1].trigger('click');

    expect(onChapterSeek).toHaveBeenCalledWith(120000);
  });

  it('displays correct chapter indices', () => {
    const chapters = [
      { title: 'First', startMs: 0 },
      { title: 'Second', startMs: 1000 },
      { title: 'Third', startMs: 2000 }
    ];

    const wrapper = mount(ChapterList, {
      props: { chapters, onChapterSeek: () => {} }
    });

    const indices = wrapper.findAll('.chapter-index');
    expect(indices[0].text()).toBe('1');
    expect(indices[1].text()).toBe('2');
    expect(indices[2].text()).toBe('3');
  });

  it('has correct ARIA attributes', () => {
    const chapters = [
      { title: 'Introduction', startMs: 0 }
    ];

    const wrapper = mount(ChapterList, {
      props: { chapters, onChapterSeek: () => {} }
    });

    expect(wrapper.find('.chapter-list').attributes('role')).toBe('list');
    expect(wrapper.find('.chapter-list').attributes('aria-label')).toBe('Chapter list');
    expect(wrapper.find('.chapter-item').attributes('role')).toBe('listitem');
  });

  it('handles chapters with no title gracefully', () => {
    const chapters = [
      { title: '', startMs: 0 }
    ];

    const wrapper = mount(ChapterList, {
      props: { chapters, onChapterSeek: () => {} }
    });

    expect(wrapper.find('.chapter-title').text()).toBe('');
    expect(wrapper.find('.chapter-item').attributes('aria-label')).toContain(' at 0:00');
  });

  it('respects default empty chapters array', () => {
    const wrapper = mount(ChapterList, {
      props: {
        onChapterSeek: () => {}
      }
    });

    expect(wrapper.find('.chapter-list-empty').exists()).toBe(true);
  });
});