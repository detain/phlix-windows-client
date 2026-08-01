/**
 * Phlix Media Server Client for Windows.
 *
 * @copyright 2026 Joe Huss <detain@interserver.net>
 */

import { describe, it, expect, vi, afterEach } from 'vitest';
import { mount } from '@vue/test-utils';
import type { UserRecommendation } from '@phlix/contracts';

// Mock the modules that RecommendationsPanel depends on
vi.mock('@phlix/ui', () => ({
  ApiClient: vi.fn().mockImplementation(() => ({
    get: vi.fn()
  })),
  useMediaApiBase: vi.fn(() => ({ value: 'https://api.example.com' }))
}));

import RecommendationsPanel from '@/components/RecommendationsPanel';
import { ApiClient } from '@phlix/ui';

describe('RecommendationsPanel', () => {
  const createRecommendation = (id: string, overrides: Partial<UserRecommendation> = {}): UserRecommendation => ({
    id,
    title: `Test Movie ${id}`,
    posterUrl: null,
    year: 2024,
    score: 0.8,
    reason: 'because_you_watched',
    computedAt: '2026-01-01T00:00:00Z',
    ...overrides
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders loading state initially', async () => {
    const mockGet = vi.fn().mockReturnValue(new Promise(() => {})); // Never resolves
    vi.mocked(ApiClient).mockImplementation(() => ({
      get: mockGet
    }) as unknown as ConstructorParameters<typeof ApiClient>[0]);

    const wrapper = mount(RecommendationsPanel);

    expect(wrapper.find('.loading').text()).toBe('Loading...');
  });

  it('renders error state when API fails', async () => {
    const mockGet = vi.fn().mockRejectedValue(new Error('Network error'));
    vi.mocked(ApiClient).mockImplementation(() => ({
      get: mockGet
    }) as unknown as ConstructorParameters<typeof ApiClient>[0]);

    const wrapper = mount(RecommendationsPanel);

    // Wait for the async load to complete
    await new Promise(resolve => setTimeout(resolve, 100));
    await wrapper.vm.$nextTick();

    expect(wrapper.find('.error').text()).toBe('Network error');
  });

  it('renders empty state when no recommendations', async () => {
    const mockGet = vi.fn().mockResolvedValue({ recommendations: [] });
    vi.mocked(ApiClient).mockImplementation(() => ({
      get: mockGet
    }) as unknown as ConstructorParameters<typeof ApiClient>[0]);

    const wrapper = mount(RecommendationsPanel);

    await new Promise(resolve => setTimeout(resolve, 100));
    await wrapper.vm.$nextTick();

    expect(wrapper.find('.empty').text()).toBe('No recommendations yet');
  });

  it('renders recommendation cards when data is loaded', async () => {
    const recommendations = [
      createRecommendation('1', { title: 'Movie One' }),
      createRecommendation('2', { title: 'Movie Two' })
    ];
    const mockGet = vi.fn().mockResolvedValue({ recommendations });
    vi.mocked(ApiClient).mockImplementation(() => ({
      get: mockGet
    }) as unknown as ConstructorParameters<typeof ApiClient>[0]);

    const wrapper = mount(RecommendationsPanel);

    await new Promise(resolve => setTimeout(resolve, 100));
    await wrapper.vm.$nextTick();

    const cards = wrapper.findAll('.recommendation-card');
    expect(cards).toHaveLength(2);
    expect(wrapper.find('.recommendations-grid').exists()).toBe(true);
  });

  it('navigates to player when recommendation card is clicked', async () => {
    const recommendations = [createRecommendation('test-id', { title: 'Test Movie' })];
    const mockGet = vi.fn().mockResolvedValue({ recommendations });
    vi.mocked(ApiClient).mockImplementation(() => ({
      get: mockGet
    }) as unknown as ConstructorParameters<typeof ApiClient>[0]);

    const routerPush = vi.fn();
    Object.defineProperty(window, '$router', {
      value: { push: routerPush },
      writable: true
    });

    const wrapper = mount(RecommendationsPanel);

    await new Promise(resolve => setTimeout(resolve, 100));
    await wrapper.vm.$nextTick();

    wrapper.find('.recommendation-card').trigger('click');
    expect(routerPush).toHaveBeenCalledWith('/appplayer/test-id');
  });

  it('uses correct API endpoint', async () => {
    const mockGet = vi.fn().mockResolvedValue({ recommendations: [] });
    vi.mocked(ApiClient).mockImplementation(() => ({
      get: mockGet
    }) as unknown as ConstructorParameters<typeof ApiClient>[0]);

    mount(RecommendationsPanel);

    await new Promise(resolve => setTimeout(resolve, 100));

    expect(mockGet).toHaveBeenCalledWith(
      '/api/v1/me/recommendations',
      { limit: '20' }
    );
  });

  it('handles null recommendations array gracefully', async () => {
    const mockGet = vi.fn().mockResolvedValue({ recommendations: null });
    vi.mocked(ApiClient).mockImplementation(() => ({
      get: mockGet
    }) as unknown as ConstructorParameters<typeof ApiClient>[0]);

    const wrapper = mount(RecommendationsPanel);

    await new Promise(resolve => setTimeout(resolve, 100));
    await wrapper.vm.$nextTick();

    // Should render empty state when recommendations is null
    expect(wrapper.find('.empty').text()).toBe('No recommendations yet');
  });
});
