/**
 * English client-side overrides for the `@phlix/ui` message seam.
 *
 * `@phlix/ui` ships the authoritative English catalog (DEFAULT_MESSAGES); this
 * map only holds WINDOWS-SPECIFIC tweaks that should differ from the shared
 * defaults — and today there are none, so it stays empty and `messagesForLocale`
 * omits the `messages` config key entirely, rendering the shared UI byte-for-byte
 * unchanged.
 *
 * To tweak a string for this client, add it here, e.g.:
 *   `export const enOverrides: PhlixMessagesConfig = { shell: { browse: 'Library' } };`
 *
 * @copyright 2026 Joe Huss <detain@interserver.net>
 */
import type { PhlixMessagesConfig } from '@phlix/ui';

export const enOverrides: PhlixMessagesConfig = {};
