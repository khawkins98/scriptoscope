import { beforeEach, describe, expect, it } from 'vitest';
import {
  applyChromeFromTheme,
  clearChromeFromTheme,
} from './applyChromeFromTheme.js';
import { THEME_SCHEMA_VERSION, type Theme } from '../schema/types.js';

let windowEl: HTMLElement;

beforeEach(() => {
  windowEl = document.createElement('div');
  windowEl.className = 'aaron-window';
  windowEl.setAttribute('data-state', 'active');
  const titlebar = document.createElement('div');
  titlebar.className = 'aaron-titlebar';
  windowEl.appendChild(titlebar);
});

// Test theme follows the K2-faithful contract: windowType has a part-0
// body rect (the composer requires it) AND a top recipe (drives the
// per-segment composition). 7 Le-shaped.
const fullTheme: Theme = {
  version: THEME_SCHEMA_VERSION,
  windowTypes: {
    'document-window': {
      chrome: {
        active: 'cicns/active.png',
        inactive: 'cicns/inactive.png',
        'collapsed-active': 'cicns/collapsed-active.png',
        'collapsed-inactive': 'cicns/collapsed-inactive.png',
      },
      parts: {
        'part-0': { rect: [1, 22, 72, 23] },
        'part-1': { rect: [9, 5, 20, 16] },
        'part-2': { rect: [36, 5, 48, 16] },
      },
      edges: {
        top: [{ at: 0, part: 'part-0' }, { at: 5, part: 'part-1' }, { at: 21, part: 'part-2' }, { at: 33, part: 'part-1' }],
        bottom: [{ at: 0, part: 'part-0' }, { at: 73, part: 'part-1' }],
        left: [{ at: 0, part: 'part-0' }],
        right: [{ at: 0, part: 'part-0' }],
      },
    },
  },
  chromeElements: {
    'active': { asset: 'cicns/active.png', width: 74, height: 25 },
    'inactive': { asset: 'cicns/inactive.png', width: 74, height: 25 },
    'collapsed-active': { asset: 'cicns/collapsed-active.png', width: 74, height: 18 },
  },
};

describe('applyChromeFromTheme', () => {
  describe('chrome application via composeKaleidoscopeChrome', () => {
    it('mounts edge strips on the window root', () => {
      applyChromeFromTheme(windowEl, fullTheme);
      const strips = windowEl.querySelectorAll('[data-aaron-chrome-edge]');
      expect(strips.length).toBeGreaterThan(0);
    });

    it('first top-edge segment writes borderImageSource referencing the cicn', () => {
      applyChromeFromTheme(windowEl, fullTheme);
      const seg = windowEl.querySelector('[data-aaron-chrome-edge="top"] > div') as HTMLElement | null;
      expect(seg?.style.borderImageSource).toBe('url("cicns/active.png")');
    });

    it('applies body-rect-derived padding to the window root', () => {
      applyChromeFromTheme(windowEl, fullTheme);
      // body rect [1, 22, 72, 23] in 74×25 cicn → 22/2/2/1 (top/right/bottom/left)
      expect(windowEl.style.paddingTop).toBe('22px');
      expect(windowEl.style.paddingRight).toBe('2px');
      expect(windowEl.style.paddingBottom).toBe('2px');
      expect(windowEl.style.paddingLeft).toBe('1px');
    });

    it('uses border-image-repeat: stretch per K2 Speed Note', () => {
      applyChromeFromTheme(windowEl, fullTheme);
      const seg = windowEl.querySelector('[data-aaron-chrome-edge="top"] > div') as HTMLElement | null;
      expect(seg?.style.borderImageRepeat).toBe('stretch');
    });

    it('stamps frame-thickness custom properties', () => {
      applyChromeFromTheme(windowEl, fullTheme);
      expect(windowEl.style.getPropertyValue('--aaron-frame-top-px')).toBe('22px');
      expect(windowEl.style.getPropertyValue('--aaron-frame-left-px')).toBe('1px');
    });

    it('no-ops cleanly when windowType has no part-0 body rect', () => {
      const noBodyTheme: Theme = {
        version: THEME_SCHEMA_VERSION,
        windowTypes: {
          'document-window': {
            chrome: { active: 'cicns/window.png' },
            parts: { 'part-1': { rect: [9, 5, 20, 16] } },
            edges: { top: [{ at: 0, part: 'part-1' }] },
          },
        },
        chromeElements: {
          'win': { asset: 'cicns/window.png', width: 74, height: 25 },
        },
      };
      applyChromeFromTheme(windowEl, noBodyTheme);
      expect(windowEl.querySelectorAll('[data-aaron-chrome-edge]').length).toBe(0);
    });
  });

  describe('state derivation from DOM data-state', () => {
    it('picks active chrome when data-state="active"', () => {
      windowEl.setAttribute('data-state', 'active');
      applyChromeFromTheme(windowEl, fullTheme);
      const seg = windowEl.querySelector('[data-aaron-chrome-edge="top"] > div') as HTMLElement | null;
      expect(seg?.style.borderImageSource).toBe('url("cicns/active.png")');
    });

    it('picks inactive chrome when data-state="inactive"', () => {
      windowEl.setAttribute('data-state', 'inactive');
      applyChromeFromTheme(windowEl, fullTheme);
      const seg = windowEl.querySelector('[data-aaron-chrome-edge="top"] > div') as HTMLElement | null;
      expect(seg?.style.borderImageSource).toBe('url("cicns/inactive.png")');
    });

    it('picks collapsed-active when data-state="collapsed" and scheme provides it', () => {
      windowEl.setAttribute('data-state', 'collapsed');
      applyChromeFromTheme(windowEl, fullTheme);
      const seg = windowEl.querySelector('[data-aaron-chrome-edge="top"] > div') as HTMLElement | null;
      expect(seg?.style.borderImageSource).toBe('url("cicns/collapsed-active.png")');
    });

    it('honors explicit state option override', () => {
      windowEl.setAttribute('data-state', 'active');
      applyChromeFromTheme(windowEl, fullTheme, { state: 'inactive' });
      const seg = windowEl.querySelector('[data-aaron-chrome-edge="top"] > div') as HTMLElement | null;
      expect(seg?.style.borderImageSource).toBe('url("cicns/inactive.png")');
    });
  });

  describe('idempotency on re-apply', () => {
    it('replaces prior chrome cleanly on re-apply', () => {
      applyChromeFromTheme(windowEl, fullTheme, { state: 'active' });
      let seg = windowEl.querySelector('[data-aaron-chrome-edge="top"] > div') as HTMLElement | null;
      expect(seg?.style.borderImageSource).toBe('url("cicns/active.png")');
      applyChromeFromTheme(windowEl, fullTheme, { state: 'inactive' });
      seg = windowEl.querySelector('[data-aaron-chrome-edge="top"] > div') as HTMLElement | null;
      expect(seg?.style.borderImageSource).toBe('url("cicns/inactive.png")');
    });
  });

  describe('clearChromeFromTheme', () => {
    it('removes all chrome from the window', () => {
      applyChromeFromTheme(windowEl, fullTheme);
      clearChromeFromTheme(windowEl);
      expect(windowEl.querySelectorAll('[data-aaron-chrome-edge]').length).toBe(0);
      expect(windowEl.style.paddingTop).toBe('');
      expect(windowEl.style.getPropertyValue('--aaron-frame-top-px')).toBe('');
    });
  });

  describe('error cases', () => {
    it('throws when windowEl has no titlebar', () => {
      const empty = document.createElement('div');
      expect(() => applyChromeFromTheme(empty, fullTheme)).toThrow(/no \.aaron-titlebar/);
    });

    it('throws when theme has no windowTypes at all', () => {
      const emptyTheme: Theme = { version: THEME_SCHEMA_VERSION };
      expect(() => applyChromeFromTheme(windowEl, emptyTheme)).toThrow(/no windowTypes/);
    });
  });

  describe('cinf.tileSides override (spec B §3.3)', () => {
    it('uses border-image-repeat: repeat when chromeElement.slice.tile is true', () => {
      const tileTheme: Theme = {
        ...fullTheme,
        chromeElements: {
          'active': {
            asset: 'cicns/active.png',
            width: 74,
            height: 25,
            slice: { corner: 0, side: 0, tile: true },
          },
          'inactive': { asset: 'cicns/inactive.png', width: 74, height: 25 },
        },
      };
      applyChromeFromTheme(windowEl, tileTheme);
      // The named-widget segments (part-1, part-2) stretch regardless;
      // find a fill segment to verify the tile override. Top edge has
      // recipe [part-0, part-1, part-2, part-1] — last entry's segment
      // is a fill (no terminator after it).
      const segs = Array.from(
        windowEl.querySelectorAll('[data-aaron-chrome-edge="top"] > div'),
      ) as HTMLElement[];
      // Pick a segment whose data-aaron-chrome-segment starts with "widget:" —
      // tile override applies even to those (the original cicn slice repeats).
      const widgetSeg = segs.find((s) => s.getAttribute('data-aaron-chrome-segment')?.startsWith('widget:'));
      expect(widgetSeg?.style.borderImageRepeat).toBe('repeat');
    });

    it('still stretches when slice.tile is false (or absent)', () => {
      applyChromeFromTheme(windowEl, fullTheme);
      const seg = windowEl.querySelector('[data-aaron-chrome-edge="top"] > div') as HTMLElement | null;
      expect(seg?.style.borderImageRepeat).toBe('stretch');
    });
  });

  describe('Colr-flag stamping (spec B §8 + spec A §20)', () => {
    it('stamps data attributes for enabled Colr flags', () => {
      const colrTheme: Theme = {
        ...fullTheme,
        options: {
          unifiedScrollbarTrack: true,
          windowsStyleScrollbars: true,
          stretchScrollbarThumbFromCenter: false,
          menuHighlightOverlay: true,
          extendedScrollbarArrows: false,
        },
      };
      applyChromeFromTheme(windowEl, colrTheme);
      expect(windowEl.getAttribute('data-aaron-scrollbar-style')).toBe('unified');
      expect(windowEl.getAttribute('data-aaron-scrollbar-layout')).toBe('paired');
      expect(windowEl.getAttribute('data-aaron-menu-overlay')).toBe('true');
      // Disabled flags do not get attributes
      expect(windowEl.hasAttribute('data-aaron-thumb-stretch')).toBe(false);
      expect(windowEl.hasAttribute('data-aaron-scrollbar-arrows')).toBe(false);
    });

    it('removes stale Colr-flag attributes when switching themes', () => {
      applyChromeFromTheme(windowEl, {
        ...fullTheme,
        options: { unifiedScrollbarTrack: true },
      });
      expect(windowEl.getAttribute('data-aaron-scrollbar-style')).toBe('unified');
      // Re-apply with no options → stale attribute should clear.
      applyChromeFromTheme(windowEl, fullTheme);
      expect(windowEl.hasAttribute('data-aaron-scrollbar-style')).toBe(false);
    });

    it('clearChromeFromTheme removes all Colr-flag attributes', () => {
      applyChromeFromTheme(windowEl, {
        ...fullTheme,
        options: { unifiedScrollbarTrack: true, menuHighlightOverlay: true },
      });
      clearChromeFromTheme(windowEl);
      expect(windowEl.hasAttribute('data-aaron-scrollbar-style')).toBe(false);
      expect(windowEl.hasAttribute('data-aaron-menu-overlay')).toBe(false);
    });
  });
});
