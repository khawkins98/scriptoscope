import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { attachThemeToStretched } from './attachThemeToStretched.js';
import { themeRegistry } from './ThemeRegistry.js';
import { THEME_SCHEMA_VERSION, type Theme } from '../schema/types.js';

function makeEl(): HTMLDivElement {
  const el = document.createElement('div');
  el.setAttribute('data-state', 'normal');
  return el;
}

const themeWithArtwork: Theme = {
  version: THEME_SCHEMA_VERSION,
  chromeElements: {
    'placard-thing': { asset: 'cicns/placard-active.png', width: 60, height: 16 },
    'pressed-placard': { asset: 'cicns/placard-pressed.png', width: 60, height: 16 },
    'inactive-placard': { asset: 'cicns/placard-inactive.png', width: 60, height: 16 },
    'finder-header-active': { asset: 'cicns/header-active.png', width: 300, height: 24 },
    'finder-header-inactive': { asset: 'cicns/header-inactive.png', width: 300, height: 24 },
  },
};

const themeWithoutArtwork: Theme = {
  version: THEME_SCHEMA_VERSION,
  chromeElements: {
    'window-active': { asset: 'cicns/window.png', width: 74, height: 25 },
  },
};

describe('attachThemeToStretched', () => {
  beforeEach(() => themeRegistry.reset());
  afterEach(() => themeRegistry.reset());

  it('paints the active slug when state is normal', () => {
    themeRegistry.replace(themeWithArtwork);
    const el = makeEl();
    attachThemeToStretched({
      element: el,
      slugs: { active: 'placard-thing', pressed: 'pressed-placard', inactive: 'inactive-placard' },
    });
    expect(el.style.backgroundImage).toBe('url("cicns/placard-active.png")');
    expect(el.style.backgroundSize).toBe('100% 100%');
    expect(el.getAttribute('data-aaron-cicn-loaded')).toBe('');
  });

  it('swaps to pressed cicn when data-state changes', async () => {
    themeRegistry.replace(themeWithArtwork);
    const el = makeEl();
    attachThemeToStretched({
      element: el,
      slugs: { active: 'placard-thing', pressed: 'pressed-placard', inactive: 'inactive-placard' },
    });
    el.setAttribute('data-state', 'pressed');
    await Promise.resolve();
    await new Promise((r) => setTimeout(r, 0));
    expect(el.style.backgroundImage).toBe('url("cicns/placard-pressed.png")');
  });

  it('swaps to inactive cicn when aria-disabled flips', async () => {
    themeRegistry.replace(themeWithArtwork);
    const el = makeEl();
    attachThemeToStretched({
      element: el,
      slugs: { active: 'placard-thing', inactive: 'inactive-placard' },
    });
    el.setAttribute('aria-disabled', 'true');
    await new Promise((r) => setTimeout(r, 0));
    expect(el.style.backgroundImage).toBe('url("cicns/placard-inactive.png")');
  });

  it('falls back to active slug when state-specific slug is missing', () => {
    themeRegistry.replace(themeWithArtwork);
    const el = makeEl();
    el.setAttribute('data-state', 'pressed');
    // No 'pressed' slug in this map
    attachThemeToStretched({
      element: el,
      slugs: { active: 'placard-thing' },
    });
    expect(el.style.backgroundImage).toBe('url("cicns/placard-active.png")');
  });

  it('clears chrome when theme has no matching cicns', () => {
    themeRegistry.replace(themeWithoutArtwork);
    const el = makeEl();
    attachThemeToStretched({
      element: el,
      slugs: { active: 'placard-thing' },
    });
    expect(el.style.backgroundImage).toBe('');
    expect(el.hasAttribute('data-aaron-cicn-loaded')).toBe(false);
  });

  it('clears chrome when no theme is loaded', () => {
    const el = makeEl();
    attachThemeToStretched({ element: el, slugs: { active: 'placard-thing' } });
    expect(el.style.backgroundImage).toBe('');
  });

  it('respects custom readState callback', () => {
    themeRegistry.replace(themeWithArtwork);
    const el = makeEl();
    attachThemeToStretched({
      element: el,
      slugs: { active: 'finder-header-active', inactive: 'finder-header-inactive' },
      readState: () => 'inactive',
    });
    expect(el.style.backgroundImage).toBe('url("cicns/header-inactive.png")');
  });

  it('teardown clears chrome + unsubscribes', () => {
    themeRegistry.replace(themeWithArtwork);
    const el = makeEl();
    const detach = attachThemeToStretched({
      element: el,
      slugs: { active: 'placard-thing' },
    });
    expect(el.style.backgroundImage).toBe('url("cicns/placard-active.png")');
    detach();
    expect(el.style.backgroundImage).toBe('');
    themeRegistry.replace(themeWithoutArtwork);
    expect(el.style.backgroundImage).toBe('');
  });
});
