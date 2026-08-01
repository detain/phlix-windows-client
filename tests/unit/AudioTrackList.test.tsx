/**
 * Phlix Media Server Client for Windows.
 *
 * @copyright 2026 Joe Huss <detain@interserver.net>
 */

import { describe, it, expect } from 'vitest';
import { mount } from '@vue/test-utils';
import AudioTrackList from '@/components/AudioTrackList';

describe('AudioTrackList', () => {
  const defaultProps = {
    tracks: [],
    selectedTrackId: null,
    onTrackSelect: () => {}
  };

  it('renders empty state when no tracks provided', () => {
    const wrapper = mount(AudioTrackList, {
      props: defaultProps
    });

    expect(wrapper.find('.audio-track-list').exists()).toBe(true);
    expect(wrapper.find('.audio-track-list-empty').text()).toBe('No audio tracks available');
  });

  it('renders a single track correctly', () => {
    const tracks = [
      {
        id: 'track-1',
        language: 'English',
        codec: 'AAC',
        channels: 2,
        display_title: 'English'
      }
    ];

    const wrapper = mount(AudioTrackList, {
      props: { ...defaultProps, tracks }
    });

    const items = wrapper.findAll('.audio-track-item');
    expect(items).toHaveLength(1);
    expect(items[0].find('.audio-track-language').text()).toBe('English');
    expect(items[0].find('.audio-track-codec').text()).toBe('AAC');
    expect(items[0].find('.audio-track-channels').text()).toBe('Stereo');
  });

  it('renders multiple tracks', () => {
    const tracks = [
      { id: 't1', language: 'English', codec: 'AAC', channels: 2 },
      { id: 't2', language: 'Spanish', codec: 'AC3', channels: 6 },
      { id: 't3', language: 'French', codec: 'DTS', channels: 8 }
    ];

    const wrapper = mount(AudioTrackList, {
      props: { ...defaultProps, tracks }
    });

    const items = wrapper.findAll('.audio-track-item');
    expect(items).toHaveLength(3);
    expect(items[0].find('.audio-track-language').text()).toBe('English');
    expect(items[1].find('.audio-track-language').text()).toBe('Spanish');
    expect(items[1].find('.audio-track-channels').text()).toBe('5.1');
    expect(items[2].find('.audio-track-channels').text()).toBe('7.1');
  });

  it('applies selected class to selected track', () => {
    const tracks = [
      { id: 't1', language: 'English', codec: 'AAC', channels: 2 },
      { id: 't2', language: 'Spanish', codec: 'AC3', channels: 2 }
    ];

    const wrapper = mount(AudioTrackList, {
      props: { ...defaultProps, tracks, selectedTrackId: 't2' }
    });

    const items = wrapper.findAll('.audio-track-item');
    expect(items[0].classes()).not.toContain('audio-track-item--selected');
    expect(items[1].classes()).toContain('audio-track-item--selected');
  });

  it('calls onTrackSelect when track is clicked', () => {
    const onTrackSelect = vi.fn();
    const tracks = [
      { id: 't1', language: 'English', codec: 'AAC', channels: 2 }
    ];

    const wrapper = mount(AudioTrackList, {
      props: { ...defaultProps, tracks, onTrackSelect }
    });

    wrapper.findAll('.audio-track-item')[0].trigger('click');
    expect(onTrackSelect).toHaveBeenCalledWith('t1');
  });

  it('displays bitrate when present', () => {
    const tracks = [
      { id: 't1', language: 'English', codec: 'AAC', channels: 2, bitrate: 128000 }
    ];

    const wrapper = mount(AudioTrackList, {
      props: { ...defaultProps, tracks }
    });

    expect(wrapper.find('.audio-track-bitrate').text()).toBe('128 kbps');
  });

  it('displays Mbps for high bitrate', () => {
    const tracks = [
      { id: 't1', language: 'English', codec: 'DTS', channels: 8, bitrate: 1500000 }
    ];

    const wrapper = mount(AudioTrackList, {
      props: { ...defaultProps, tracks }
    });

    expect(wrapper.find('.audio-track-bitrate').text()).toBe('1.5 Mbps');
  });

  it('formats channel counts correctly', () => {
    const tracks = [
      { id: 't1', language: 'Mono', codec: 'AAC', channels: 1 },
      { id: 't2', language: 'Stereo', codec: 'AAC', channels: 2 },
      { id: 't3', language: '5.1', codec: 'AC3', channels: 6 },
      { id: 't4', language: '7.1', codec: 'DTS', channels: 8 },
      { id: 't5', language: 'Unknown', codec: 'AAC', channels: 4 }
    ];

    const wrapper = mount(AudioTrackList, {
      props: { ...defaultProps, tracks }
    });

    const items = wrapper.findAll('.audio-track-item');
    expect(items[0].find('.audio-track-channels').text()).toBe('Mono');
    expect(items[1].find('.audio-track-channels').text()).toBe('Stereo');
    expect(items[2].find('.audio-track-channels').text()).toBe('5.1');
    expect(items[3].find('.audio-track-channels').text()).toBe('7.1');
    expect(items[4].find('.audio-track-channels').text()).toBe('4 ch');
  });

  it('has correct ARIA attributes', () => {
    const tracks = [
      { id: 't1', language: 'English', codec: 'AAC', channels: 2, bitrate: 128000 }
    ];

    const wrapper = mount(AudioTrackList, {
      props: { ...defaultProps, tracks }
    });

    expect(wrapper.find('.audio-track-list').attributes('role')).toBe('list');
    expect(wrapper.find('.audio-track-list').attributes('aria-label')).toBe('Audio track list');
    expect(wrapper.find('.audio-track-item').attributes('role')).toBe('listitem');
    expect(wrapper.find('.audio-track-item').attributes('aria-pressed')).toBe('false');
  });

  it('uses display_title when available', () => {
    const tracks = [
      { id: 't1', language: 'en', codec: 'AAC', channels: 2, display_title: 'Director Commentary' }
    ];

    const wrapper = mount(AudioTrackList, {
      props: { ...defaultProps, tracks }
    });

    expect(wrapper.find('.audio-track-language').text()).toBe('Director Commentary');
  });

  it('falls back to language when display_title is not available', () => {
    const tracks = [
      { id: 't1', language: 'Japanese', codec: 'AAC', channels: 2 }
    ];

    const wrapper = mount(AudioTrackList, {
      props: { ...defaultProps, tracks }
    });

    expect(wrapper.find('.audio-track-language').text()).toBe('Japanese');
  });
});
