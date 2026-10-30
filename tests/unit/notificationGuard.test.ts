/**
 * @vitest-environment node
 *
 * M-WINDOWS-33 (review windows__exploiter MINOR-5): `notification:show`
 * accepted unbounded, unthrottled strings, making OS toasts a spam/phishing
 * surface for any malicious server driving the UI's notification flows.
 *
 * Cure shape: the guards are a PURE module (`src/main/notificationGuard.ts`,
 * same no-electron-import law as windowRestore.ts) unit-tested behaviorally,
 * plus wiring pins proving the IPC handler actually consults them.
 */
import { describe, it, expect } from 'vitest';
import {
  MAX_NOTIFICATION_TITLE_LENGTH,
  MAX_NOTIFICATION_BODY_LENGTH,
  validateNotificationText,
  createToastThrottle
} from '../../src/main/notificationGuard';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const PROJECT_ROOT = resolve(__dirname, '../..');
const mainSource = readFileSync(resolve(PROJECT_ROOT, 'src/main/index.ts'), 'utf-8').replace(/\r\n/g, '\n');

describe('validateNotificationText (M-WINDOWS-33)', () => {
  it('accepts a well-formed payload and carries the narrowed strings', () => {
    expect(validateNotificationText('Update Ready', 'Phlix 1.2.3 has been downloaded.')).toEqual({
      ok: true,
      title: 'Update Ready',
      body: 'Phlix 1.2.3 has been downloaded.'
    });
  });

  it('rejects a non-string title', () => {
    const verdict = validateNotificationText(42, 'body');
    if (verdict.ok) throw new Error('expected rejection for a non-string title');
    expect(verdict.reason).toContain('title');
  });

  it('rejects a non-string body', () => {
    const verdict = validateNotificationText('title', { nested: true });
    if (verdict.ok) throw new Error('expected rejection for a non-string body');
    expect(verdict.reason).toContain('body');
  });

  it('rejects an over-long title at cap+1, accepts at cap (boundary)', () => {
    expect(validateNotificationText('t'.repeat(MAX_NOTIFICATION_TITLE_LENGTH + 1), 'body').ok).toBe(false);
    expect(validateNotificationText('t'.repeat(MAX_NOTIFICATION_TITLE_LENGTH), 'body').ok).toBe(true);
  });

  it('rejects an over-long body at cap+1, accepts at cap (boundary)', () => {
    expect(validateNotificationText('title', 'b'.repeat(MAX_NOTIFICATION_BODY_LENGTH + 1)).ok).toBe(false);
    expect(validateNotificationText('title', 'b'.repeat(MAX_NOTIFICATION_BODY_LENGTH)).ok).toBe(true);
  });

  it('caps are generous for legitimate copy and bound the multi-MB vector', () => {
    // The shipped updater strings are the longest legitimate payloads
    // ('Phlix {version} has been downloaded. Restart to apply.' ≈ 55 chars).
    expect(MAX_NOTIFICATION_TITLE_LENGTH).toBeGreaterThanOrEqual(64);
    expect(MAX_NOTIFICATION_BODY_LENGTH).toBeGreaterThanOrEqual(256);
    // And far below the unbounded abuse class the review filed.
    expect(MAX_NOTIFICATION_TITLE_LENGTH).toBeLessThan(10_000);
    expect(MAX_NOTIFICATION_BODY_LENGTH).toBeLessThan(10_000);
  });
});

describe('createToastThrottle (M-WINDOWS-33)', () => {
  it('allows the configured burst and rejects the overflow, refilling as the window slides', () => {
    const allow = createToastThrottle({ limit: 3, windowMs: 10_000 });
    expect(allow(0)).toBe(true);
    expect(allow(1_000)).toBe(true);
    expect(allow(2_000)).toBe(true);
    expect(allow(3_000)).toBe(false); // 4th inside the window — dropped
    expect(allow(9_999)).toBe(false); // still inside
    expect(allow(10_000)).toBe(true); // first grant aged out, budget refilled
  });

  it('never grows its bookkeeping beyond the limit', () => {
    const allow = createToastThrottle({ limit: 2, windowMs: 1_000 });
    for (let t = 0; t < 20_000; t += 100) allow(t);
    // A monotone clock with a bounded window cannot retain more than `limit`
    // grants — exposed via the refill behavior staying live after the loop:
    expect(allow(20_100)).toBe(true);
  });

  it('an injected clock makes it deterministic (no Date.now inside)', () => {
    const allow = createToastThrottle({ limit: 1, windowMs: 5_000 });
    expect(allow(123)).toBe(true);
    expect(allow(124)).toBe(false);
    expect(allow(5_123)).toBe(true);
  });
});

describe('notifyUser pipeline (M-WINDOWS-33 law, M-WINDOWS-40 consolidation)', () => {
  // M-WINDOWS-40 moved the construction path into the single notifyUser
  // gate (the three autoUpdater arms previously bypassed the pref). The
  // guard-before-construction law is unchanged — only its location moved —
  // so these anchors re-seat on `function notifyUser` and the delegation
  // pin below proves the renderer IPC still routes through it.
  const fnStart = mainSource.indexOf('function notifyUser(');
  const handlerBlock = mainSource.slice(fnStart, mainSource.indexOf('notification.show();', fnStart) + 20);

  it('the pipeline consults the payload guard before constructing the Notification', () => {
    expect(handlerBlock).toMatch(/validateNotificationText\(/);
    expect(handlerBlock.indexOf('validateNotificationText(')).toBeLessThan(handlerBlock.indexOf('new Notification('));
  });

  it('the pipeline consults the throttle before constructing the Notification', () => {
    expect(handlerBlock).toMatch(/allowNotificationToast\(/);
    expect(handlerBlock.indexOf('allowNotificationToast(')).toBeLessThan(handlerBlock.indexOf('new Notification('));
  });

  it('rejections return false (the renderer-visible answer), never a silent continue', () => {
    // Both guard arms must have a distinct `return false;` bail BEFORE construction.
    const bails = handlerBlock.slice(0, handlerBlock.indexOf('new Notification(')).match(/return false;/g) || [];
    // isSupported + notificationsEnabled already contributed 2 pre-existing bails;
    // the two new guards add 2 more.
    expect(bails.length).toBeGreaterThanOrEqual(4);
  });

  it('the notification:show handler delegates to notifyUser with the renderer throttle on', () => {
    const handlerStart = mainSource.indexOf("ipcMain.handle('notification:show'");
    expect(handlerStart).toBeGreaterThan(-1);
    const handlerSlice = mainSource.slice(handlerStart, handlerStart + 900);
    expect(handlerSlice).toMatch(/return notifyUser\(raw\?\.title, raw\?\.body, \{\s*throttle: true,/);
    // The click extras stay handler-local (the deep-link prefix contract).
    expect(handlerSlice).toMatch(/handleDeepLinkUrl\(`phlix:\/\/internal\$\{clickAction\}`\)/);
  });

  it('every autoUpdater arm routes through notifyUser, unthrottled but pref-gated', () => {
    const updaterArms = mainSource.slice(
      mainSource.indexOf("autoUpdater.on('update-available'"),
      mainSource.indexOf("autoUpdater.on('error'")
    );
    const calls = updaterArms.match(/notifyUser\(/g) || [];
    expect(calls.length).toBe(3);
    // No raw construction survives in any updater arm (M-WINDOWS-40).
    expect(updaterArms).not.toMatch(/new Notification\(/);
    // Trusted low-rate origins must not share the renderer flood budget.
    expect((updaterArms.match(/throttle: false/g) || []).length).toBe(3);
  });
});
