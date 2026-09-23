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
 * and supplies the registry for it. `en` registers an EMPTY override map, so
 * `messagesForLocale` returns `undefined` and the boot path omits the `messages`
 * key entirely — the shipped UI is byte-for-byte what it was before this seam
 * was wired. The six estate locales (es, fr, de, it, pt_BR, ja) serve the
 * SHA-PINNED vendored phlix-ui bundles from `./ui-locale-bundles/` (SSOT estate
 * decision; refresh with `node scripts/sync-ui-locale-bundles.mjs`, drift
 * guards in tests/unit/i18nLocales.test.ts).
 *
 * Locale tags are canonicalized through `normalizeLocaleTag` — primary subtag,
 * lowercased, with the region-aware `pt → pt_BR` rule — so registration and
 * lookup share one parsing law ('pt-BR', 'pt_BR', 'pt-PT' and 'pt' all resolve
 * to the Brazilian Portuguese bundle, the estate's single Portuguese catalog).
 *
 * Adding a locale = vendor/re-pin its ui bundle (scripts/sync-ui-locale-bundles.mjs),
 * add one `registerLocaleOverrides` line below, author the two windows-own
 * halves (src/renderer/i18n/windows-own/, src/main/i18n/locales/). See
 * docs/i18n.md "Adding a 7th locale".
 *
 * @copyright 2026 Joe Huss <detain@interserver.net>
 */
import type { PhlixMessagesConfig } from '@phlix/ui';
import { enOverrides } from './overrides/en';
import { LOCALE_MESSAGES, type PhlixLocaleCode } from './ui-locale-bundles';

/** Registry keys this client can resolve (English baseline + the six bundles). */
export const SUPPORTED_LOCALES = ['en', 'es', 'fr', 'de', 'it', 'pt_BR', 'ja'] as const;
export type SupportedLocale = (typeof SUPPORTED_LOCALES)[number];
/** Locale every unresolved tag falls back to. */
export const FALLBACK_LOCALE: SupportedLocale = 'en';

/**
 * Canonical registry tag for a raw BCP-47-ish locale string:
 * trim → lowercase → primary subtag (`-`/`_` split), with the estate region rule
 * `pt* → 'pt_BR'`. Returns `null` for an empty tag. Unsupported primaries are
 * returned as-is so callers can decide (the registries simply miss → fallback).
 */
export function normalizeLocaleTag(raw: string | null | undefined): string | null {
  const trimmed = raw?.trim().toLowerCase();
  if (!trimmed) return null;

  const primary = trimmed.split(/[-_]/)[0];
  if (primary === 'pt') return 'pt_BR';
  return primary || null;
}

/** Whether a raw tag resolves to a catalog this client ships. */
export function isSupportedLocale(raw: string | null | undefined): raw is SupportedLocale {
  const tag = normalizeLocaleTag(raw);
  return tag !== null && (SUPPORTED_LOCALES as readonly string[]).includes(tag);
}

/** locale tag → client override map, keyed by `normalizeLocaleTag`. */
const localeOverrides: Record<string, PhlixMessagesConfig> = { en: enOverrides };

/**
 * Attach an override map for a locale (new or existing). Tests and future
 * locales go through here so the registry stays the single source of truth.
 * The tag is canonicalized (see `normalizeLocaleTag`) before storing.
 */
export function registerLocaleOverrides(locale: string, overrides: PhlixMessagesConfig): void {
  const normalized = normalizeLocaleTag(locale);
  if (!normalized) {
    throw new Error('[i18n] registerLocaleOverrides requires a non-empty locale tag');
  }
  localeOverrides[normalized] = overrides;
}

// The six SSOT bundles enter the registry through the same seam tests use.
// The cast is the documented vendor boundary: the bundles are complete
// `PhlixMessages`-shaped maps typed loosely by the `satisfies` relaxation in
// scripts/sync-ui-locale-bundles.mjs (key-set equal to the installed v0.99.5).
for (const code of Object.keys(LOCALE_MESSAGES) as PhlixLocaleCode[]) {
  registerLocaleOverrides(code, LOCALE_MESSAGES[code] as unknown as PhlixMessagesConfig);
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
  const normalized = normalizeLocaleTag(locale);
  if (!normalized) return undefined;
  return localeOverrides[normalized];
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
