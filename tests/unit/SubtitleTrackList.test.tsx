/**
 * Phlix Media Server Client for Windows.
 *
 * @copyright 2026 Joe Huss <detain@interserver.net>
 */

import { describe, it, expect } from 'vitest';
import { mount } from '@vue/test-utils';
import SubtitleTrackList, { SUBTITLE_OFF } from '@/components/SubtitleTrackList';

describe('SubtitleTrackList', () => {
  const defaultProps = {
    tracks: [],
    selectedTrackId: null,
    onTrackSelect: () => {}
  };

  it('renders Off button as first option', () => {
    const wrapper = mount(SubtitleTrackList, {
      props: defaultProps
    });

    const offButton = wrapper.find('.subtitle-track-item');
    expect(offButton.exists()).toBe(true);
    expect(offButton.find('.subtitle-track-language').text()).toBe('Off');
  });

  it('renders empty message when no tracks', () => {
    const wrapper = mount(SubtitleTrackList, {
      props: defaultProps
    });

    expect(wrapper.find('.subtitle-track-list-empty').text()).toBe('No subtitle tracks available');
  });

  it('renders tracks when provided', () => {
    const tracks = [
      { id: 'sub-1', language: 'English', codec: 'UTF-8' },
      { id: 'sub-2', language: 'Spanish', codec: 'UTF-8' }
    ];

    const wrapper = mount(SubtitleTrackList, {
      props: { ...defaultProps, tracks }
    });

    const items = wrapper.findAll('.subtitle-track-item');
    expect(items).toHaveLength(3); // Off + 2 tracks
    expect(items[1].find('.subtitle-track-language').text()).toBe('English');
    expect(items[2].find('.subtitle-track-language').text()).toBe('Spanish');
  });

  it('shows Off as selected when selectedTrackId is null', () => {
    const wrapper = mount(SubtitleTrackList, {
      props: { ...defaultProps, selectedTrackId: null }
    });

    const items = wrapper.findAll('.subtitle-track-item');
    expect(items[0].classes()).toContain('subtitle-track-item--selected');
    expect(items[0].attributes('aria-pressed')).toBe('true');
  });

  it('calls onTrackSelect with null when Off is clicked', () => {
    const onTrackSelect = vi.fn();
    const wrapper = mount(SubtitleTrackList, {
      props: { ...defaultProps, onTrackSelect }
    });

    wrapper.findAll('.subtitle-track-item')[0].trigger('click');
    expect(onTrackSelect).toHaveBeenCalledWith(null);
  });

  it('calls onTrackSelect with track ID when track is clicked', () => {
    const onTrackSelect = vi.fn();
    const tracks = [{ id: 'sub-1', language: 'English', codec: 'UTF-8' }];

    const wrapper = mount(SubtitleTrackList, {
      props: { ...defaultProps, tracks, onTrackSelect }
    });

    wrapper.findAll('.subtitle-track-item')[1].trigger('click');
    expect(onTrackSelect).toHaveBeenCalledWith('sub-1');
  });

  it('applies selected class to selected track', () => {
    const tracks = [
      { id: 'sub-1', language: 'English', codec: 'UTF-8' },
      { id: 'sub-2', language: 'Spanish', codec: 'UTF-8' }
    ];

    const wrapper = mount(SubtitleTrackList, {
      props: { ...defaultProps, tracks, selectedTrackId: 'sub-2' }
    });

    const items = wrapper.findAll('.subtitle-track-item');
    expect(items[0].classes()).not.toContain('subtitle-track-item--selected');
    expect(items[1].classes()).not.toContain('subtitle-track-item--selected');
    expect(items[2].classes()).toContain('subtitle-track-item--selected');
  });

  it('displays default badge when track has default flag', () => {
    const tracks = [
      { id: 'sub-1', language: 'English', codec: 'UTF-8', default: true }
    ];

    const wrapper = mount(SubtitleTrackList, {
      props: { ...defaultProps, tracks }
    });

    expect(wrapper.find('.subtitle-track-badge--default').text()).toBe('Default');
  });

  it('displays forced badge when track has forced flag', () => {
    const tracks = [
      { id: 'sub-1', language: 'Spanish', codec: 'UTF-8', forced: true }
    ];

    const wrapper = mount(SubtitleTrackList, {
      props: { ...defaultProps, tracks }
    });

    expect(wrapper.find('.subtitle-track-badge--forced').text()).toBe('Forced');
  });

  it('displays both default and forced badges', () => {
    const tracks = [
      { id: 'sub-1', language: 'English', codec: 'UTF-8', default: true, forced: true }
    ];

    const wrapper = mount(SubtitleTrackList, {
      props: { ...defaultProps, tracks }
    });

    expect(wrapper.findAll('.subtitle-track-badge')).toHaveLength(2);
  });

  it('has correct ARIA attributes', () => {
    const tracks = [
      { id: 'sub-1', language: 'English', codec: 'UTF-8' }
    ];

    const wrapper = mount(SubtitleTrackList, {
      props: { ...defaultProps, tracks }
    });

    expect(wrapper.find('.subtitle-track-list').attributes('role')).toBe('list');
    expect(wrapper.find('.subtitle-track-list').attributes('aria-label')).toBe('Subtitle track list');
  });

  it('uses display_title when available', () => {
    const tracks = [
      { id: 'sub-1', language: 'en', codec: 'UTF-8', display_title: 'English (SDH)' }
    ];

    const wrapper = mount(SubtitleTrackList, {
      props: { ...defaultProps, tracks }
    });

    expect(wrapper.findAll('.subtitle-track-item')[1].find('.subtitle-track-language').text()).toBe('English (SDH)');
  });

  it('falls back to language when display_title is not available', () => {
    const tracks = [
      { id: 'sub-1', language: 'Japanese', codec: 'UTF-8' }
    ];

    const wrapper = mount(SubtitleTrackList, {
      props: { ...defaultProps, tracks }
    });

    expect(wrapper.findAll('.subtitle-track-item')[1].find('.subtitle-track-language').text()).toBe('Japanese');
  });

  it('exports SUBTITLE_OFF constant', () => {
    expect(SUBTITLE_OFF).toBe('off');
  });
});
