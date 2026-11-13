/**
 * @vitest-environment node
 * WIN-52 / WIN-S30: launch-chrome theme mirror validation.
 */
import { describe, it, expect } from 'vitest';
import {
  DEFAULT_LAUNCH_BACKGROUND,
  resolveLaunchBackground,
  sanitizeLaunchBackground
} from '../../src/main/launchTheme';

describe('launchTheme', () => {
  it('accepts #rgb and #rrggbb, normalising case', () => {
    expect(sanitizeLaunchBackground('#0B0A08')).toBe('#0b0a08');
    expect(sanitizeLaunchBackground(' #fff ')).toBe('#fff');
  });
  it('rejects non-hex / hostile values', () => {
    for (const bad of ['red', 'url(x)', 'var(--bg)', '#12', '#12345678', '', 5, null, undefined, '#' + 'a'.repeat(500)]) {
      expect(sanitizeLaunchBackground(bad)).toBeNull();
    }
  });
  it('falls back to Nocturne when absent or invalid', () => {
    expect(resolveLaunchBackground(undefined)).toBe(DEFAULT_LAUNCH_BACKGROUND);
    expect(resolveLaunchBackground('nope')).toBe('#1a1a2e');
    expect(resolveLaunchBackground('#f7f1e6')).toBe('#f7f1e6');
  });
});
