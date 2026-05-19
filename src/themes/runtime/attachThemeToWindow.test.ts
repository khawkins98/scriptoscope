import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { attachThemeToWindow } from './attachThemeToWindow.js';
import { themeRegistry } from './ThemeRegistry.js';
import { THEME_SCHEMA_VERSION, type Theme } from '../schema/types.js';

const theme: Theme = {
  version: THEME_SCHEMA_VERSION,
  windowTypes: {
    'document-window': {
      chrome: { active: 'cicns/a.png', inactive: 'cicns/i.png' },
      parts: { 'part-0': { rect: [1, 22, 72, 23] } },
      // Edge with a non-part-0 segment so the composer actually renders.
      // (part-0 is the K2 null marker — don't draw.)
      edges: {
        top: [{ at: 0, part: 'part-0' }, { at: 1, part: 'part-8' }, { at: 73, part: 'part-0' }],
        bottom: [{ at: 0, part: 'part-8' }],
        left: [{ at: 0, part: 'part-8' }],
        right: [{ at: 0, part: 'part-8' }],
      },
    },
  },
  chromeElements: {
    'active-document-window': { asset: 'cicns/a.png', width: 74, height: 25 },
  },
};

function makeWindow(): HTMLElement {
  const w = document.createElement('div');
  w.className = 'aaron-window';
  w.setAttribute('data-state', 'active');
  const tb = document.createElement('div');
  tb.className = 'aaron-titlebar';
  w.appendChild(tb);
  return w;
}

function firstSegmentBg(w: HTMLElement): string {
  const seg = w.querySelector('[data-aaron-chrome-edge="top"] > div') as HTMLElement | null;
  return seg?.style.borderImageSource ?? '';
}

describe('attachThemeToWindow', () => {
  beforeEach(() => themeRegistry.reset());
  afterEach(() => themeRegistry.reset());

  it('applies the current theme immediately on attach', () => {
    themeRegistry.replace(theme);
    const w = makeWindow();
    attachThemeToWindow(w);
    expect(firstSegmentBg(w)).toBe('url("cicns/a.png")');
  });

  it('re-applies on theme change', () => {
    const w = makeWindow();
    attachThemeToWindow(w);

    themeRegistry.replace(theme);
    expect(firstSegmentBg(w)).toBe('url("cicns/a.png")');

    const theme2: Theme = {
      ...theme,
      windowTypes: {
        'document-window': {
          chrome: { active: 'cicns/other.png' },
          parts: { 'part-0': { rect: [1, 22, 72, 23] } },
          edges: { top: [{ at: 0, part: 'part-8' }, { at: 73, part: 'part-0' }] },
        },
      },
      chromeElements: {
        'active-other': { asset: 'cicns/other.png', width: 74, height: 25 },
      },
    };
    themeRegistry.replace(theme2);
    expect(firstSegmentBg(w)).toBe('url("cicns/other.png")');
  });

  it('clears the chrome when replaced with null', () => {
    themeRegistry.replace(theme);
    const w = makeWindow();
    attachThemeToWindow(w);
    themeRegistry.replace(null);
    expect(w.querySelectorAll('[data-aaron-chrome-edge]').length).toBe(0);
  });

  it('teardown unsubscribes and clears the chrome', () => {
    themeRegistry.replace(theme);
    const w = makeWindow();
    const detach = attachThemeToWindow(w);
    detach();
    expect(w.querySelectorAll('[data-aaron-chrome-edge]').length).toBe(0);
    // Further theme changes don't reach this window.
    themeRegistry.replace(theme);
    expect(w.querySelectorAll('[data-aaron-chrome-edge]').length).toBe(0);
  });

  it('applyOnAttach: false skips initial apply', () => {
    themeRegistry.replace(theme);
    const w = makeWindow();
    attachThemeToWindow(w, { applyOnAttach: false });
    expect(w.querySelectorAll('[data-aaron-chrome-edge]').length).toBe(0);
  });

  it('swallows applyChromeFromTheme errors (clears chrome instead)', () => {
    // Theme has no windowTypes — applyChromeFromTheme would throw. attach
    // catches and clears rather than crashing the subscription chain.
    const badTheme: Theme = { version: THEME_SCHEMA_VERSION };
    themeRegistry.replace(badTheme);
    const w = makeWindow();
    expect(() => attachThemeToWindow(w)).not.toThrow();
    expect(w.querySelectorAll('[data-aaron-chrome-edge]').length).toBe(0);
  });
});
