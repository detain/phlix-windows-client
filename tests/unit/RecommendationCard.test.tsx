/**
 * Phlix Media Server Client for Windows.
 *
 * @copyright 2026 Joe Huss <detain@interserver.net>
 */

import { describe, it, expect } from 'vitest';
import { mount } from '@vue/test-utils';
import RecommendationCard from '@/components/RecommendationCard';
import type { UserRecommendation } from '@phlix/contracts';

describe('RecommendationCard', () => {
  const createRecommendation = (overrides: Partial<UserRecommendation> = {}): UserRecommendation => ({
    id: 'rec-123',
    title: 'Test Movie',
    posterUrl: null,
    year: null,
    score: 0.85,
    reason: 'because_you_watched',
    computedAt: '2026-01-01T00:00:00Z',
    ...overrides
  });

  it('renders recommendation title', () => {
    const recommendation = createRecommendation({ title: 'The Matrix' });
    const wrapper = mount(RecommendationCard, {
      props: { item: recommendation }
    });

    expect(wrapper.find('.title').text()).toBe('The Matrix');
  });

  it('renders year when present', () => {
    const recommendation = createRecommendation({ year: 1999 });
    const wrapper = mount(RecommendationCard, {
      props: { item: recommendation }
    });

    expect(wrapper.find('.year').text()).toBe('1999');
  });

  it('does not render year when null', () => {
    const recommendation = createRecommendation({ year: null });
    const wrapper = mount(RecommendationCard, {
      props: { item: recommendation }
    });

    expect(wrapper.find('.year').exists()).toBe(false);
  });

  it('renders score as percentage', () => {
    const recommendation = createRecommendation({ score: 0.75 });
    const wrapper = mount(RecommendationCard, {
      props: { item: recommendation }
    });

    expect(wrapper.find('.score').text()).toBe('75% match');
  });

  it('rounds score percentage correctly', () => {
    const recommendation = createRecommendation({ score: 0.847 });
    const wrapper = mount(RecommendationCard, {
      props: { item: recommendation }
    });

    expect(wrapper.find('.score').text()).toBe('85% match');
  });

  it('renders reason badge', () => {
    const recommendation = createRecommendation();
    const wrapper = mount(RecommendationCard, {
      props: { item: recommendation }
    });

    expect(wrapper.find('.reason-badge').text()).toBe('Because You Watched');
  });

  it('renders poster image when posterUrl is provided', () => {
    const recommendation = createRecommendation({ id: 'rec-1', title: 'The Matrix', posterUrl: 'https://example.com/poster.jpg' });
    const wrapper = mount(RecommendationCard, {
      props: { item: recommendation }
    });

    const img = wrapper.find('.poster');
    expect(img.exists()).toBe(true);
    expect(img.attributes('src')).toBe('https://example.com/poster.jpg');
    expect(img.attributes('alt')).toBe('The Matrix');
  });

  it('renders placeholder when posterUrl is null', () => {
    const recommendation = createRecommendation({ posterUrl: null });
    const wrapper = mount(RecommendationCard, {
      props: { item: recommendation }
    });

    expect(wrapper.find('.poster.placeholder').exists()).toBe(true);
    expect(wrapper.find('.poster.placeholder img').exists()).toBe(false);
  });

  it('calls onSelect with recommendation id when clicked', () => {
    const recommendation = createRecommendation({ id: 'rec-456' });
    const onSelect = { handler: (_id: string) => {} };
    const spy = vi.spyOn(onSelect, 'handler');

    const wrapper = mount(RecommendationCard, {
      props: { item: recommendation, onSelect: spy }
    });

    wrapper.find('.recommendation-card').trigger('click');
    expect(spy).toHaveBeenCalledWith('rec-456');
  });

  it('does not call onSelect when not provided and clicked', () => {
    const recommendation = createRecommendation({ id: 'rec-789' });
    const wrapper = mount(RecommendationCard, {
      props: { item: recommendation }
    });

    // Should not throw when onSelect is not provided
    expect(() => wrapper.find('.recommendation-card').trigger('click')).not.toThrow();
  });
});
