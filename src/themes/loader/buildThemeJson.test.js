import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildThemeJson } from './buildThemeJson.js';
import { validateTheme, ThemeValidationError } from './validateTheme.js';
// Import the TS source directly — vitest/esbuild compiles on the fly so the
// JS extractor tests get the same parseTheme the production library exports.
// eslint-disable-next-line import/extensions
import { parseTheme } from '../../../src/themes/schema/parseTheme.ts';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, '..', '..', '..');

function loadFixture(scheme) {
  const path = resolve(repoRoot, 'demo/assets/themes', scheme, 'extraction-manifest.json');
  return JSON.parse(readFileSync(path, 'utf8'));
}

describe('buildThemeJson', () => {
  describe('mass:werk 7 Le fixture', () => {
    const manifest = loadFixture('masswerk-7-le');
    const theme = buildThemeJson(manifest);

    it('emits version 0.1', () => {
      expect(theme.version).toBe('0.1');
    });

    it('passes the JS validator (extractor mirror)', () => {
      expect(() => validateTheme(theme)).not.toThrow();
    });

    it('passes the TS source-of-truth validator', () => {
      // Same fixture through parseTheme — guards against drift between the two
      // implementations. If this fails but validateTheme passes, the JS mirror
      // is too lax; if the reverse, the TS validator is too strict.
      expect(() => parseTheme(theme)).not.toThrow();
    });

    it('populates chromeElements with paired cinf geometry', () => {
      const entries = Object.values(theme.chromeElements);
      expect(entries.length).toBeGreaterThan(50);
      const withSlice = entries.filter(e => e.slice !== null);
      expect(withSlice.length).toBeGreaterThan(0);
      // All slice entries have the required shape.
      for (const e of withSlice) {
        expect(e.slice).toMatchObject({
          corner: expect.any(Number),
          side: expect.any(Number),
          tile: expect.any(Boolean),
        });
      }
    });

    it('flattens textAnchor/embossAnchor to [x, y] tuples', () => {
      const entries = Object.values(theme.chromeElements);
      const withText = entries.find(e => e.textAnchor !== null);
      expect(withText).toBeDefined();
      expect(Array.isArray(withText.textAnchor)).toBe(true);
      expect(withText.textAnchor).toHaveLength(2);
      expect(typeof withText.textAnchor[0]).toBe('number');
    });

    it('resolves bgPattern to a patterns-catalog slug, not an object', () => {
      const withPattern = Object.values(theme.chromeElements)
        .filter(e => e.bgPattern !== null);
      for (const e of withPattern) {
        expect(typeof e.bgPattern).toBe('string');
        // The slug should actually exist in the patterns catalog.
        expect(theme.patterns).toHaveProperty(e.bgPattern);
      }
    });

    it('emits a patterns catalog from ppat assets', () => {
      expect(theme.patterns).toBeDefined();
      const slugs = Object.keys(theme.patterns);
      expect(slugs.length).toBeGreaterThan(0);
      for (const slug of slugs) {
        expect(theme.patterns[slug].asset).toMatch(/\.png$/);
      }
    });

    it('emits windowTypes with chrome states classified from cicn names', () => {
      expect(theme.windowTypes).toBeDefined();
      const docWindow = Object.values(theme.windowTypes).find(
        w => w.chrome.active && w.chrome.inactive,
      );
      expect(docWindow).toBeDefined();
      // 7 Le's Document Window has all four states.
      expect(docWindow.chrome).toMatchObject({
        active: expect.stringMatching(/\.png$/),
        inactive: expect.stringMatching(/\.png$/),
      });
    });

    it('converts wnd# parts from array to Record keyed by part-N', () => {
      const wts = Object.values(theme.windowTypes);
      const withParts = wts.find(w => Object.keys(w.parts).length > 0);
      expect(withParts).toBeDefined();
      for (const key of Object.keys(withParts.parts)) {
        expect(key).toMatch(/^part-\d+$/);
      }
    });

    it('converts wnd# rects from {top,left,bottom,right} to [left,top,right,bottom]', () => {
      const wts = Object.values(theme.windowTypes);
      for (const wt of wts) {
        for (const [, part] of Object.entries(wt.parts)) {
          expect(Array.isArray(part.rect)).toBe(true);
          expect(part.rect).toHaveLength(4);
          part.rect.forEach(n => expect(typeof n).toBe('number'));
        }
      }
    });

    it('converts edge recipes to {at, part: string} shape', () => {
      const wts = Object.values(theme.windowTypes);
      const withEdges = wts.find(w => w.edges?.top?.length > 0);
      expect(withEdges).toBeDefined();
      for (const recipe of withEdges.edges.top) {
        expect(recipe).toMatchObject({
          at: expect.any(Number),
          part: expect.stringMatching(/^part-/),
        });
      }
    });
  });

  describe('mass:werk Dark ErgoBox 2 fixture', () => {
    const manifest = loadFixture('masswerk-dark-ergobox2');
    const theme = buildThemeJson(manifest);

    it('passes both validators', () => {
      expect(() => validateTheme(theme)).not.toThrow();
      expect(() => parseTheme(theme)).not.toThrow();
    });

    it('classifies ErgoBox window chrome correctly (no collapsed states)', () => {
      // ErgoBox 2 has Document Window Active + Inactive (no collapsed variants).
      const docWindow = Object.values(theme.windowTypes).find(
        w => w.chrome.active && w.chrome.inactive,
      );
      expect(docWindow).toBeDefined();
      expect(docWindow.chrome).toMatchObject({
        active: expect.stringMatching(/\.png$/),
        inactive: expect.stringMatching(/\.png$/),
      });
    });
  });

  describe('sidecar metadata', () => {
    it('merges meta on top of extracted sections', () => {
      const manifest = loadFixture('masswerk-7-le');
      const theme = buildThemeJson(manifest, {
        meta: {
          name: 'mass:werk 7 Le',
          author: { name: 'Norbert Landsteiner', url: 'https://www.masswerk.at' },
          origin: { kind: 'kaleidoscope-port', originalFormat: 'ksc' },
          options: { menuHighlightOverlay: true },
        },
      });
      expect(theme.name).toBe('mass:werk 7 Le');
      expect(theme.author.name).toBe('Norbert Landsteiner');
      expect(theme.origin.kind).toBe('kaleidoscope-port');
      expect(theme.options.menuHighlightOverlay).toBe(true);
      // Extracted sections still present.
      expect(theme.chromeElements).toBeDefined();
      // Whole thing passes validation.
      expect(() => parseTheme(theme)).not.toThrow();
    });
  });

  describe('empty manifest', () => {
    it('produces a minimal valid theme.json', () => {
      const theme = buildThemeJson({
        source: 'empty.r',
        extractedAt: '2026-05-17T00:00:00Z',
        counts: { total: 0, ok: 0, skipped: 0, errored: 0, raster: 0, geometry: 0 },
        assets: [],
      });
      expect(theme.version).toBe('0.1');
      expect(theme.chromeElements).toBeUndefined();
      expect(theme.patterns).toBeUndefined();
      expect(theme.windowTypes).toBeUndefined();
      expect(() => parseTheme(theme)).not.toThrow();
    });
  });
});

describe('validateTheme (extractor JS mirror)', () => {
  it('mirrors parseTheme behavior on the canonical fixtures', () => {
    // Belt-and-suspenders: if validateTheme accepts but parseTheme rejects
    // (or vice versa), this is the test that catches the drift.
    for (const scheme of ['masswerk-7-le', 'masswerk-dark-ergobox2']) {
      const manifest = JSON.parse(
        readFileSync(
          resolve(repoRoot, 'demo/assets/themes', scheme, 'extraction-manifest.json'),
          'utf8',
        ),
      );
      const theme = buildThemeJson(manifest);
      const jsResult = safeRun(() => validateTheme(theme));
      const tsResult = safeRun(() => parseTheme(theme));
      expect(jsResult.ok).toBe(tsResult.ok);
    }
  });

  it('rejects missing version', () => {
    expect(() => validateTheme({})).toThrow(ThemeValidationError);
  });

  it('rejects wrong version', () => {
    expect(() => validateTheme({ version: '0.2' })).toThrow(/expected version "0.1"/);
  });

  it('attaches a dotted path to errors', () => {
    try {
      validateTheme({ version: '0.1', author: { name: 42 } });
      throw new Error('expected throw');
    } catch (e) {
      expect(e).toBeInstanceOf(ThemeValidationError);
      expect(e.path).toBe('theme.json.author.name');
    }
  });
});

function safeRun(fn) {
  try {
    fn();
    return { ok: true };
  } catch (e) {
    return { ok: false, message: e.message };
  }
}
