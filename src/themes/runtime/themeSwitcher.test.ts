import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { enableThemeSwitching } from './themeSwitcher.js';
import { themeRegistry } from './ThemeRegistry.js';

const FIXTURE = {
  version: '0.1',
  name: 'switcher-test',
  palette: { bg: '#abcdef' },
};

function stubFetchOk(body: unknown) {
  return vi.fn().mockResolvedValue({
    ok: true,
    status: 200,
    json: () => Promise.resolve(body),
  });
}

// Tiny helper: yield to the microtask queue so MutationObserver fires.
function flushMicrotasks(): Promise<void> {
  return new Promise(resolve => queueMicrotask(resolve));
}

describe('enableThemeSwitching', () => {
  // Tests share a tracked disable list so each enableThemeSwitching call
  // is disconnected in afterEach — otherwise leaked MutationObservers from
  // prior tests fire on this test's attribute mutations.
  const disables: Array<() => void> = [];
  function enable(opts?: Parameters<typeof enableThemeSwitching>[0]) {
    const d = enableThemeSwitching(opts);
    disables.push(d);
    return d;
  }

  beforeEach(() => {
    themeRegistry.reset();
    document.documentElement.removeAttribute('data-aaron-theme');
  });

  afterEach(() => {
    while (disables.length > 0) disables.pop()!();
    themeRegistry.reset();
    document.documentElement.removeAttribute('data-aaron-theme');
    vi.restoreAllMocks();
  });

  it('loads the attribute value if present at enable time', async () => {
    document.documentElement.setAttribute('data-aaron-theme', 'http://localhost/t1');
    vi.stubGlobal('fetch', stubFetchOk(FIXTURE));

    enable();
    await flushMicrotasks();
    await new Promise(r => setTimeout(r, 10));

    expect(themeRegistry.current()?.name).toBe('switcher-test');
  });

  it('loadInitial: false skips the boot-time load', async () => {
    document.documentElement.setAttribute('data-aaron-theme', 'http://localhost/t1');
    const fetchSpy = stubFetchOk(FIXTURE);
    vi.stubGlobal('fetch', fetchSpy);

    enable({ loadInitial: false });
    await flushMicrotasks();

    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('responds to attribute changes after enable', async () => {
    vi.stubGlobal('fetch', stubFetchOk(FIXTURE));
    enable();

    document.documentElement.setAttribute('data-aaron-theme', 'http://localhost/t2');
    await flushMicrotasks();
    await new Promise(r => setTimeout(r, 10));

    expect(themeRegistry.current()?.name).toBe('switcher-test');
  });

  it('teardown disconnects the MutationObserver', async () => {
    const fetchSpy = stubFetchOk(FIXTURE);
    vi.stubGlobal('fetch', fetchSpy);

    const disable = enable();
    disable();

    document.documentElement.setAttribute('data-aaron-theme', 'http://localhost/post-disable');
    await flushMicrotasks();
    await new Promise(r => setTimeout(r, 10));

    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('ignores attribute being cleared (no auto-unload)', async () => {
    document.documentElement.setAttribute('data-aaron-theme', 'http://localhost/t1');
    vi.stubGlobal('fetch', stubFetchOk(FIXTURE));
    enable();
    await new Promise(r => setTimeout(r, 10));

    const before = themeRegistry.current();

    document.documentElement.removeAttribute('data-aaron-theme');
    await flushMicrotasks();

    expect(themeRegistry.current()).toBe(before);
  });

  it('invokes onError callback on fetch failure', async () => {
    document.documentElement.setAttribute('data-aaron-theme', 'http://localhost/missing');
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false, status: 404, statusText: 'Not Found',
    }));

    const onError = vi.fn();
    enable({ onError });
    await new Promise(r => setTimeout(r, 10));

    expect(onError).toHaveBeenCalledTimes(1);
    expect(onError.mock.calls[0]?.[1]).toBe('http://localhost/missing');
  });
});
