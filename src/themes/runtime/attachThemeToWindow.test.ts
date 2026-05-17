import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { attachThemeToWindow } from './attachThemeToWindow.js';
import { themeRegistry } from './ThemeRegistry.js';
import { THEME_SCHEMA_VERSION, type Theme } from '../schema/types.js';

const theme: Theme = {
  version: THEME_SCHEMA_VERSION,
  windowTypes: {
    'document-window': {
      chrome: { active: 'cicns/a.png', inactive: 'cicns/i.png' },
    },
  },
  chromeElements: {
    'active-document-window': {
      asset: 'cicns/a.png',
      width: 74, height: 25,
      slice: { corner: 4, side: 4, tile: false },
    },
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

describe('attachThemeToWindow', () => {
  beforeEach(() => themeRegistry.reset());
  afterEach(() => themeRegistry.reset());

  it('applies the current theme immediately on attach', () => {
    themeRegistry.replace(theme);
    const w = makeWindow();
    attachThemeToWindow(w);
    const tb = w.querySelector('.aaron-titlebar') as HTMLElement;
    expect(tb.style.backgroundImage).toBe('url("cicns/a.png")');
  });

  it('re-applies on theme change', () => {
    const w = makeWindow();
    attachThemeToWindow(w);

    themeRegistry.replace(theme);
    let tb = w.querySelector('.aaron-titlebar') as HTMLElement;
    expect(tb.style.backgroundImage).toBe('url("cicns/a.png")');

    // Swap to a new theme with a different URL.
    const theme2: Theme = {
      ...theme,
      windowTypes: {
        'document-window': {
          chrome: { active: 'cicns/other.png' },
        },
      },
      chromeElements: {
        'active-other': { asset: 'cicns/other.png', width: 74, height: 25 },
      },
    };
    themeRegistry.replace(theme2);
    tb = w.querySelector('.aaron-titlebar') as HTMLElement;
    expect(tb.style.backgroundImage).toBe('url("cicns/other.png")');
  });

  it('clears the chrome when replaced with null', () => {
    themeRegistry.replace(theme);
    const w = makeWindow();
    attachThemeToWindow(w);
    themeRegistry.replace(null);
    const tb = w.querySelector('.aaron-titlebar') as HTMLElement;
    expect(tb.style.backgroundImage).toBe('');
  });

  it('teardown unsubscribes and clears the chrome', () => {
    themeRegistry.replace(theme);
    const w = makeWindow();
    const detach = attachThemeToWindow(w);
    detach();
    let tb = w.querySelector('.aaron-titlebar') as HTMLElement;
    expect(tb.style.backgroundImage).toBe('');
    // Further theme changes don't reach this window.
    themeRegistry.replace(theme);
    tb = w.querySelector('.aaron-titlebar') as HTMLElement;
    expect(tb.style.backgroundImage).toBe('');
  });

  it('applyOnAttach: false skips initial apply', () => {
    themeRegistry.replace(theme);
    const w = makeWindow();
    attachThemeToWindow(w, { applyOnAttach: false });
    const tb = w.querySelector('.aaron-titlebar') as HTMLElement;
    expect(tb.style.backgroundImage).toBe('');
  });

  it('swallows applyChromeFromTheme errors (clears chrome instead)', () => {
    // Theme has no windowTypes — applyChromeFromTheme would throw. attach
    // catches and clears rather than crashing the subscription chain.
    const badTheme: Theme = { version: THEME_SCHEMA_VERSION };
    themeRegistry.replace(badTheme);
    const w = makeWindow();
    expect(() => attachThemeToWindow(w)).not.toThrow();
  });
});
