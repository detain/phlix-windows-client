/**
 * Windows-own renderer catalog: the top-bar nav labels this client supplies to
 * `createPhlixApp({ menu })` as raw `MenuItem.label` strings. The `@phlix/ui`
 * message seam (./../index.ts) can localize ui-rendered text but never these —
 * the shell paints them verbatim — so they get their own typed catalog here
 * (R-review fix F2, feat/i18n-locales; docs/i18n.md has the locale matrix).
 *
 * Same registry shape as the main-process catalog: dotted `group.key`, English
 * structural fallback, fail-loud on unknown keys. Locale tags are canonicalized
 * through the renderer's single parsing law (`normalizeLocaleTag`), so
 * 'pt-BR'/'pt_BR'/'pt-PT'/'pt' all land on the Brazilian bundle.
 *
 * Adding a locale: author `locales/xx` here (satisfies WindowOwnCatalog) + one
 * registry line below — the suite pins key-set identity and the EN-leak
 * allow-lists.
 *
 * @copyright 2026 Joe Huss <detain@interserver.net>
 */
import { normalizeLocaleTag } from '../index';
import { WIN_EN } from './en';
import { WIN_ES } from './es';
import { WIN_FR } from './fr';
import { WIN_DE } from './de';
import { WIN_IT } from './it';
import { WIN_PT_BR } from './pt_BR';
import { WIN_JA } from './ja';

/** Dotted key into the catalog, e.g. `'nav.myServers'`. */
export type WindowOwnMessageKey = {
  [G in keyof typeof WIN_EN]: `${G & string}.${keyof (typeof WIN_EN)[G] & string}`;
}[keyof typeof WIN_EN];

/**
 * The shape every locale catalog must satisfy. Derived from `WIN_EN` (the SSOT
 * of the exact shipped labels), so a locale that forgets or invents a key does
 * not typecheck.
 */
export type WindowOwnCatalog = {
  [G in keyof typeof WIN_EN]: { [K in keyof (typeof WIN_EN)[G]]: string };
};

// Registry: adding a locale = new catalog file + one entry here.
const catalogs: Record<string, WindowOwnCatalog> = {
  en: WIN_EN,
  es: WIN_ES,
  fr: WIN_FR,
  de: WIN_DE,
  it: WIN_IT,
  pt_BR: WIN_PT_BR,
  ja: WIN_JA
};

/** Registry tags — exported so tests pin the registry against the catalog files. */
export const WINDOW_OWN_CATALOG_TAGS: readonly string[] = Object.keys(catalogs);

let activeCatalog: WindowOwnCatalog = WIN_EN;
let activeLocale = 'en';

/**
 * Pin the windows-own renderer locale from a raw tag (whatever resolveLocale()
 * produced at boot). Unknown tags activate English — untranslated chrome must
 * still render working labels. Returns the catalog tag actually activated.
 */
export function setWindowLocale(rawLocale: string | null | undefined): string {
  const key = normalizeLocaleTag(rawLocale ?? '');
  const catalog = key ? catalogs[key] : undefined;
  if (!catalog) {
    activeCatalog = WIN_EN;
    activeLocale = 'en';
    return activeLocale;
  }

  activeCatalog = catalog;
  activeLocale = key as string;
  return activeLocale;
}

/** The catalog tag currently active ('en' until changed). */
export function getWindowLocale(): string {
  return activeLocale;
}

/**
 * Resolve a dotted nav-label key against the active catalog. Throws on an
 * unknown key — keys are statically typed, so a miss means catalog/registry
 * drift (a broken build), never a user-facing condition.
 */
export function tWin(key: WindowOwnMessageKey): string {
  const dot = key.indexOf('.');
  const group = key.slice(0, dot) as keyof WindowOwnCatalog;
  const id = key.slice(dot + 1);

  const groupMessages = activeCatalog[group] as Record<string, string> | undefined;
  const value = groupMessages?.[id];
  if (typeof value !== 'string') {
    throw new Error(`[i18n] Unknown windows-own message key "${key}" for locale "${activeLocale}"`);
  }
  return value;
}
