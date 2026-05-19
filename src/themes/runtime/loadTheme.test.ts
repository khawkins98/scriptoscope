import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { loadTheme, resolveAssetUrls } from './loadTheme.js';
import { themeRegistry } from './ThemeRegistry.js';
import { THEME_SCHEMA_VERSION, type Theme } from '../schema/types.js';

// Shape of a minimal canonical bundle (smaller than the real ones, covers
// every URL-rewriting code path).
const FIXTURE_THEME = {
  version: '0.1',
  name: 'test bundle',
  palette: {
    bg: '#cccccc',
    fg: '#000000',
  },
  chromeElements: {
    button: { asset: 'cicns/cicn-n10157-button.png', width: 100, height: 18 },
    'progress-fill': { asset: 'cicns/cicn-n10079-progress-fill.png', tile: 'horizontal' },
  },
  patterns: {
    pinstripe: { asset: 'ppats/ppat-n129-pinstripe.png', repeat: 'both' },
  },
  windowTypes: {
    document: {
      chrome: {
        active: 'cicns/cicn-n14335-active-document-window.png',
        inactive: 'cicns/cicn-n14336-inactive-document-window.png',
      },
      parts: { 'part-1': { rect: [9, 5, 20, 16] } },
    },
  },
};

describe('loadTheme', () => {
  beforeEach(() => {
    themeRegistry.reset();
  });

  afterEach(() => {
    themeRegistry.reset();
    vi.restoreAllMocks();
  });

  it('fetches /theme.json under the bundle URL, validates, applies, returns Theme', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve(FIXTURE_THEME),
    });
    vi.stubGlobal('fetch', fetchMock);

    const theme = await loadTheme('http://localhost:5173/themes/test-bundle');

    expect(fetchMock).toHaveBeenCalledWith('http://localhost:5173/themes/test-bundle/theme.json');
    expect(theme.version).toBe(THEME_SCHEMA_VERSION);
    expect(theme.name).toBe('test bundle');
    expect(themeRegistry.current()).toBe(theme);
  });

  it('appends a trailing slash to the bundle URL if absent', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve(FIXTURE_THEME),
    });
    vi.stubGlobal('fetch', fetchMock);

    await loadTheme('http://localhost/themes/test-bundle'); // no trailing /
    expect(fetchMock.mock.calls[0]?.[0]).toBe('http://localhost/themes/test-bundle/theme.json');
  });

  it('applies the palette to :root via ThemeRegistry', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true, status: 200, json: () => Promise.resolve(FIXTURE_THEME),
    }));
    await loadTheme('http://localhost/bundle');
    expect(document.documentElement.style.getPropertyValue('--aaron-colr-bg')).toBe('#cccccc');
    expect(document.documentElement.style.getPropertyValue('--aaron-colr-fg')).toBe('#000000');
  });

  it('resolves all asset URLs to absolute paths', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true, status: 200, json: () => Promise.resolve(FIXTURE_THEME),
    }));
    const theme = await loadTheme('http://localhost/themes/test-bundle');

    expect(theme.chromeElements?.['button']?.asset).toBe(
      'http://localhost/themes/test-bundle/cicns/cicn-n10157-button.png',
    );
    expect(theme.patterns?.['pinstripe']?.asset).toBe(
      'http://localhost/themes/test-bundle/ppats/ppat-n129-pinstripe.png',
    );
    expect(theme.windowTypes?.['document']?.chrome.active).toBe(
      'http://localhost/themes/test-bundle/cicns/cicn-n14335-active-document-window.png',
    );
    expect(theme.windowTypes?.['document']?.chrome.inactive).toBe(
      'http://localhost/themes/test-bundle/cicns/cicn-n14336-inactive-document-window.png',
    );
  });

  it('throws on HTTP error', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false, status: 404, statusText: 'Not Found',
    }));
    await expect(loadTheme('http://localhost/missing')).rejects.toThrow(/404 Not Found/);
  });

  it('throws on schema violation (propagates ThemeValidationError)', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true, status: 200, json: () => Promise.resolve({ version: '0.2' }),
    }));
    await expect(loadTheme('http://localhost/bad')).rejects.toThrow(/expected version "0.1"/);
  });

  it('loading a second theme cleanly replaces the first', async () => {
    const themeA = { ...FIXTURE_THEME, palette: { bg: '#aaaaaa', uniqueToA: '#ff0000' } };
    const themeB = { ...FIXTURE_THEME, palette: { bg: '#bbbbbb', uniqueToB: '#00ff00' } };

    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce({ ok: true, status: 200, json: () => Promise.resolve(themeA) })
      .mockResolvedValueOnce({ ok: true, status: 200, json: () => Promise.resolve(themeB) }),
    );

    await loadTheme('http://localhost/a');
    expect(document.documentElement.style.getPropertyValue('--aaron-colr-uniqueToA')).toBe('#ff0000');

    await loadTheme('http://localhost/b');
    expect(document.documentElement.style.getPropertyValue('--aaron-colr-uniqueToA')).toBe('');
    expect(document.documentElement.style.getPropertyValue('--aaron-colr-uniqueToB')).toBe('#00ff00');
    expect(document.documentElement.style.getPropertyValue('--aaron-colr-bg')).toBe('#bbbbbb');
  });
});

describe('resolveAssetUrls (pure)', () => {
  it('preserves themes without asset sections', () => {
    const t: Theme = { version: THEME_SCHEMA_VERSION, name: 'bare' };
    const out = resolveAssetUrls(t, 'http://localhost/bundle/theme.json');
    expect(out).toEqual(t);
  });

  it('resolves chromeElements asset paths', () => {
    const t: Theme = {
      version: THEME_SCHEMA_VERSION,
      chromeElements: {
        a: { asset: 'cicns/a.png' },
        b: { asset: 'cicns/b.png', width: 10, height: 10 },
      },
    };
    const out = resolveAssetUrls(t, 'http://example.com/themes/foo/theme.json');
    expect(out.chromeElements?.['a']?.asset).toBe('http://example.com/themes/foo/cicns/a.png');
    expect(out.chromeElements?.['b']?.asset).toBe('http://example.com/themes/foo/cicns/b.png');
    // Other fields preserved.
    expect(out.chromeElements?.['b']?.width).toBe(10);
  });

  it('handles asset paths that escape the bundle root', () => {
    // Allowed but unusual — e.g. shared assets in a sibling dir.
    const t: Theme = {
      version: THEME_SCHEMA_VERSION,
      chromeElements: { x: { asset: '../shared/icon.png' } },
    };
    const out = resolveAssetUrls(t, 'http://example.com/themes/foo/theme.json');
    expect(out.chromeElements?.['x']?.asset).toBe('http://example.com/themes/shared/icon.png');
  });

  it('handles already-absolute asset URLs (passes through)', () => {
    const t: Theme = {
      version: THEME_SCHEMA_VERSION,
      chromeElements: { x: { asset: 'https://cdn.example.com/asset.png' } },
    };
    const out = resolveAssetUrls(t, 'http://example.com/themes/foo/theme.json');
    expect(out.chromeElements?.['x']?.asset).toBe('https://cdn.example.com/asset.png');
  });

  it('resolves windowTypes.chrome state URLs', () => {
    const t: Theme = {
      version: THEME_SCHEMA_VERSION,
      windowTypes: {
        document: {
          chrome: {
            active: 'cicns/active.png',
            inactive: 'cicns/inactive.png',
            'collapsed-active': 'cicns/collapsed-active.png',
          },
        },
      },
    };
    const out = resolveAssetUrls(t, 'http://localhost/bundle/theme.json');
    expect(out.windowTypes?.['document']?.chrome.active).toBe('http://localhost/bundle/cicns/active.png');
    expect(out.windowTypes?.['document']?.chrome.inactive).toBe('http://localhost/bundle/cicns/inactive.png');
    expect(out.windowTypes?.['document']?.chrome['collapsed-active']).toBe(
      'http://localhost/bundle/cicns/collapsed-active.png',
    );
    // collapsed-inactive was absent — stays absent.
    expect(out.windowTypes?.['document']?.chrome['collapsed-inactive']).toBeUndefined();
  });

  it('resolves cursors asset paths', () => {
    const t: Theme = {
      version: THEME_SCHEMA_VERSION,
      cursors: {
        arrow: { asset: 'cursors/arrow.png', hotspot: [1, 1] },
        contextual: {
          asset: 'cursors/contextual.png',
          hotspot: [1, 1],
          fallback: 'context-menu',
        },
      },
    };
    const out = resolveAssetUrls(t, 'http://localhost/bundle/theme.json');
    expect(out.cursors?.['arrow']?.asset).toBe('http://localhost/bundle/cursors/arrow.png');
    expect(out.cursors?.['arrow']?.hotspot).toEqual([1, 1]);
    expect(out.cursors?.['contextual']?.fallback).toBe('context-menu');
  });
});
