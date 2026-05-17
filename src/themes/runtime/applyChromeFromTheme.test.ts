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
        'part-1': { rect: [9, 5, 20, 16] },
        'part-2': { rect: [36, 5, 48, 16] },
      },
    },
  },
  chromeElements: {
    'active-document-window': {
      asset: 'cicns/active.png',
      width: 74,
      height: 25,
      slice: { corner: 4, side: 4, tile: false },
    },
    'inactive-document-window': {
      asset: 'cicns/inactive.png',
      width: 74,
      height: 25,
      slice: { corner: 4, side: 4, tile: false },
    },
    'collapsed-active-document-window': {
      asset: 'cicns/collapsed-active.png',
      width: 74,
      height: 18,
    },
  },
};

describe('applyChromeFromTheme', () => {
  describe('chrome-element application', () => {
    it('writes background-image with the chrome cicn URL', () => {
      applyChromeFromTheme(windowEl, fullTheme);
      const titlebar = windowEl.querySelector('.aaron-titlebar') as HTMLElement;
      expect(titlebar.style.backgroundImage).toBe('url("cicns/active.png")');
    });

    it('writes cinf border-image when the chromeElement has slice data', () => {
      applyChromeFromTheme(windowEl, fullTheme);
      const titlebar = windowEl.querySelector('.aaron-titlebar') as HTMLElement;
      expect(titlebar.style.borderImageSource).toBe('url("cicns/active.png")');
      expect(titlebar.style.borderImageWidth).toBe('4px');
    });

    it('stretches the titlebar bg via background-size 100% when chrome has no cinf', () => {
      // Real window-type chrome cicns don't get cinf paired by the extractor.
      // Without this fix, the chrome bitmap renders at native size in the
      // top-left of the titlebar (the "small tab" bug from the gh-pages
      // visual cut-through, 2026-05-17).
      const noSliceTheme: Theme = {
        version: THEME_SCHEMA_VERSION,
        windowTypes: {
          'document-window': {
            chrome: { active: 'cicns/window.png' },
          },
        },
        chromeElements: {
          'active-window': {
            asset: 'cicns/window.png',
            width: 74, height: 25, // native cicn dims — without the fix,
            // these would force background-size to 74px 25px.
          },
        },
      };
      applyChromeFromTheme(windowEl, noSliceTheme);
      const titlebar = windowEl.querySelector('.aaron-titlebar') as HTMLElement;
      expect(titlebar.style.backgroundSize).toBe('100% 100%');
      expect(titlebar.style.backgroundImage).toBe('url("cicns/window.png")');
    });
  });

  describe('state derivation from DOM data-state', () => {
    it('picks active chrome when data-state="active"', () => {
      applyChromeFromTheme(windowEl, fullTheme);
      const titlebar = windowEl.querySelector('.aaron-titlebar') as HTMLElement;
      expect(titlebar.style.backgroundImage).toBe('url("cicns/active.png")');
    });

    it('picks inactive chrome when data-state="inactive"', () => {
      windowEl.setAttribute('data-state', 'inactive');
      applyChromeFromTheme(windowEl, fullTheme);
      const titlebar = windowEl.querySelector('.aaron-titlebar') as HTMLElement;
      expect(titlebar.style.backgroundImage).toBe('url("cicns/inactive.png")');
    });

    it('picks collapsed-active when data-state="collapsed" and scheme provides it', () => {
      windowEl.setAttribute('data-state', 'collapsed');
      const result = applyChromeFromTheme(windowEl, fullTheme);
      expect(result.state).toBe('collapsed-active');
      const titlebar = windowEl.querySelector('.aaron-titlebar') as HTMLElement;
      expect(titlebar.style.backgroundImage).toBe('url("cicns/collapsed-active.png")');
    });

    it('falls back to active when collapsed-* states are absent', () => {
      const minimalTheme: Theme = {
        version: THEME_SCHEMA_VERSION,
        windowTypes: {
          'document-window': {
            chrome: { active: 'cicns/a.png', inactive: 'cicns/i.png' },
          },
        },
      };
      windowEl.setAttribute('data-state', 'collapsed');
      const result = applyChromeFromTheme(windowEl, minimalTheme);
      expect(result.state).toBe('active');
    });
  });

  describe('wnd# part overlays', () => {
    it('mounts one div per part inside the titlebar', () => {
      applyChromeFromTheme(windowEl, fullTheme);
      const titlebar = windowEl.querySelector('.aaron-titlebar') as HTMLElement;
      const parts = titlebar.querySelectorAll('[data-aaron-window-part]');
      expect(parts).toHaveLength(2);
    });

    it('returns the WindowPartInfo array for caller listener wiring', () => {
      const result = applyChromeFromTheme(windowEl, fullTheme);
      expect(result.parts).toHaveLength(2);
      expect(result.parts.map(p => p.partSlug)).toEqual(['part-1', 'part-2']);
    });

    it('skips parts when chromeElement has no width/height and titlebar is unrendered', () => {
      // No cicn dimensions, no rendered width → parts skipped (returns []).
      const noSizeTheme: Theme = {
        version: THEME_SCHEMA_VERSION,
        windowTypes: {
          'document-window': {
            chrome: { active: 'cicns/a.png' },
            parts: { 'part-1': { rect: [0, 0, 10, 10] } },
          },
        },
      };
      const result = applyChromeFromTheme(windowEl, noSizeTheme);
      expect(result.parts).toEqual([]);
    });
  });

  describe('windowType selection', () => {
    it('defaults to "document-window"', () => {
      const result = applyChromeFromTheme(windowEl, fullTheme);
      expect(result.windowTypeSlug).toBe('document-window');
    });

    it('falls back to the first windowType when default is missing', () => {
      const altTheme: Theme = {
        version: THEME_SCHEMA_VERSION,
        windowTypes: {
          'modal-dialog': {
            chrome: { active: 'cicns/modal.png' },
          },
        },
      };
      const result = applyChromeFromTheme(windowEl, altTheme);
      expect(result.windowTypeSlug).toBe('modal-dialog');
    });

    it('honours an explicit windowTypeSlug option', () => {
      const multiTheme: Theme = {
        version: THEME_SCHEMA_VERSION,
        windowTypes: {
          'document-window': { chrome: { active: 'cicns/doc.png' } },
          'modal-dialog': { chrome: { active: 'cicns/modal.png' } },
        },
      };
      const result = applyChromeFromTheme(windowEl, multiTheme, {
        windowTypeSlug: 'modal-dialog',
      });
      expect(result.windowTypeSlug).toBe('modal-dialog');
    });
  });

  describe('idempotency on re-apply', () => {
    it('replaces prior chrome cleanly on re-apply', () => {
      applyChromeFromTheme(windowEl, fullTheme);
      const firstBg = (windowEl.querySelector('.aaron-titlebar') as HTMLElement).style.backgroundImage;

      // Swap to inactive state.
      windowEl.setAttribute('data-state', 'inactive');
      applyChromeFromTheme(windowEl, fullTheme);
      const secondBg = (windowEl.querySelector('.aaron-titlebar') as HTMLElement).style.backgroundImage;

      expect(firstBg).not.toBe(secondBg);
      // Still only one set of parts (re-applied, not duplicated).
      const parts = windowEl.querySelectorAll('[data-aaron-window-part]');
      expect(parts).toHaveLength(2);
    });
  });

  describe('error cases', () => {
    it('throws when windowEl has no .aaron-titlebar child', () => {
      const bareWindow = document.createElement('div');
      expect(() => applyChromeFromTheme(bareWindow, fullTheme)).toThrow(
        /no \.aaron-titlebar/,
      );
    });

    it('throws when theme has no windowTypes at all', () => {
      const emptyTheme: Theme = { version: THEME_SCHEMA_VERSION };
      expect(() => applyChromeFromTheme(windowEl, emptyTheme)).toThrow(
        /no windowTypes/,
      );
    });

    it('throws when the resolved state has no cicn URL', () => {
      const partialTheme: Theme = {
        version: THEME_SCHEMA_VERSION,
        windowTypes: {
          'document-window': {
            chrome: { inactive: 'cicns/i.png' }, // no active
          },
        },
      };
      expect(() => applyChromeFromTheme(windowEl, partialTheme)).toThrow(
        /chrome\["active"\] is undefined/,
      );
    });
  });
});

describe('clearChromeFromTheme', () => {
  it('removes chrome styles + part overlays', () => {
    applyChromeFromTheme(windowEl, fullTheme);
    expect(windowEl.querySelectorAll('[data-aaron-window-part]')).toHaveLength(2);

    clearChromeFromTheme(windowEl);
    expect(windowEl.querySelectorAll('[data-aaron-window-part]')).toHaveLength(0);
    const titlebar = windowEl.querySelector('.aaron-titlebar') as HTMLElement;
    expect(titlebar.style.backgroundImage).toBe('');
  });

  it('is idempotent on an un-themed window', () => {
    expect(() => clearChromeFromTheme(windowEl)).not.toThrow();
  });

  it('is a no-op when windowEl has no titlebar', () => {
    const bare = document.createElement('div');
    expect(() => clearChromeFromTheme(bare)).not.toThrow();
  });
});
