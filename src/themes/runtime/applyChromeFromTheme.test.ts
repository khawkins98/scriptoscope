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
// body rect (the composer requires it). 7 Le-shaped: 74×25 cicn with
// body rect [1, 22, 72, 23] giving thicknesses 22/2/2/1.
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
    it('writes borderImageSource on the window root', () => {
      applyChromeFromTheme(windowEl, fullTheme);
      expect(windowEl.style.borderImageSource).toBe('url("cicns/active.png")');
    });

    it('writes border widths derived from part-0 body rect', () => {
      applyChromeFromTheme(windowEl, fullTheme);
      // body rect [1, 22, 72, 23] in 74×25 cicn → 22/2/2/1 (top/right/bottom/left)
      expect(windowEl.style.borderTopWidth).toBe('22px');
      expect(windowEl.style.borderRightWidth).toBe('2px');
      expect(windowEl.style.borderBottomWidth).toBe('2px');
      expect(windowEl.style.borderLeftWidth).toBe('1px');
    });

    it('uses border-image-repeat: stretch per K2 Speed Note', () => {
      applyChromeFromTheme(windowEl, fullTheme);
      expect(windowEl.style.borderImageRepeat).toBe('stretch');
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
            parts: { 'part-1': { rect: [9, 5, 20, 16] } }, // no part-0
          },
        },
        chromeElements: {
          'win': { asset: 'cicns/window.png', width: 74, height: 25 },
        },
      };
      applyChromeFromTheme(windowEl, noBodyTheme);
      expect(windowEl.style.borderImageSource).toBe('');
    });
  });

  describe('state derivation from DOM data-state', () => {
    it('picks active chrome when data-state="active"', () => {
      windowEl.setAttribute('data-state', 'active');
      applyChromeFromTheme(windowEl, fullTheme);
      expect(windowEl.style.borderImageSource).toBe('url("cicns/active.png")');
    });

    it('picks inactive chrome when data-state="inactive"', () => {
      windowEl.setAttribute('data-state', 'inactive');
      applyChromeFromTheme(windowEl, fullTheme);
      expect(windowEl.style.borderImageSource).toBe('url("cicns/inactive.png")');
    });

    it('picks collapsed-active when data-state="collapsed" and scheme provides it', () => {
      windowEl.setAttribute('data-state', 'collapsed');
      applyChromeFromTheme(windowEl, fullTheme);
      expect(windowEl.style.borderImageSource).toBe('url("cicns/collapsed-active.png")');
    });

    it('honors explicit state option override', () => {
      windowEl.setAttribute('data-state', 'active');
      applyChromeFromTheme(windowEl, fullTheme, { state: 'inactive' });
      expect(windowEl.style.borderImageSource).toBe('url("cicns/inactive.png")');
    });
  });

  describe('idempotency on re-apply', () => {
    it('replaces prior chrome cleanly on re-apply', () => {
      applyChromeFromTheme(windowEl, fullTheme, { state: 'active' });
      expect(windowEl.style.borderImageSource).toBe('url("cicns/active.png")');
      applyChromeFromTheme(windowEl, fullTheme, { state: 'inactive' });
      expect(windowEl.style.borderImageSource).toBe('url("cicns/inactive.png")');
    });
  });

  describe('clearChromeFromTheme', () => {
    it('removes all inline chrome styles', () => {
      applyChromeFromTheme(windowEl, fullTheme);
      clearChromeFromTheme(windowEl);
      expect(windowEl.style.borderImageSource).toBe('');
      expect(windowEl.style.borderTopWidth).toBe('');
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
});
