/**
 * Navigation guard (M-WINDOWS-18): the will-navigate handler guards where the
 * MAIN WINDOW may navigate. The pre-cure law accepted only https:/http:, which
 * blocked the app's OWN app:// origin — `location.href='app://-/app/settings'`
 * and reload-style navigations inside the shell were preventDefault'd while
 * arbitrary external http(s) pages were ALLOWED: the guard protected the wrong
 * direction. validateNavigationUrl restores the sane order:
 *  - app: is self-navigation and stays allowed (the app:// handler itself only
 *    serves the packaged renderer — see setupAppProtocolHandler's prefix law);
 *  - everything else falls through to the external-protocol law unchanged;
 *  - malformed URLs deny (fail closed).
 */
import { describe, it, expect } from 'vitest';
import { validateNavigationUrl, validateExternalUrl } from '../../src/main/urlValidator';

describe('validateNavigationUrl (M-WINDOWS-18)', () => {
  it("allows the shell's own app:// origin (SPA routing + reload)", () => {
    expect(validateNavigationUrl('app://-/app/settings')).toBe(true);
    expect(validateNavigationUrl('app://-/app')).toBe(true);
  });

  it('still allows external http(s) exactly as before', () => {
    expect(validateNavigationUrl('https://media.example.com')).toBe(true);
    expect(validateNavigationUrl('http://192.168.1.10:8096')).toBe(true);
  });

  it('keeps blocking escape protocols', () => {
    expect(validateNavigationUrl('file:///C:/Windows/System32/config/sam')).toBe(false);
    expect(validateNavigationUrl('javascript:alert(1)')).toBe(false);
    expect(validateNavigationUrl('data:text/html,<script>1</script>')).toBe(false);
  });

  it('fails closed on malformed input', () => {
    expect(validateNavigationUrl('')).toBe(false);
    expect(validateNavigationUrl('not a url')).toBe(false);
  });

  it('validateExternalUrl itself stays http(s)-only (window-open law)', () => {
    // The carve belongs to NAVIGATION, not the external-open law: a popup to
    // app:// must stay denied (setWindowOpenHandler only opens http(s) via shell).
    expect(validateExternalUrl('app://-/app/settings')).toBe(false);
  });
});
