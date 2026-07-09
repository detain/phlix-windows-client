/**
 * Phlix Media Server Client for Windows.
 *
 * @copyright 2026 Joe Huss <detain@interserver.net>
 */

import { describe, it, expect } from 'vitest';
import { mount } from '@vue/test-utils';
import RatingBadge from '@/components/RatingBadge';

describe('RatingBadge', () => {
  it('renders with null score as unrated', () => {
    const wrapper = mount(RatingBadge, {
      props: { score: null }
    });

    expect(wrapper.find('.rating-badge').exists()).toBe(true);
    expect(wrapper.find('.rating-label').text()).toBe('—');
  });

  it('renders a perfect 10 score as 5 full stars', () => {
    const wrapper = mount(RatingBadge, {
      props: { score: 10 }
    });

    expect(wrapper.find('.rating-label').text()).toBe('10.0/10');
    const stars = wrapper.findAll('.rating-star');
    expect(stars).toHaveLength(5);
    stars.forEach((star) => {
      expect(star.text()).toBe('★');
    });
  });

  it('renders a 7.5 score with correct label', () => {
    const wrapper = mount(RatingBadge, {
      props: { score: 7.5 }
    });

    expect(wrapper.find('.rating-label').text()).toBe('7.5/10');
  });

  it('renders a 0 score as all empty stars', () => {
    const wrapper = mount(RatingBadge, {
      props: { score: 0 }
    });

    expect(wrapper.find('.rating-label').text()).toBe('0.0/10');
    const stars = wrapper.findAll('.rating-star');
    expect(stars).toHaveLength(5);
    stars.forEach((star) => {
      expect(star.text()).toBe('☆');
    });
  });

  it('renders partial stars correctly for 5/10 (2.5 stars)', () => {
    const wrapper = mount(RatingBadge, {
      props: { score: 5 }
    });

    expect(wrapper.find('.rating-label').text()).toBe('5.0/10');
  });

  it('handles mid-range scores correctly', () => {
    const wrapper = mount(RatingBadge, {
      props: { score: 6.8 }
    });

    expect(wrapper.find('.rating-label').text()).toBe('6.8/10');
  });

  it('has correct ARIA label for accessibility', () => {
    const wrapper = mount(RatingBadge, {
      props: { score: 7.5 }
    });

    const starsContainer = wrapper.find('.rating-stars');
    expect(starsContainer.attributes('aria-label')).toBe('Rating: 3.75 out of 5 stars');
  });
});
