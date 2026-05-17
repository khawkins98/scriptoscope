// Validate the canonical theme bundles end-to-end through parseTheme.
//
// This is the test that fails loudly if regeneration breaks the bundles:
// run `node scripts/build-theme-bundles.mjs` and re-test.

import { describe, expect, it } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseTheme } from './parseTheme.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, '..', '..', '..');

const CANONICAL_BUNDLES = ['masswerk-7-le', 'masswerk-dark-ergobox2'];

describe('canonical theme bundles', () => {
  for (const slug of CANONICAL_BUNDLES) {
    describe(`themes/${slug}/`, () => {
      const bundleDir = resolve(repoRoot, 'themes', slug);
      const themeJsonPath = resolve(bundleDir, 'theme.json');
      const metaJsonPath = resolve(bundleDir, 'meta.json');

      it('has a theme.json', () => {
        expect(existsSync(themeJsonPath)).toBe(true);
      });

      it('has a meta.json', () => {
        expect(existsSync(metaJsonPath)).toBe(true);
      });

      it('has a PROVENANCE.md', () => {
        expect(existsSync(resolve(bundleDir, 'PROVENANCE.md'))).toBe(true);
      });

      it('passes parseTheme validation', () => {
        const json = JSON.parse(readFileSync(themeJsonPath, 'utf8'));
        expect(() => parseTheme(json)).not.toThrow();
      });

      it('carries author + origin metadata merged from meta.json', () => {
        const json = JSON.parse(readFileSync(themeJsonPath, 'utf8'));
        const theme = parseTheme(json);
        expect(theme.author?.name).toBeTruthy();
        expect(theme.origin?.kind).toBe('kaleidoscope-port');
        expect(theme.origin?.originalLicense).toBeTruthy();
      });

      it('references chrome asset paths under cicns/', () => {
        const json = JSON.parse(readFileSync(themeJsonPath, 'utf8'));
        const theme = parseTheme(json);
        const entries = Object.values(theme.chromeElements ?? {});
        expect(entries.length).toBeGreaterThan(0);
        for (const e of entries) {
          expect(e.asset).toMatch(/^cicns\//);
        }
      });

      it('references pattern asset paths under ppats/', () => {
        const json = JSON.parse(readFileSync(themeJsonPath, 'utf8'));
        const theme = parseTheme(json);
        const entries = Object.values(theme.patterns ?? {});
        expect(entries.length).toBeGreaterThan(0);
        for (const e of entries) {
          expect(e.asset).toMatch(/^ppats\//);
        }
      });

      it('every chromeElement asset file exists on disk', () => {
        const json = JSON.parse(readFileSync(themeJsonPath, 'utf8'));
        const theme = parseTheme(json);
        for (const e of Object.values(theme.chromeElements ?? {})) {
          expect(existsSync(resolve(bundleDir, e.asset))).toBe(true);
        }
      });

      it('every pattern asset file exists on disk', () => {
        const json = JSON.parse(readFileSync(themeJsonPath, 'utf8'));
        const theme = parseTheme(json);
        for (const e of Object.values(theme.patterns ?? {})) {
          expect(existsSync(resolve(bundleDir, e.asset))).toBe(true);
        }
      });

      it('every bgPattern slug resolves to a patterns entry', () => {
        const json = JSON.parse(readFileSync(themeJsonPath, 'utf8'));
        const theme = parseTheme(json);
        const patternKeys = new Set(Object.keys(theme.patterns ?? {}));
        for (const e of Object.values(theme.chromeElements ?? {})) {
          if (e.bgPattern != null) {
            expect(patternKeys.has(e.bgPattern)).toBe(true);
          }
        }
      });
    });
  }

  it('lists both canonical bundles', () => {
    // Belt-and-suspenders: if someone adds a new bundle they should add it
    // to this list so its fixtures get validated automatically.
    expect(CANONICAL_BUNDLES).toEqual(['masswerk-7-le', 'masswerk-dark-ergobox2']);
  });
});
