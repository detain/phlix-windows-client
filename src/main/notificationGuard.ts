/**
 * Bounds for the `notification:show` IPC surface (M-WINDOWS-33, review
 * windows__exploiter MINOR-5).
 *
 * Before this module the handler forwarded renderer-supplied strings straight
 * into an OS toast with no length caps, no rate limit, and no type check —
 * a malicious server driving the UI's notification flows could toast-spam the
 * desktop behind the user's back with multi-MB bodies truncated only
 * unpredictably by the shell.
 *
 * The caps are generous against legitimate copy (the longest shipped strings
 * are the updater toasts, ≈ 55 characters) while bounding the abuse class;
 * over-cap payloads are REJECTED, not truncated — a silently cut toast is its
 * own phishing vector (an attacker controlling the cut point controls the
 * surviving sentence).
 *
 * The throttle is a bounded sliding window over an INJECTED clock: a burst of
 * `limit` toasts is legitimate UX, an unbounded stream is the attack. Keeping
 * the clock external makes every window edge unit-testable without sleeping.
 *
 * This module is pure (no `electron` import) so it unit-tests without mocks —
 * the same extraction law as `windowRestore.ts`.
 *
 * @copyright 2026 Joe Huss <detain@interserver.net>
 */

/** Longest accepted notification title, in characters. */
export const MAX_NOTIFICATION_TITLE_LENGTH = 256;

/** Longest accepted notification body, in characters. */
export const MAX_NOTIFICATION_BODY_LENGTH = 2048;

/** Verdict of the payload text guard, narrowing title/body when accepted. */
export type NotificationTextVerdict =
  | { readonly ok: true; readonly title: string; readonly body: string }
  | { readonly ok: false; readonly reason: string };

/**
 * Reject non-string or over-cap title/body payloads; on acceptance, carry the
 * narrowed strings so the caller constructs the toast from parsed values, not
 * from the untyped IPC payload (parse-don't-validate at the trust boundary).
 */
export function validateNotificationText(title: unknown, body: unknown): NotificationTextVerdict {
  if (typeof title !== 'string') {
    return { ok: false, reason: 'title is not a string' };
  }
  if (typeof body !== 'string') {
    return { ok: false, reason: 'body is not a string' };
  }
  if (title.length > MAX_NOTIFICATION_TITLE_LENGTH) {
    return { ok: false, reason: `title exceeds ${MAX_NOTIFICATION_TITLE_LENGTH} characters` };
  }
  if (body.length > MAX_NOTIFICATION_BODY_LENGTH) {
    return { ok: false, reason: `body exceeds ${MAX_NOTIFICATION_BODY_LENGTH} characters` };
  }
  return { ok: true, title, body };
}

/** Factory options for the toast throttle. */
export interface ToastThrottleOptions {
  /** Grants available per sliding window. */
  readonly limit: number;
  /** Window length in milliseconds. */
  readonly windowMs: number;
}

/**
 * Build a bounded sliding-window toast gate.
 *
 * The returned function takes the current epoch in milliseconds and answers
 * whether one more toast may be shown — and only when allowed, consumes a
 * grant. Grants age out individually: after `windowMs` a slot is spendable
 * again, so legitimate bursts pass while sustained streams collapse to at
 * most `limit` toasts per window. Bookkeeping never exceeds `limit` entries.
 */
export function createToastThrottle(options: ToastThrottleOptions): (nowMs: number) => boolean {
  const { limit, windowMs } = options;
  const grantedAt: number[] = [];

  return (nowMs: number): boolean => {
    while (grantedAt.length > 0 && nowMs - grantedAt[0] >= windowMs) {
      grantedAt.shift();
    }
    if (grantedAt.length >= limit) {
      return false;
    }
    grantedAt.push(nowMs);
    return true;
  };
}
