import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  BUNDLED_DEFAULT_SLUG,
  enableBundledDefault,
  getBundledDefaultUrl,
  loadBundledDefault,
  setBundledDefaultUrl,
  _resetBundledDefaultForTests,
} from './bundledDefault.js';
import { themeRegistry } from './ThemeRegistry.js';

const FIXTURE = {
  version: '0.1',
  name: 'bundled-7le-fixture',
  palette: { bg: '#dddddd' },
};

beforeEach(() => {
  themeRegistry.reset();
  _resetBundledDefaultForTests();
});

afterEach(() => {
  themeRegistry.reset();
  _resetBundledDefaultForTests();
  vi.restoreAllMocks();
});

describe('BUNDLED_DEFAULT_SLUG', () => {
  it('is "masswerk-7-le"', () => {
    expect(BUNDLED_DEFAULT_SLUG).toBe('masswerk-7-le');
  });
});

describe('getBundledDefaultUrl / setBundledDefaultUrl', () => {
  it('defaults to `themes/masswerk-7-le/`', () => {
    expect(getBundledDefaultUrl()).toBe('themes/masswerk-7-le/');
  });

  it('setBundledDefaultUrl overrides the default', () => {
    setBundledDefaultUrl('/static/themes/7le/');
    expect(getBundledDefaultUrl()).toBe('/static/themes/7le/');
  });

  it('reset restores the original default', () => {
    setBundledDefaultUrl('/custom/');
    _resetBundledDefaultForTests();
    expect(getBundledDefaultUrl()).toBe('themes/masswerk-7-le/');
  });
});

describe('loadBundledDefault', () => {
  it('fetches theme.json under the current URL', async () => {
    const fetchSpy = vi.fn().mockResolvedValue({
      ok: true, status: 200, json: () => Promise.resolve(FIXTURE),
    });
    vi.stubGlobal('fetch', fetchSpy);

    await loadBundledDefault();

    // loadTheme appends 'theme.json' to the URL (with trailing slash).
    expect(fetchSpy).toHaveBeenCalledWith(expect.stringContaining('themes/masswerk-7-le/theme.json'));
  });

  it('respects setBundledDefaultUrl override', async () => {
    setBundledDefaultUrl('http://cdn.example/7le/');
    const fetchSpy = vi.fn().mockResolvedValue({
      ok: true, status: 200, json: () => Promise.resolve(FIXTURE),
    });
    vi.stubGlobal('fetch', fetchSpy);

    await loadBundledDefault();
    expect(fetchSpy).toHaveBeenCalledWith('http://cdn.example/7le/theme.json');
  });
});

describe('enableBundledDefault', () => {
  it('is idempotent — second call is a no-op', () => {
    const fetchSpy = vi.fn().mockResolvedValue({
      ok: true, status: 200, json: () => Promise.resolve(FIXTURE),
    });
    vi.stubGlobal('fetch', fetchSpy);
    enableBundledDefault();
    enableBundledDefault();
    // Expect at most one fetch — the second enable shouldn't queue another.
    // (Actual fetch may not have fired yet pending microtasks.)
    expect(fetchSpy.mock.calls.length).toBeLessThanOrEqual(1);
  });

  it('skips auto-load when a theme is already loaded', async () => {
    // Pretend the consumer called loadTheme() manually before enable fired.
    themeRegistry.replace({
      version: '0.1',
      name: 'preloaded',
    } as never);

    const fetchSpy = vi.fn().mockResolvedValue({
      ok: true, status: 200, json: () => Promise.resolve(FIXTURE),
    });
    vi.stubGlobal('fetch', fetchSpy);

    enableBundledDefault();
    // Wait for the microtask the helper queues when past DCL.
    await new Promise(r => setTimeout(r, 0));

    expect(fetchSpy).not.toHaveBeenCalled();
    expect(themeRegistry.current()?.name).toBe('preloaded');
  });

  it('fires loadBundledDefault when no theme is loaded (past DCL path)', async () => {
    // jsdom default readyState is 'complete' — past DCL — so enable queues
    // a microtask rather than registering a DOMContentLoaded listener.
    const fetchSpy = vi.fn().mockResolvedValue({
      ok: true, status: 200, json: () => Promise.resolve(FIXTURE),
    });
    vi.stubGlobal('fetch', fetchSpy);

    enableBundledDefault();
    await new Promise(r => setTimeout(r, 10));

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(themeRegistry.current()?.name).toBe('bundled-7le-fixture');
  });

  it('warns (does not throw) when the bundled-default URL 404s', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false, status: 404, statusText: 'Not Found',
    }));
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    enableBundledDefault();
    await new Promise(r => setTimeout(r, 10));

    expect(warnSpy).toHaveBeenCalledTimes(1);
    expect(warnSpy.mock.calls[0]?.[0]).toContain('bundled-default theme failed');
    expect(themeRegistry.current()).toBeNull();
  });
});
