import { describe, expect, it } from 'vitest';
import { parseTheme, ThemeValidationError } from './parseTheme.js';
import { THEME_SCHEMA_VERSION } from './types.js';

describe('parseTheme', () => {
  describe('valid inputs', () => {
    it('accepts the minimal theme (just version)', () => {
      const theme = parseTheme({ version: THEME_SCHEMA_VERSION });
      expect(theme.version).toBe(THEME_SCHEMA_VERSION);
    });

    it('accepts the current extractor draft shape', () => {
      // Verbatim shape from demo/assets/themes/masswerk-7-le/theme.json —
      // ensures the validator doesn't reject bundles the extractor produces today.
      const draft = {
        version: '0.1',
        source: 'scheme.r',
        generatedAt: '2026-05-16T21:22:03.736Z',
        note: 'Draft theme.json produced by @aaron-ui/scheme-extractor.',
        chromeElements: {
          'empty-horizontal-scrollbar': {
            asset: 'cicn-n8287-empty-horizontal-scrollbar.png',
            width: 16,
            height: 16,
            slice: null,
            bgPattern: null,
            textAnchor: null,
            embossAnchor: null,
            sourceCicnId: -8287,
            sourceCinfId: null,
          },
        },
      };
      const theme = parseTheme(draft);
      expect(theme.chromeElements?.['empty-horizontal-scrollbar']?.asset).toBe(
        'cicn-n8287-empty-horizontal-scrollbar.png',
      );
      expect(theme.chromeElements?.['empty-horizontal-scrollbar']?.sourceCicnId).toBe(-8287);
      expect(theme.note).toMatch(/Draft theme.json/);
    });

    it('accepts a fully-populated theme per spec §7', () => {
      const full = {
        version: '0.1',
        name: 'mass:werk 7 Le',
        author: {
          name: 'Norbert Landsteiner',
          email: 'info@masswerk.at',
          url: 'https://www.masswerk.at',
          year: 2001,
        },
        origin: {
          kind: 'kaleidoscope-port',
          originalFormat: 'ksc',
          originalLicense: 'freeware-with-attribution',
          originalReadme: 'ReadMe-masswerk7Le',
          sourceUrl: 'https://www.masswerk.at/schemes.php',
        },
        options: {
          menuHighlightOverlay: true,
          unifiedScrollbarTrack: false,
        },
        windowTypes: {
          document: {
            chrome: {
              active: 'cicns/active-document-window.png',
              inactive: 'cicns/inactive-document-window.png',
            },
            parts: {
              close: { rect: [9, 5, 20, 16] },
              zoom: { rect: [36, 5, 48, 16] },
            },
            edges: {
              top: [
                { at: 0, part: 'fill' },
                { at: 5, part: 'close' },
              ],
              bottom: [],
              left: [],
              right: [],
            },
            bodyPattern: null,
          },
        },
        chromeElements: {
          'menu-item': {
            asset: 'cicns/menu-item.png',
            width: 100,
            height: 18,
            slice: { corner: 6, side: 6, tile: false },
            textAnchor: [6, 6],
          },
          'progress-bar-fill': {
            asset: 'cicns/progress-fill.png',
            tile: 'horizontal',
          },
        },
        patterns: {
          'titlebar-pinstripe': {
            asset: 'ppats/pinstripe.png',
            repeat: 'both',
          },
        },
        palette: {
          'active-titlebar-bg': '#cccccc',
          'active-titlebar-fg': '#000000',
        },
      };
      const theme = parseTheme(full);
      expect(theme.author?.name).toBe('Norbert Landsteiner');
      expect(theme.author?.year).toBe(2001);
      expect(theme.origin?.kind).toBe('kaleidoscope-port');
      expect(theme.options?.menuHighlightOverlay).toBe(true);
      expect(theme.windowTypes?.['document']?.chrome.active).toBe(
        'cicns/active-document-window.png',
      );
      expect(theme.windowTypes?.['document']?.parts?.['close']?.rect).toEqual([9, 5, 20, 16]);
      expect(theme.windowTypes?.['document']?.edges?.top?.[1]).toEqual({ at: 5, part: 'close' });
      expect(theme.chromeElements?.['menu-item']?.slice).toEqual({ corner: 6, side: 6, tile: false });
      expect(theme.chromeElements?.['progress-bar-fill']?.tile).toBe('horizontal');
      expect(theme.patterns?.['titlebar-pinstripe']?.repeat).toBe('both');
      expect(theme.palette?.['active-titlebar-bg']).toBe('#cccccc');
    });

    it('preserves bodyPattern: null distinct from absent', () => {
      const theme = parseTheme({
        version: '0.1',
        windowTypes: {
          document: {
            chrome: { active: 'a.png' },
            bodyPattern: null,
          },
        },
      });
      expect(theme.windowTypes?.['document']?.bodyPattern).toBeNull();
      expect('bodyPattern' in (theme.windowTypes?.['document'] ?? {})).toBe(true);
    });
  });

  describe('top-level structural violations', () => {
    it('throws when input is not an object', () => {
      expect(() => parseTheme(null)).toThrow(ThemeValidationError);
      expect(() => parseTheme('hello')).toThrow(/expected object/);
      expect(() => parseTheme(42)).toThrow(/expected object/);
      expect(() => parseTheme([])).toThrow(/expected object/);
    });

    it('throws when version is missing or wrong', () => {
      expect(() => parseTheme({})).toThrow(/expected version/);
      expect(() => parseTheme({ version: '0.2' })).toThrow(/expected version "0.1"/);
      expect(() => parseTheme({ version: 0.1 })).toThrow(/expected version/);
    });

    it('attaches a path to the error', () => {
      try {
        parseTheme({ version: '0.1', name: 42 });
        throw new Error('expected throw');
      } catch (e) {
        expect(e).toBeInstanceOf(ThemeValidationError);
        expect((e as ThemeValidationError).path).toBe('theme.json.name');
        expect((e as ThemeValidationError).message).toContain('theme.json.name');
      }
    });
  });

  describe('author', () => {
    it('requires name', () => {
      expect(() => parseTheme({ version: '0.1', author: {} })).toThrow(
        /theme\.json\.author\.name/,
      );
    });

    it('rejects non-string email', () => {
      expect(() =>
        parseTheme({ version: '0.1', author: { name: 'x', email: 42 } }),
      ).toThrow(/theme\.json\.author\.email/);
    });
  });

  describe('chromeElements', () => {
    it('requires asset on each entry', () => {
      expect(() =>
        parseTheme({
          version: '0.1',
          chromeElements: { button: { width: 100 } },
        }),
      ).toThrow(/theme\.json\.chromeElements\.button\.asset/);
    });

    it('validates slice shape', () => {
      expect(() =>
        parseTheme({
          version: '0.1',
          chromeElements: {
            button: { asset: 'b.png', slice: { corner: 4, side: 4 } }, // missing tile
          },
        }),
      ).toThrow(/theme\.json\.chromeElements\.button\.slice\.tile/);
    });

    it('accepts slice: null', () => {
      const t = parseTheme({
        version: '0.1',
        chromeElements: { button: { asset: 'b.png', slice: null } },
      });
      expect(t.chromeElements?.['button']?.slice).toBeNull();
    });

    it('rejects invalid tile direction', () => {
      expect(() =>
        parseTheme({
          version: '0.1',
          chromeElements: { p: { asset: 'p.png', tile: 'diagonal' } },
        }),
      ).toThrow(/expected "horizontal" \| "vertical" \| "both"/);
    });

    it('validates textAnchor as [x, y] pair', () => {
      expect(() =>
        parseTheme({
          version: '0.1',
          chromeElements: { x: { asset: 'x.png', textAnchor: [1, 2, 3] } },
        }),
      ).toThrow(/theme\.json\.chromeElements\.x\.textAnchor/);
    });

    it('parses bgAnchor alongside text + emboss anchors', () => {
      const t = parseTheme({
        version: '0.1',
        chromeElements: {
          x: {
            asset: 'x.png',
            bgAnchor: [1, 22],
            textAnchor: [12, 6],
            embossAnchor: [1, 1],
          },
        },
      });
      expect(t.chromeElements?.['x']?.bgAnchor).toEqual([1, 22]);
      expect(t.chromeElements?.['x']?.textAnchor).toEqual([12, 6]);
      expect(t.chromeElements?.['x']?.embossAnchor).toEqual([1, 1]);
    });

    it('validates bgAnchor as [x, y] pair', () => {
      expect(() =>
        parseTheme({
          version: '0.1',
          chromeElements: { x: { asset: 'x.png', bgAnchor: [1] } },
        }),
      ).toThrow(/theme\.json\.chromeElements\.x\.bgAnchor/);
    });
  });

  describe('windowTypes', () => {
    it('requires at least one chrome state', () => {
      expect(() =>
        parseTheme({
          version: '0.1',
          windowTypes: { document: { chrome: {} } },
        }),
      ).toThrow(/at least one state/);
    });

    it('validates part rect as 4-tuple', () => {
      expect(() =>
        parseTheme({
          version: '0.1',
          windowTypes: {
            document: {
              chrome: { active: 'a.png' },
              parts: { close: { rect: [1, 2, 3] } },
            },
          },
        }),
      ).toThrow(/theme\.json\.windowTypes\.document\.parts\.close\.rect/);
    });

    it('validates rect components as finite numbers', () => {
      expect(() =>
        parseTheme({
          version: '0.1',
          windowTypes: {
            document: {
              chrome: { active: 'a.png' },
              parts: { close: { rect: [1, 2, 3, NaN] } },
            },
          },
        }),
      ).toThrow(/expected finite number/);
    });

    it('validates edge recipes', () => {
      expect(() =>
        parseTheme({
          version: '0.1',
          windowTypes: {
            document: {
              chrome: { active: 'a.png' },
              edges: { top: 'not-an-array' },
            },
          },
        }),
      ).toThrow(/expected array of edge recipes/);
    });
  });

  describe('patterns', () => {
    it('requires asset on each entry', () => {
      expect(() =>
        parseTheme({
          version: '0.1',
          patterns: { p: { repeat: 'both' } },
        }),
      ).toThrow(/theme\.json\.patterns\.p\.asset/);
    });

    it('rejects invalid repeat value', () => {
      expect(() =>
        parseTheme({
          version: '0.1',
          patterns: { p: { asset: 'p.png', repeat: 'sideways' } },
        }),
      ).toThrow(/expected "horizontal" \| "vertical" \| "both"/);
    });
  });

  describe('options', () => {
    it('rejects non-boolean flag', () => {
      expect(() =>
        parseTheme({
          version: '0.1',
          options: { menuHighlightOverlay: 'yes' },
        }),
      ).toThrow(/theme\.json\.options\.menuHighlightOverlay/);
    });

    it('ignores unknown option keys (forward-compat)', () => {
      const t = parseTheme({
        version: '0.1',
        options: { newFutureFlag: true, menuHighlightOverlay: false },
      });
      // newFutureFlag is silently dropped
      expect(t.options?.menuHighlightOverlay).toBe(false);
      expect((t.options as Record<string, unknown>)['newFutureFlag']).toBeUndefined();
    });
  });

  describe('cursors', () => {
    it('parses a complete cursor entry', () => {
      const t = parseTheme({
        version: '0.1',
        cursors: {
          arrow: { asset: 'cursors/arrow.png', hotspot: [1, 1] },
          contextual: {
            asset: 'cursors/contextual.png',
            hotspot: [1, 1],
            fallback: 'context-menu',
          },
        },
      });
      expect(t.cursors?.arrow).toEqual({ asset: 'cursors/arrow.png', hotspot: [1, 1] });
      expect(t.cursors?.contextual).toEqual({
        asset: 'cursors/contextual.png',
        hotspot: [1, 1],
        fallback: 'context-menu',
      });
    });

    it('requires asset', () => {
      expect(() =>
        parseTheme({
          version: '0.1',
          cursors: { arrow: { hotspot: [1, 1] } },
        }),
      ).toThrow(/theme\.json\.cursors\.arrow\.asset/);
    });

    it('requires hotspot as [x, y] tuple', () => {
      expect(() =>
        parseTheme({
          version: '0.1',
          cursors: { arrow: { asset: 'a.png', hotspot: [1] } },
        }),
      ).toThrow(/theme\.json\.cursors\.arrow\.hotspot/);
    });
  });
});
