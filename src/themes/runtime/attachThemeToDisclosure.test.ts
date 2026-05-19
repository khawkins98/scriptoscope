import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { attachThemeToDisclosure } from './attachThemeToDisclosure.js';
import { themeRegistry } from './ThemeRegistry.js';
import { THEME_SCHEMA_VERSION, type Theme } from '../schema/types.js';

function makeDisclosure(): { button: HTMLButtonElement; glyph: HTMLSpanElement } {
  const button = document.createElement('button');
  button.className = 'aaron-disclosure';
  button.setAttribute('data-state', 'normal');
  button.setAttribute('data-facing', 'right');
  const glyph = document.createElement('span');
  glyph.className = 'aaron-disclosure__glyph';
  button.appendChild(glyph);
  return { button, glyph };
}

const themeWithCicns: Theme = {
  version: THEME_SCHEMA_VERSION,
  chromeElements: {
    'right-pointing-disclosure-triangle': { asset: 'cicns/dt-right-active.png', width: 11, height: 11 },
    'pressed-right-pointing-disclosure-triangle': { asset: 'cicns/dt-right-pressed.png', width: 11, height: 11 },
    'inactive-right-pointing-disclosure-triangle': { asset: 'cicns/dt-right-inactive.png', width: 11, height: 11 },
    'down-pointing-disclosure-triangle': { asset: 'cicns/dt-down-active.png', width: 11, height: 11 },
    'pressed-down-pointing-disclosure-triangle': { asset: 'cicns/dt-down-pressed.png', width: 11, height: 11 },
    'inactive-down-pointing-disclosure-triangle': { asset: 'cicns/dt-down-inactive.png', width: 11, height: 11 },
  },
};

// The "tringle" typo variant — observed in 7 Le's extracted bundle.
const themeWithTypo: Theme = {
  version: THEME_SCHEMA_VERSION,
  chromeElements: {
    'right-pointing-disclosure-triangle': { asset: 'cicns/dt-right.png', width: 11, height: 11 },
    'inactive-right-pointing-disclosure-tringle': { asset: 'cicns/dt-right-inactive-typo.png', width: 11, height: 11 },
  },
};

const themeWithoutCicns: Theme = {
  version: THEME_SCHEMA_VERSION,
  chromeElements: {
    'window-active': { asset: 'cicns/window.png', width: 74, height: 25 },
  },
};

describe('attachThemeToDisclosure', () => {
  beforeEach(() => themeRegistry.reset());
  afterEach(() => themeRegistry.reset());

  it('paints right-active when facing=right + state=normal + enabled', () => {
    themeRegistry.replace(themeWithCicns);
    const { button, glyph } = makeDisclosure();
    attachThemeToDisclosure({ glyphEl: glyph, button });
    expect(glyph.style.backgroundImage).toBe('url("cicns/dt-right-active.png")');
    expect(glyph.getAttribute('data-aaron-cicn-loaded')).toBe('');
  });

  it('swaps to down-active when data-facing flips to down', () => {
    themeRegistry.replace(themeWithCicns);
    const { button, glyph } = makeDisclosure();
    attachThemeToDisclosure({ glyphEl: glyph, button });
    button.setAttribute('data-facing', 'down');
    return Promise.resolve().then(() => {
      expect(glyph.style.backgroundImage).toBe('url("cicns/dt-down-active.png")');
    });
  });

  it('swaps to pressed cicn when data-state=pressed', () => {
    themeRegistry.replace(themeWithCicns);
    const { button, glyph } = makeDisclosure();
    attachThemeToDisclosure({ glyphEl: glyph, button });
    button.setAttribute('data-state', 'pressed');
    return Promise.resolve().then(() => {
      expect(glyph.style.backgroundImage).toBe('url("cicns/dt-right-pressed.png")');
    });
  });

  it('swaps to inactive cicn when button is disabled', () => {
    themeRegistry.replace(themeWithCicns);
    const { button, glyph } = makeDisclosure();
    button.disabled = true;
    attachThemeToDisclosure({ glyphEl: glyph, button });
    expect(glyph.style.backgroundImage).toBe('url("cicns/dt-right-inactive.png")');
  });

  it('handles the "tringle" typo variant — uses it when correct spelling missing', () => {
    themeRegistry.replace(themeWithTypo);
    const { button, glyph } = makeDisclosure();
    button.disabled = true;
    attachThemeToDisclosure({ glyphEl: glyph, button });
    expect(glyph.style.backgroundImage).toBe('url("cicns/dt-right-inactive-typo.png")');
  });

  it('falls back to active cicn when state-specific is missing', () => {
    const partial: Theme = {
      version: THEME_SCHEMA_VERSION,
      chromeElements: {
        'right-pointing-disclosure-triangle': { asset: 'cicns/dt-right.png', width: 11, height: 11 },
      },
    };
    themeRegistry.replace(partial);
    const { button, glyph } = makeDisclosure();
    button.setAttribute('data-state', 'pressed');
    attachThemeToDisclosure({ glyphEl: glyph, button });
    expect(glyph.style.backgroundImage).toBe('url("cicns/dt-right.png")');
  });

  it('clears chrome when theme has no disclosure cicns', () => {
    themeRegistry.replace(themeWithoutCicns);
    const { button, glyph } = makeDisclosure();
    attachThemeToDisclosure({ glyphEl: glyph, button });
    expect(glyph.style.backgroundImage).toBe('');
    expect(glyph.hasAttribute('data-aaron-cicn-loaded')).toBe(false);
  });

  it('clears chrome when no theme is loaded', () => {
    const { button, glyph } = makeDisclosure();
    attachThemeToDisclosure({ glyphEl: glyph, button });
    expect(glyph.style.backgroundImage).toBe('');
  });

  it('teardown clears chrome + unsubscribes', () => {
    themeRegistry.replace(themeWithCicns);
    const { button, glyph } = makeDisclosure();
    const detach = attachThemeToDisclosure({ glyphEl: glyph, button });
    expect(glyph.style.backgroundImage).toBe('url("cicns/dt-right-active.png")');
    detach();
    expect(glyph.style.backgroundImage).toBe('');
    themeRegistry.replace(themeWithoutCicns);
    expect(glyph.style.backgroundImage).toBe('');
  });
});
