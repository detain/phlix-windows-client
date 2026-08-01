/**
 * Phlix Media Server Client for Windows.
 *
 * @copyright 2026 Joe Huss <detain@interserver.net>
 */

import { describe, it, expect } from 'vitest';
import { mount } from '@vue/test-utils';
import MusicArtistCard from '@/components/MusicArtistCard';
import type { MusicArtist } from '@phlix/contracts';

describe('MusicArtistCard', () => {
  const createArtist = (overrides: Partial<MusicArtist> = {}): MusicArtist => ({
    id: 1,
    mediaItemId: null,
    name: 'Test Artist',
    sortName: null,
    biography: null,
    imageUrl: null,
    ...overrides
  });

  it('renders artist name', () => {
    const artist = createArtist({ name: 'Pink Floyd' });
    const wrapper = mount(MusicArtistCard, {
      props: { artist }
    });

    expect(wrapper.find('.name').text()).toBe('Pink Floyd');
  });

  it('renders album count when albumCount is present', () => {
    const artist = createArtist({ albumCount: 15 });
    const wrapper = mount(MusicArtistCard, {
      props: { artist }
    });

    expect(wrapper.find('.album-count').text()).toBe('15 albums');
  });

  it('renders singular album count when albumCount is 1', () => {
    const artist = createArtist({ albumCount: 1 });
    const wrapper = mount(MusicArtistCard, {
      props: { artist }
    });

    expect(wrapper.find('.album-count').text()).toBe('1 album');
  });

  it('does not render album count when albumCount is undefined', () => {
    const artist = createArtist({ albumCount: undefined });
    const wrapper = mount(MusicArtistCard, {
      props: { artist }
    });

    expect(wrapper.find('.album-count').exists()).toBe(false);
  });

  it('renders placeholder poster when imageUrl is null', () => {
    const artist = createArtist({ imageUrl: null });
    const wrapper = mount(MusicArtistCard, {
      props: { artist }
    });

    expect(wrapper.find('.poster.placeholder').exists()).toBe(true);
    expect(wrapper.find('.poster.placeholder img').exists()).toBe(false);
  });

  it('renders artist image when imageUrl is provided', () => {
    const artist = createArtist({ name: 'Pink Floyd', imageUrl: 'https://example.com/artist.jpg' });
    const wrapper = mount(MusicArtistCard, {
      props: { artist }
    });

    const img = wrapper.find('.poster');
    expect(img.exists()).toBe(true);
    expect(img.attributes('src')).toBe('https://example.com/artist.jpg');
    expect(img.attributes('alt')).toBe('Pink Floyd');
  });

  it('calls onSelect with artist id when clicked', () => {
    const artist = createArtist({ id: 99 });
    const onSelect = { handler: (_id: number) => {} };
    const spy = vi.spyOn(onSelect, 'handler');

    const wrapper = mount(MusicArtistCard, {
      props: { artist, onSelect: spy }
    });

    wrapper.find('.music-artist-card').trigger('click');
    expect(spy).toHaveBeenCalledWith(99);
  });

  it('does not call onSelect when not provided and clicked', () => {
    const artist = createArtist({ id: 99 });
    const wrapper = mount(MusicArtistCard, {
      props: { artist }
    });

    // Should not throw when onSelect is not provided
    expect(() => wrapper.find('.music-artist-card').trigger('click')).not.toThrow();
  });
});
