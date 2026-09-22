/**
 * Renderer-side locale resolution for the `@phlix/ui` config-time i18n seam.
 *
 * `createPhlixApp(config)` accepts `config.messages` — a deep-partial override
 * map (`PhlixMessagesConfig`) that `@phlix/ui` merges per-group onto its English
 * defaults. This module decides WHICH override map this client passes:
 *
 *   priority: explicit env/config (`VITE_PHLIX_LOCALE`) → system language
 *             (`navigator.language`) → `'en'`
 *
 * and supplies the registry for it. Only `en` is registered today, and its
 * override map is empty, so `messagesForLocale` returns `undefined` and the
 * boot path omits the `messages` key entirely — the shipped UI is byte-for-byte
 * what it was before this seam was wired.
 *
 * Adding a locale = author `overrides/es.ts` (a `PhlixMessagesConfig`; every key
 * optional — unlisted strings fall back to ui's English defaults) + one
 * `registerLocaleOverrides('es', esOverrides)` call at the bottom of this file.
 *
 * @copyright 2026 Joe Huss <detain@interserver.net>
 */
import type { PhlixMessagesConfig } from '@phlix/ui';
import { enOverrides } from './overrides/en';

/** locale tag → client override map. `en` is the always-present baseline. */
const localeOverrides: Record<string, PhlixMessagesConfig> = { en: enOverrides };

/**
 * Attach an override map for a locale (new or existing). Tests and future
 * locales go through here so the registry stays the single source of truth.
 */
export function registerLocaleOverrides(locale: string, overrides: PhlixMessagesConfig): void {
  const normalized = locale.trim().toLowerCase();
  if (!normalized) {
    throw new Error('[i18n] registerLocaleOverrides requires a non-empty locale tag');
  }
  localeOverrides[normalized] = overrides;
}

/**
 * Pure locale pick — the priority chain with all inputs explicit so it is
 * unit-testable without touching `import.meta.env` or `navigator`.
 */
export function pickLocale(
  explicit?: string | null,
  systemLanguage?: string | null
): string {
  const fromConfig = explicit?.trim();
  if (fromConfig) return fromConfig;

  const fromSystem = systemLanguage?.trim();
  if (fromSystem) return fromSystem;

  return 'en';
}

/**
 * The locale this renderer should present in: build-time env override
 * (`VITE_PHLIX_LOCALE`), else the browser/Electron system language, else English.
 */
export function resolveLocale(): string {
  const systemLanguage = typeof navigator === 'undefined' ? undefined : navigator.language;
  return pickLocale(import.meta.env.VITE_PHLIX_LOCALE, systemLanguage);
}

function findOverrides(locale: string): PhlixMessagesConfig | undefined {
  const normalized = locale.trim().toLowerCase();
  if (!normalized) return undefined;

  const exact = localeOverrides[normalized];
  if (exact) return exact;

  // 'es-MX' → 'es' base-language fallback.
  const base = normalized.split('-')[0];
  return localeOverrides[base];
}

/**
 * The override map to hand to `PhlixAppConfig.messages` for a locale — or
 * `undefined` when there is nothing to override. `undefined` (an EMPTY group
 * map counts as nothing too) means "omit the key" and @phlix/ui renders its
 * untouched English defaults: the byte-identical guarantee for English.
 */
export function messagesForLocale(locale: string): PhlixMessagesConfig | undefined {
  const overrides = findOverrides(locale);
  if (!overrides || Object.keys(overrides).length === 0) return undefined;
  return overrides;
}
