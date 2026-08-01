/**
 * Phlix Media Server Client for Windows.
 *
 * @copyright 2026 Joe Huss <detain@interserver.net>
 */

import { describe, it, expect } from 'vitest';
import { mount } from '@vue/test-utils';
import MusicAlbumCard from '@/components/MusicAlbumCard';
import type { MusicAlbum } from '@phlix/contracts';

describe('MusicAlbumCard', () => {
  const createAlbum = (overrides: Partial<MusicAlbum> = {}): MusicAlbum => ({
    id: 1,
    mediaItemId: 100,
    artistId: 10,
    title: 'Test Album',
    sortTitle: null,
    year: 2024,
    totalTracks: 12,
    totalDiscs: 1,
    albumArtUrl: null,
    ...overrides
  });

  it('renders album title', () => {
    const album = createAlbum({ title: 'Dark Side of the Moon' });
    const wrapper = mount(MusicAlbumCard, {
      props: { album }
    });

    expect(wrapper.find('.title').text()).toBe('Dark Side of the Moon');
  });

  it('renders album year when present', () => {
    const album = createAlbum({ year: 1973 });
    const wrapper = mount(MusicAlbumCard, {
      props: { album }
    });

    expect(wrapper.find('.year').text()).toBe('1973');
  });

  it('renders track count', () => {
    const album = createAlbum({ totalTracks: 10 });
    const wrapper = mount(MusicAlbumCard, {
      props: { album }
    });

    expect(wrapper.find('.tracks').text()).toBe('10 tracks');
  });

  it('renders artist name when present', () => {
    const album = createAlbum({
      artist: { id: 1, mediaItemId: null, name: 'Pink Floyd', sortName: 'Pink Floyd', biography: null, imageUrl: null }
    });
    const wrapper = mount(MusicAlbumCard, {
      props: { album }
    });

    expect(wrapper.find('.artist').text()).toBe('Pink Floyd');
  });

  it('does not render artist section when artist is absent', () => {
    const album = createAlbum({ artist: undefined });
    const wrapper = mount(MusicAlbumCard, {
      props: { album }
    });

    expect(wrapper.find('.artist').exists()).toBe(false);
  });

  it('renders placeholder cover when albumArtUrl is null', () => {
    const album = createAlbum({ albumArtUrl: null });
    const wrapper = mount(MusicAlbumCard, {
      props: { album }
    });

    expect(wrapper.find('.cover.placeholder').exists()).toBe(true);
    expect(wrapper.find('.cover.placeholder img').exists()).toBe(false);
  });

  it('renders album art image when albumArtUrl is provided', () => {
    const album = createAlbum({ albumArtUrl: 'https://example.com/album.jpg' });
    const wrapper = mount(MusicAlbumCard, {
      props: { album }
    });

    const img = wrapper.find('.cover');
    expect(img.exists()).toBe(true);
    expect(img.attributes('src')).toBe('https://example.com/album.jpg');
    expect(img.attributes('alt')).toBe('Test Album');
  });

  it('calls onSelect with album id when clicked', () => {
    const album = createAlbum({ id: 42 });
    const onSelect = { handler: (_id: number) => {} };
    const spy = vi.spyOn(onSelect, 'handler');

    const wrapper = mount(MusicAlbumCard, {
      props: { album, onSelect: spy }
    });

    wrapper.find('.music-album-card').trigger('click');
    expect(spy).toHaveBeenCalledWith(42);
  });

  it('does not call onSelect when not provided and clicked', () => {
    const album = createAlbum({ id: 42 });
    const wrapper = mount(MusicAlbumCard, {
      props: { album }
    });

    // Should not throw when onSelect is not provided
    expect(() => wrapper.find('.music-album-card').trigger('click')).not.toThrow();
  });
});
