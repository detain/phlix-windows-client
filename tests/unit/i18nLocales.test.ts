/**
 * Six-locale integrity suite — the law-gate for every catalog the
 * feat/i18n-locales lane ships (es, fr, de, it, pt_BR, ja):
 *
 *  A. UI SEAM (vendored from phlix-ui, SSOT): key-set identity across the six
 *     bundles, coverage of the INSTALLED DEFAULT_MESSAGES, bundle-vs-installed
 *     SET EQUALITY (closed at the v0.99.5 re-pin, CARRIED at v0.99.6 and again at
 *     v0.99.7 — locale tree byte-identical across all three peels, messages.ts
 *     unmoved; the
 *     formerly-ahead keys keep focused cross-bundle laws),
 *     placeholder parity, CLDR segment law (incl. the documented
 *     additive exception), diacritics/CJK sanity, and PIN/hash drift guards
 *     against the vendored files (CI-skipped source leg, see below).
 *  B. WINDOWS-OWN RENDERER catalog (nav labels buildMenu hands to ui): 16-key
 *     identity, the byte-identical English baseline keys, EN-leak allow-lists
 *     verified BOTH directions.
 *  B+. FR TYPOGRAPHIC APOSTROPHE law over windows-own + main fr VALUES: no
 *      letter'letter survives (SSOT declares ’); elision-bearing catalogs must
 *      render at least one ’ so the absence law can never pass vacuously.
 *  C. MAIN-PROCESS catalog: 29-key identity per locale, placeholder parity,
 *     ja CJK sanity, EN-leak allow-lists both directions, t() switching.
 *  D. RESOLUTION MATRIX: raw tag → picked bundle for all three catalogs
 *     (ui seam via messagesForLocale, windows-own via setWindowLocale/tWin,
 *     main via setMainLocale/t) + registry completeness guards.
 *
 * CI NOTE (anti-phantom, verified against .github/workflows/test.yml): the
 * windows CI runs a bare `actions/checkout` of THIS repo only — no sibling
 * repos are cloned. The vendored SOURCE leg therefore skips (loudly, by name)
 * when ../phlix-ui is absent and hard-fails on dev machines — drift protection
 * there rides the local gate plus the re-pin cascade (docs/i18n.md). The
 * PIN↔disk leg needs no sibling and runs everywhere.
 *
 * @copyright 2026 Joe Huss <detain@interserver.net>
 */
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { DEFAULT_MESSAGES } from '@phlix/ui';
import {
  FALLBACK_LOCALE,
  SUPPORTED_LOCALES,
  messagesForLocale,
  normalizeLocaleTag,
  type SupportedLocale,
} from '@/i18n';
import { LOCALE_MESSAGES } from '@/i18n/ui-locale-bundles';
import {
  WINDOW_OWN_CATALOG_TAGS,
  getWindowLocale,
  setWindowLocale,
  tWin,
  type WindowOwnMessageKey,
} from '@/i18n/windows-own';
import { WIN_EN } from '@/i18n/windows-own/en';
import { WIN_ES } from '@/i18n/windows-own/es';
import { WIN_FR } from '@/i18n/windows-own/fr';
import { WIN_DE } from '@/i18n/windows-own/de';
import { WIN_IT } from '@/i18n/windows-own/it';
import { WIN_PT_BR } from '@/i18n/windows-own/pt_BR';
import { WIN_JA } from '@/i18n/windows-own/ja';
import { MAIN_CATALOG_TAGS, getMainLocale, setMainLocale, t, type MainMessageKey } from '../../src/main/i18n';
import { en as MAIN_EN } from '../../src/main/i18n/en';
import { es as MAIN_ES } from '../../src/main/i18n/locales/es';
import { fr as MAIN_FR } from '../../src/main/i18n/locales/fr';
import { de as MAIN_DE } from '../../src/main/i18n/locales/de';
import { it as MAIN_IT } from '../../src/main/i18n/locales/it';
import { pt_BR as MAIN_PT_BR } from '../../src/main/i18n/locales/pt_BR';
import { ja as MAIN_JA } from '../../src/main/i18n/locales/ja';

type Table = Record<string, Record<string, string>>;
const LOCALES = ['es', 'fr', 'de', 'it', 'pt_BR', 'ja'] as const;
type Locale = (typeof LOCALES)[number];
const LATIN: readonly Locale[] = ['es', 'fr', 'de', 'it', 'pt_BR'];

const UI_TABLES = LOCALE_MESSAGES as unknown as Record<Locale, Table>;
const WIN_TABLES: Record<Locale, Table> = {
  es: WIN_ES as unknown as Table,
  fr: WIN_FR as unknown as Table,
  de: WIN_DE as unknown as Table,
  it: WIN_IT as unknown as Table,
  pt_BR: WIN_PT_BR as unknown as Table,
  ja: WIN_JA as unknown as Table,
};
const MAIN_TABLES: Record<Locale, Table> = {
  es: MAIN_ES as unknown as Table,
  fr: MAIN_FR as unknown as Table,
  de: MAIN_DE as unknown as Table,
  it: MAIN_IT as unknown as Table,
  pt_BR: MAIN_PT_BR as unknown as Table,
  ja: MAIN_JA as unknown as Table,
};

/** Flatten a nested catalog to `group.key` → value. */
function flat(table: Table): Map<string, string> {
  const out = new Map<string, string>();
  for (const [group, entries] of Object.entries(table)) {
    for (const [key, value] of Object.entries(entries)) out.set(`${group}.${key}`, value);
  }
  return out;
}
const EN_UI = flat(DEFAULT_MESSAGES as unknown as Table);
const EN_WIN = flat(WIN_EN as unknown as Table);
const EN_MAIN = flat(MAIN_EN as unknown as Table);

function keySet(table: Table): string {
  return [...flat(table).keys()].sort().join('\n');
}
function placeholders(value: string): string {
  return [...new Set(value.match(/\{\w+\}/g) ?? [])].sort().join(',');
}
function segments(value: string): number {
  return value.split('|').length;
}

// ui-side exception (SSOT doctrine): player.subtitleDownloads adds the pipe
// form in latin bundles where the English default hardcodes the plural.
const UI_ADDITIVE_PIPES: readonly string[] = ['player.subtitleDownloads'];

// The seven keys the dc1df7d5 vendor ran AHEAD of the then-installed v0.99.4
// catalog. The v0.99.5 re-pin shipped them into DEFAULT_MESSAGES, so the
// bundle-vs-installed relation is now exact SET EQUALITY (law below); this
// list survives to keep the two focused cross-bundle laws (placeholders,
// segment counts) aimed at the keys that historically drifted first.
const FORMER_AHEAD_KEYS: readonly string[] = [
  'connect.scan',
  'connect.scanning',
  'connect.scanFailed',
  'connect.scanEmpty',
  'connect.scanListLabel',
  'player.seekBackward',
  'player.seekForward',
].sort();

// Keys whose value legitimately EQUALS English (brand tokens, loanwords,
// international media words) IN THE CLIENT-AUTHORED catalogs — verified BOTH
// directions. The vendored ui bundles are exempt here: their exhaustive
// non-English allow-list is owned by the ui SSOT suite (src/i18n/locales.test.ts
// upstream); client-side they ride the ≥90%-differ bulk law above.
// windows-own renderer nav: 'Photos' is the French word too (fr), 'Admin' the
// accepted German desktop short form (de). Nothing else collides.
const WIN_EN_LEAK_OK: Record<Locale, readonly string[]> = {
  es: [],
  fr: ['nav.photos'],
  de: ['nav.admin'],
  it: [],
  pt_BR: [],
  ja: [],
};
// main-process chrome: the brand string 'Phlix Media Server' (tray.tooltip,
// about.message) stays verbatim in EVERY locale; it keeps the loanwords File /
// Stop; fr+de keep the international media label Pause.
const MAIN_EN_LEAK_OK: Record<Locale, readonly string[]> = {
  es: ['tray.tooltip', 'about.message'],
  fr: ['tray.tooltip', 'thumbar.pause', 'about.message'],
  de: ['tray.tooltip', 'thumbar.pause', 'about.message'],
  it: ['tray.tooltip', 'tray.stop', 'menu.file', 'menu.stop', 'about.message'],
  pt_BR: ['tray.tooltip', 'about.message'],
  ja: ['tray.tooltip', 'about.message'],
};

const CJK = /[\u3040-\u30ff\u3400-\u4dbf\u4e00-\u9fff]/;

/** Both-direction EN-leak law for one catalog pair. */
function assertLeakLaw(label: string, table: Map<string, string>, baseline: Map<string, string>, allow: readonly string[]): void {
  for (const [key, value] of table) {
    const en = baseline.get(key);
    if (en === undefined) continue; // vendor-ahead guard: dead under v0.99.5 equality, live if a re-vendor ever outruns the npm pin
    if (allow.includes(key)) {
      expect(value, `${label}: allow-listed ${key} must actually EQUAL English`).toBe(en);
    } else {
      expect(value, `${label}: unexplained English leak at ${key}`).not.toBe(en);
    }
  }
}

// ---------------------------------------------------------------------------
// A. Vendored UI bundles (SSOT = phlix-ui; we only re-prove invariants here)
// ---------------------------------------------------------------------------

describe('ui bundles — key-set identity and installed coverage', () => {
  it('all six vendored bundles carry an identical key set', () => {
    const reference = keySet(UI_TABLES.es);
    for (const locale of LOCALES) {
      expect(keySet(UI_TABLES[locale]), `${locale} key set differs from es`).toBe(reference);
    }
  });

  it('installed DEFAULT_MESSAGES keys are all present in every bundle (installed ⊆ bundle)', () => {
    for (const locale of LOCALES) {
      const bundleKeys = new Set(flat(UI_TABLES[locale]).keys());
      const missing = [...EN_UI.keys()].filter((key) => !bundleKeys.has(key));
      expect(missing, `${locale} missing installed keys`).toEqual([]);
    }
  });

  it('bundle key set EQUALS the installed pin (gap closed at v0.99.5, carried at v0.99.6, carried again at v0.99.7)', () => {
    // Vendor @ bc1d29bf (tag v0.99.7) vs installed @phlix/ui v0.99.7 — the
    // dc1df7d5-era 7-key ahead-of-pin gap closed at the v0.99.5 re-pin and the
    // equality CARRIES at v0.99.6 and again at v0.99.7: src/i18n/locales is
    // byte-identical across all three peels (tree f8b090a6 at each) and
    // src/i18n/messages.ts never moved between them, so the bundle-vs-installed
    // relation is unchanged and all 14
    // PIN content hashes ride through untouched. So the
    // relation is exact set equality in BOTH directions (installed ⊆ bundle
    // is separately pinned above; this pins bundle ⊆ installed and, with it,
    // the empty extras set). The seven keys are additionally pinned present
    // in the installed catalog so a future upstream rename cannot dissolve
    // the cross-bundle laws below into a vacuous walk over missing keys.
    const bundleKeys = new Set(flat(UI_TABLES.es).keys());
    expect([...bundleKeys].filter((key) => !EN_UI.has(key)).sort()).toEqual([]);
    for (const key of FORMER_AHEAD_KEYS) {
      expect(EN_UI.has(key), `installed catalog lost ${key} since the v0.99.5 re-pin`).toBe(true);
      expect(bundleKeys.has(key), `bundle lost formerly-ahead key ${key}`).toBe(true);
    }
  });

  it("every bundle value keeps its key's {placeholder} set (vs English)", () => {
    for (const locale of LOCALES) {
      const table = flat(UI_TABLES[locale]);
      for (const [key, value] of table) {
        const en = EN_UI.get(key);
        if (en === undefined) {
          expect(value.trim().length, `${locale} ${key} empty`).toBeGreaterThan(0);
          continue;
        }
        expect(placeholders(value), `${locale} ${key} placeholders`).toBe(placeholders(en));
      }
    }
  });

  it('cross-bundle placeholder sets agree for sample formerly-ahead keys (direct bundle↔bundle check)', () => {
    // Rides alongside the vs-English placeholder law (which now covers these
    // keys through their installed baseline); kept as the direct cross-bundle
    // assertion the dc1df7d5-era laws used.
    for (const key of ['connect.scan', 'player.seekBackward', 'player.seekForward']) {
      const base = placeholders(flat(UI_TABLES.es).get(key) ?? '');
      for (const locale of LOCALES) {
        expect(placeholders(flat(UI_TABLES[locale]).get(key) ?? ''), `${locale} ${key}`).toBe(base);
      }
    }
  });

  it('CLDR segment law: latin mirrors English (additive exception 2), ja collapses to 1 everywhere', () => {
    for (const locale of LOCALES) {
      const table = flat(UI_TABLES[locale]);
      for (const [key, value] of table) {
        const en = EN_UI.get(key);
        if (en === undefined) continue; // vendor-ahead guard (see assertLeakLaw): cross-bundle counts pinned below
        if (locale === 'ja') {
          expect(segments(value), `ja ${key} must be pipe-free`).toBe(1);
          continue;
        }
        if (UI_ADDITIVE_PIPES.includes(key)) {
          expect(segments(value), `${locale} ${key}`).toBe(2);
          continue;
        }
        expect(segments(value), `${locale} ${key} segment drift vs en`).toBe(segments(en));
      }
    }
  });

  it('all seven formerly-ahead keys carry identical segment counts across bundles', () => {
    // The dc1df7d5-era law survives the v0.99.5 equality re-pin: the CLDR law
    // now reaches these keys through their installed English baseline, but
    // this direct bundle↔bundle count agreement over the FULL FORMER_AHEAD_KEYS
    // set stays as the vendor's own invariant.
    for (const key of FORMER_AHEAD_KEYS) {
      const counts = new Set(LOCALES.map((locale) => segments(flat(UI_TABLES[locale]).get(key) ?? '')));
      expect([...counts], `${key} segment counts differ across bundles`).toHaveLength(1);
    }
  });

  it('no bundle is a copy-paste of English (each differs from the default on ≥90% of shared keys)', () => {
    for (const locale of LOCALES) {
      const table = flat(UI_TABLES[locale]);
      const shared = [...EN_UI.entries()];
      const differs = shared.filter(([key, value]) => table.get(key) !== value).length;
      expect(differs / shared.length, `${locale} looks untranslated`).toBeGreaterThanOrEqual(0.9);
    }
  });

  it('ja ui bundle is overwhelmingly CJK (≥90% of values; formats/loanwords may stay Latin)', () => {
    const values = [...flat(UI_TABLES.ja).values()];
    const cjkCount = values.filter((value) => CJK.test(value)).length;
    expect(cjkCount / values.length).toBeGreaterThanOrEqual(0.9);
  });

  const LATIN_SPECS: Record<string, { re: RegExp; min: number }> = {
    es: { re: /[áéíóúüñ¿¡]/, min: 50 },
    fr: { re: /[àâäéèêëîïôùûüçœ]/, min: 50 },
    de: { re: /[äöüß]/, min: 40 },
    it: { re: /[àèéìòù]/, min: 4 },
    pt_BR: { re: /[ãõáâàéêíóôúçü]/, min: 30 },
  };
  it('latin ui bundles carry plausible diacritics (bulk-English regression cap)', () => {
    for (const locale of LATIN) {
      const spec = LATIN_SPECS[locale];
      const hits = [...flat(UI_TABLES[locale]).values()].filter((value) => spec.re.test(value)).length;
      expect(hits, `${locale} diacritics floor`).toBeGreaterThanOrEqual(spec.min);
    }
  });
});

// ---------------------------------------------------------------------------
// D→B. Vendoring drift guards — PIN↔disk everywhere; PIN↔source when sibling exists
// ---------------------------------------------------------------------------

const HERE = dirname(fileURLToPath(import.meta.url));
const VENDOR_DIR = join(HERE, '../../src/renderer/i18n/ui-locale-bundles');
const SIBLING_UI = join(HERE, '../../../phlix-ui');
const SIBLING_PRESENT = existsSync(join(SIBLING_UI, '.git'));

interface Pin {
  ref: string;
  branch: string;
  directory: string;
  transforms: string[];
  files: Record<string, { source_sha256: string; vendored_sha256: string }>;
}
const pin: Pin = JSON.parse(readFileSync(join(VENDOR_DIR, 'PIN'), 'utf8'));

function sha256(text: string): string {
  return createHash('sha256').update(text, 'utf8').digest('hex');
}

describe('vendored bundles — PIN integrity (runs in CI: needs no sibling)', () => {
  it('PIN covers exactly the seven vendored files', () => {
    expect(Object.keys(pin.files).sort()).toEqual(
      ['de.ts', 'es.ts', 'fr.ts', 'index.ts', 'it.ts', 'ja.ts', 'pt_BR.ts'],
    );
  });

  it('every vendored file on disk hashes to its PIN entry', () => {
    for (const [file, entry] of Object.entries(pin.files)) {
      const disk = readFileSync(join(VENDOR_DIR, file), 'utf8');
      expect(sha256(disk), `${file} drifted from PIN without a re-sync`).toBe(entry.vendored_sha256);
    }
  });

  it('PIN ref equals the sync script SOURCE_REF constant (no silent pin drift)', () => {
    const script = readFileSync(join(HERE, '../../scripts/sync-ui-locale-bundles.mjs'), 'utf8');
    const match = script.match(/const SOURCE_REF = '([0-9a-f]{40})';/);
    expect(match, 'sync script must declare a 40-hex SOURCE_REF').not.toBeNull();
    expect(pin.ref).toBe(match![1]);
  });

  it('the registry exposes precisely the six estate locales', () => {
    expect(Object.keys(LOCALE_MESSAGES).sort()).toEqual([...LOCALES].sort());
  });
});

describe.skipIf(!SIBLING_PRESENT)(
  'vendored bundles — SOURCE parity vs pinned phlix-ui commit [HARD-FAILS locally; SKIPS in CI: no phlix-ui sibling checked out — drift protection rides the local gate + re-pin cascade, see docs/i18n.md]',
  () => {
    it('disk equals script-transformed pristine source AND PIN source hashes match', () => {
      // Mirrors scripts/sync-ui-locale-bundles.mjs transforms 1–3; if the
      // script's transforms change without a re-sync this goes red, which is
      // exactly the drift signal.
      const applyTransforms = (file: string, source: string): string => {
        let out = source.split("import type { PhlixMessages } from '../messages';\n").join('');
        out = file === 'index.ts'
          ? out.split('Record<PhlixLocaleCode, PhlixMessages>').join('Record<PhlixLocaleCode, Record<string, Record<string, string>>>')
          : out.split('satisfies PhlixMessages;').join('satisfies Record<string, Record<string, string>>;');
        return out;
      };
      for (const [file, entry] of Object.entries(pin.files)) {
        const source = execFileSync('git', ['-C', SIBLING_UI, 'show', `${pin.ref}:${pin.directory}/${file}`], {
          encoding: 'utf8',
          maxBuffer: 8 * 1024 * 1024,
        });
        expect(sha256(source), `PIN source hash for ${file}`).toBe(entry.source_sha256);
        const disk = readFileSync(join(VENDOR_DIR, file), 'utf8');
        expect(disk, `${file} ≠ transform(${pin.ref.slice(0, 8)}:${file}) — re-run scripts/sync-ui-locale-bundles.mjs`).toBe(
          applyTransforms(file, source),
        );
      }
    });
  },
);

// ---------------------------------------------------------------------------
// B. WINDOWS-OWN renderer catalog (nav labels — authored here, every law pinned)
// ---------------------------------------------------------------------------

describe('windows-own nav catalog — key-set, baseline, leaks', () => {
  it('every locale table has EXACTLY the 16 English nav keys (both directions)', () => {
    const reference = keySet(WIN_EN as unknown as Table);
    for (const locale of LOCALES) {
      expect(keySet(WIN_TABLES[locale]), `${locale} key set differs from en`).toBe(reference);
    }
    expect(EN_WIN.size).toBe(16);
  });

  it('the registry carries precisely the catalog files that exist', () => {
    expect([...WINDOW_OWN_CATALOG_TAGS].sort()).toEqual(['de', 'en', 'es', 'fr', 'it', 'ja', 'pt_BR']);
  });

  it('no nav value invents or drops a {placeholder} (none exist today — tripwire)', () => {
    for (const locale of LOCALES) {
      const table = flat(WIN_TABLES[locale]);
      for (const [key, value] of table) {
        expect(placeholders(value), `${locale} ${key}`).toBe(placeholders(EN_WIN.get(key) ?? ''));
      }
    }
  });

  it('nav values honor the no-English-leak allow-lists (both directions)', () => {
    for (const locale of LOCALES) {
      assertLeakLaw(`nav ${locale}`, flat(WIN_TABLES[locale]), EN_WIN, WIN_EN_LEAK_OK[locale]);
    }
  });

  it('latin nav carries diacritics where the language needs them (it legitimately has none in these 16)', () => {
    const specs: Record<string, { re: RegExp; min: number }> = {
      es: { re: /[áéíóúüñ]/, min: 2 },
      fr: { re: /[àâäéèêëîïôùûüç]/, min: 3 },
      de: { re: /[äöüß]/, min: 3 },
      pt_BR: { re: /[ãõáâàéêíóôúç]/, min: 2 },
    };
    for (const [locale, spec] of Object.entries(specs)) {
      const hits = [...flat(WIN_TABLES[locale as Locale]).values()].filter((v) => spec.re.test(v)).length;
      expect(hits, `${locale} nav diacritics floor`).toBeGreaterThanOrEqual(spec.min);
    }
  });

  it('ja nav is 100% CJK (no Latin-word nav labels)', () => {
    for (const value of flat(WIN_TABLES.ja).values()) {
      expect(value, `ja nav value '${value}' lacks CJK`).toMatch(CJK);
    }
  });

  it('setWindowLocale resolves every estate tag and falls back loudly-silent to en', () => {
    for (const locale of LOCALES) {
      expect(setWindowLocale(locale)).toBe(locale);
    }
    expect(setWindowLocale('zz-ZZ')).toBe('en');
    expect(setWindowLocale('')).toBe('en');
    expect(getWindowLocale()).toBe('en');
    setWindowLocale('en');
  });

  it('tWin renders every nav key per locale; unknown keys throw', () => {
    for (const locale of LOCALES) {
      setWindowLocale(locale);
      const table = flat(WIN_TABLES[locale]);
      for (const key of EN_WIN.keys()) {
        expect(tWin(key as WindowOwnMessageKey), `${locale} ${key}`).toBe(table.get(key));
      }
    }
    setWindowLocale('en');
    for (const [key, value] of EN_WIN) {
      expect(tWin(key as WindowOwnMessageKey)).toBe(value);
    }
    expect(() => tWin('nav.nope' as WindowOwnMessageKey)).toThrow(/Unknown windows-own message key "nav\.nope"/);
  });
});

// ---------------------------------------------------------------------------
// B+. FR TYPOGRAPHIC APOSTROPHE LAW — windows-own + main catalogs (R1 F-A)
// The vendored fr SSOT bundle declares a typographic-’ policy (its header
// law + every value); a straight ' surviving in a client-authored fr value
// renders as a mismatched glyph side-by-side with bundle text in the same
// top bar (e.g. nav 'Liens d'invitation' next to 'l’écran'). The law binds
// VALUES — what actually renders; source comments stay ASCII by convention.
// ---------------------------------------------------------------------------

const STRAIGHT_APOSTROPHE_IN_WORD = /\p{L}'\p{L}/u;
const CURLY_APOSTROPHE = '\u2019';

describe('fr typographic apostrophe law (windows-own + main catalogs)', () => {
  it("detector control — letter'letter trips, the curly form does not", () => {
    expect(STRAIGHT_APOSTROPHE_IN_WORD.test("d'x")).toBe(true);
    expect(STRAIGHT_APOSTROPHE_IN_WORD.test('d\u2019x')).toBe(false);
  });

  it('no fr value in windows-own or main carries a straight apostrophe mid-word', () => {
    const catalogs: [string, Table][] = [['windows-own', WIN_TABLES.fr], ['main', MAIN_TABLES.fr]];
    for (const [label, table] of catalogs) {
      for (const [key, value] of flat(table)) {
        expect(value, `fr ${label}.${key}: use the typographic ’ (U+2019), not '`).not.toMatch(STRAIGHT_APOSTROPHE_IN_WORD);
      }
    }
  });

  it('elision-bearing fr catalogs render the curly glyph (anti-vacuous presence)', () => {
    // windows-own ships 'Liens d’invitation'; the vendored SSOT carries the
    // policy itself. main/fr legitimately avoids every elision ('Retour
    // arrière', 'Avance rapide', 'mises à jour', …), so a ≥1-’ floor there
    // would force inventing French contractions to satisfy a quota — the
    // absence law above binds it and the detector control keeps that law
    // honest against silent regex/walk breakage.
    const hasCurly = (table: Table) => [...flat(table).values()].some((v) => v.includes(CURLY_APOSTROPHE));
    expect(hasCurly(WIN_TABLES.fr), 'windows-own fr must render at least one ’').toBe(true);
    expect(hasCurly(UI_TABLES.fr), 'vendored fr SSOT must render at least one ’').toBe(true);
  });
});

// ---------------------------------------------------------------------------
// C. MAIN-process catalog (29 chrome strings — every law pinned)
// ---------------------------------------------------------------------------

describe('main-process catalog ×6 — key-set, placeholders, sanity', () => {
  it('every locale carries EXACTLY the 29 English keys (both directions)', () => {
    const reference = keySet(MAIN_EN as unknown as Table);
    for (const locale of LOCALES) {
      expect(keySet(MAIN_TABLES[locale]), `${locale} key set differs from en`).toBe(reference);
    }
    expect(EN_MAIN.size).toBe(29);
  });

  it('the registry carries precisely the catalog files that exist', () => {
    expect([...MAIN_CATALOG_TAGS].sort()).toEqual(['de', 'en', 'es', 'fr', 'it', 'ja', 'pt_BR']);
  });

  it('every value keeps its key {placeholder} set verbatim ({version})', () => {
    for (const locale of LOCALES) {
      const table = flat(MAIN_TABLES[locale]);
      for (const [key, value] of table) {
        expect(placeholders(value), `${locale} ${key}`).toBe(placeholders(EN_MAIN.get(key) ?? ''));
      }
    }
  });

  it('the About detail keeps its two-newline structure in every locale', () => {
    for (const locale of LOCALES) {
      const detail = MAIN_TABLES[locale].about.detail;
      expect(detail, `${locale} about.detail structure`).toMatch(/\n\n/);
      expect(detail).toContain('{version}');
    }
  });

  it('chrome values honor the no-English-leak allow-lists (both directions)', () => {
    for (const locale of LOCALES) {
      assertLeakLaw(`main ${locale}`, flat(MAIN_TABLES[locale]), EN_MAIN, MAIN_EN_LEAK_OK[locale]);
    }
  });

  it('ja main catalog is overwhelmingly CJK (brand lines excepted)', () => {
    const values = [...flat(MAIN_TABLES.ja).values()];
    const cjkCount = values.filter((v) => CJK.test(v)).length;
    expect(cjkCount / values.length).toBeGreaterThanOrEqual(0.9);
  });

  it('setMainLocale activates each estate locale and t() switches its render', () => {
    const probes: [Locale, string, string][] = [
      ['es', 'tray.quit', 'Salir'],
      ['fr', 'menu.checkForUpdates', 'Rechercher des mises à jour'],
      ['de', 'menu.about', 'Über Phlix'],
      ['it', 'tray.quit', 'Esci'],
      ['pt_BR', 'tray.quit', 'Sair'],
      ['ja', 'tray.quit', '終了'],
    ];
    for (const [locale, key, expected] of probes) {
      setMainLocale(locale);
      // Existing contract (pinned in mainI18n.test.ts): getMainLocale mirrors
      // the RAW tag lowercased — 'pt_BR' reads back as 'pt_br', catalog choice
      // is separate from the echo.
      expect(getMainLocale()).toBe(locale.toLowerCase());
      expect(t(key as MainMessageKey)).toBe(expected);
    }
    setMainLocale('en');
    expect(t('tray.quit')).toBe('Quit');
  });

  it('region tags land on the right catalog (pt* → pt_BR, es-MX → es, ja-JP → ja)', () => {
    expect(setMainLocale('pt-BR')).toBe('pt-br');
    expect(t('tray.quit')).toBe('Sair');
    expect(setMainLocale('pt-PT')).toBe('pt-pt');
    expect(t('tray.quit')).toBe('Sair');
    expect(setMainLocale('PT_BR')).toBe('pt_br');
    expect(t('tray.quit')).toBe('Sair');
    expect(setMainLocale('es-MX')).toBe('es-mx');
    expect(t('tray.quit')).toBe('Salir');
    expect(setMainLocale('ja-JP')).toBe('ja-jp');
    expect(t('tray.quit')).toBe('終了');
  });

  it('interpolation survives per-locale (updater + about bodies)', () => {
    setMainLocale('de');
    expect(t('updater.availableBody', { version: '1.2.3' })).toContain('Phlix 1.2.3');
    expect(t('about.detail', { version: '9.9.9' })).toContain('Version 9.9.9');
    setMainLocale('ja');
    expect(t('updater.readyBody', { version: '2.0.0' })).toContain('Phlix 2.0.0');
    setMainLocale('en');
  });
});

// ---------------------------------------------------------------------------
// D. Resolution matrix — one raw tag, three catalogs, same verdict
// ---------------------------------------------------------------------------

describe('locale resolution matrix (raw tag → ui bundle + windows-own + main)', () => {
  const MATRIX: [string, SupportedLocale][] = [
    ['es-ES', 'es'], ['es-419', 'es'], ['ES', 'es'],
    ['fr-CA', 'fr'], ['de-DE', 'de'], ['it-IT', 'it'],
    ['pt', 'pt_BR'], ['pt_BR', 'pt_BR'], ['pt-BR', 'pt_BR'], ['pt-PT', 'pt_BR'],
    ['ja-JP', 'ja'], ['en-GB', 'en'],
    ['zz', 'en'], ['xx_YY', 'en'], ['kl-GL', 'en'],
  ];
  const QUIT_LABELS: Record<SupportedLocale, string> = {
    en: 'Quit', es: 'Salir', fr: 'Quitter', de: 'Beenden',
    it: 'Esci', pt_BR: 'Sair', ja: '終了',
  };

  it('normalizeLocaleTag implements the estate parsing law', () => {
    expect(normalizeLocaleTag('pt-BR')).toBe('pt_BR');
    expect(normalizeLocaleTag('PT_BR')).toBe('pt_BR');
    expect(normalizeLocaleTag('pt')).toBe('pt_BR');
    expect(normalizeLocaleTag('es-MX')).toBe('es');
    expect(normalizeLocaleTag('  ')).toBeNull();
  });

  for (const [tag, expected] of MATRIX) {
    it(`'${tag}' selects '${expected}' across ALL THREE catalogs`, () => {
      // 1) ui seam override.
      const override = messagesForLocale(tag);
      if (expected === 'en') {
        expect(override).toBeUndefined();
      } else {
        expect(override, `ui override missing for ${tag}`).toBeTruthy();
        expect((override as unknown as Table).common.retry).toBe(flat(UI_TABLES[expected as Locale]).get('common.retry'));
      }
      // 2) windows-own renderer catalog.
      expect(setWindowLocale(tag)).toBe(expected);
      const browse = expected === 'en' ? WIN_EN.nav.browse : WIN_TABLES[expected as Locale].nav.browse;
      expect(tWin('nav.browse')).toBe(browse);
      // 3) main-process catalog.
      setMainLocale(tag);
      expect(t('tray.quit' as MainMessageKey)).toBe(QUIT_LABELS[expected]);
      setWindowLocale('en');
      setMainLocale('en');
    });
  }

  it('unsupported tags never leak past the registries (FALLBACK is in SUPPORTED_LOCALES)', () => {
    expect(SUPPORTED_LOCALES).toContain(FALLBACK_LOCALE);
    expect([...SUPPORTED_LOCALES]).toEqual(['en', 'es', 'fr', 'de', 'it', 'pt_BR', 'ja']);
  });

  it('en path stays byte-identical everywhere: no ui override, EN nav, EN main', () => {
    expect(messagesForLocale('en')).toBeUndefined();
    expect(setWindowLocale('en')).toBe('en');
    for (const [key, value] of EN_WIN) {
      expect(tWin(key as WindowOwnMessageKey)).toBe(value);
    }
    setMainLocale('en');
    for (const [key, value] of EN_MAIN) {
      expect(t(key as MainMessageKey)).toBe(value);
    }
  });
});
