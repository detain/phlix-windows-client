/**
 * Minimal main-process translator for the Electron shell chrome (tray, menu,
 * thumbar, updater notifications, About dialog).
 *
 * Design: a locale → catalog registry with English as the structural fallback.
 * Adding a locale is two steps — author `es.ts` (typed against `MainCatalog`, so
 * a missing key is a compile error) and add one entry to `catalogs`. Only `en`
 * ships today; the active locale is resolved once at app-ready because
 * `app.getLocale()` requires the ready event (see `src/main/index.ts`).
 *
 * `t()` throws on an unknown key instead of echoing it: keys are statically
 * typed (`MainMessageKey`), so an unknown key at runtime means the catalog and
 * the registry drifted — a broken build, not a user-facing condition. Failing
 * loud at the call site beats silently shipping a key as a label.
 *
 * This module is pure (no `electron` import) so it unit-tests without mocks;
 * the ready-gated `app.getLocale()` call stays at the single site that needs it.
 *
 * @copyright 2026 Joe Huss <detain@interserver.net>
 */
import { en } from './en';

/** Two-level dotted key into the catalog, e.g. `'tray.quit'`. */
export type MainMessageKey = {
  [G in keyof typeof en]: `${G & string}.${keyof (typeof en)[G] & string}`;
}[keyof typeof en];

/**
 * The shape every locale catalog must satisfy. Derived from `en` (the SSOT), so
 * a new locale that forgets a key does not typecheck.
 */
export type MainCatalog = {
  [G in keyof typeof en]: { [K in keyof (typeof en)[G]]: string };
};

/** Interpolation parameters for `{name}` placeholders. */
export type MainTranslateParams = Record<string, string | number>;

// Registry: adding a locale = new catalog file + one entry here.
const catalogs: Record<string, MainCatalog> = { en };

let activeCatalog: MainCatalog = en;
let activeLocale = 'en';

function findCatalog(locale: string): MainCatalog | undefined {
  const normalized = locale.trim().toLowerCase();
  if (!normalized) return undefined;

  const exact = catalogs[normalized];
  if (exact) return exact;

  // 'en-GB' → 'en' region fallback, matching @phlix/ui's base-language matching.
  const base = normalized.split('-')[0];
  return catalogs[base];
}

/**
 * Pin the main-process UI locale from a BCP-47 tag (typically `app.getLocale()`).
 * Unknown locales fall back to English silently — a user on an untranslated
 * desktop should get working English chrome, not an error. Returns the locale
 * actually activated so callers can log the resolution.
 */
export function setMainLocale(rawLocale: string): string {
  const catalog = findCatalog(rawLocale);
  if (!catalog) {
    activeCatalog = en;
    activeLocale = 'en';
    return activeLocale;
  }

  activeCatalog = catalog;
  activeLocale = rawLocale.trim().toLowerCase();
  return activeLocale;
}

/** The locale currently active in the main process (`'en'` until changed). */
export function getMainLocale(): string {
  return activeLocale;
}

/**
 * Resolve a dotted message key against the active catalog and interpolate any
 * `{name}` placeholders from `params`. Placeholders without a matching param
 * are left intact so a missing argument is visible rather than silently eaten.
 */
export function t(key: MainMessageKey, params?: MainTranslateParams): string {
  const dot = key.indexOf('.');
  const group = key.slice(0, dot) as keyof MainCatalog;
  const id = key.slice(dot + 1);

  const groupMessages = activeCatalog[group] as Record<string, string> | undefined;
  const template = groupMessages?.[id];
  if (typeof template !== 'string') {
    throw new Error(`[i18n] Unknown main-process message key "${key}" for locale "${activeLocale}"`);
  }

  if (!params) return template;
  return template.replace(/\{(\w+)\}/g, (match, name: string) =>
    Object.prototype.hasOwnProperty.call(params, name) ? String(params[name]) : match
  );
}
