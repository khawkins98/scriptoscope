import { test, expect, openHarness } from './fixtures.mjs';

async function setup(page, servers, mode) {
  await openHarness(page, servers, mode);
  await page.evaluate(async mode => {
    const runtime = await import(mode === 'source' ? '/src/index.ts' : '/dist/scriptoscope.js');
    const root = document.createElement('section'); document.body.append(root);
    root.innerHTML = `<div data-scriptoscope-window data-scriptoscope-title="First" data-scriptoscope-width="320" data-scriptoscope-height="200" style="width:320px"><label>Volume<input id="ordering-range" type="range" value="37"></label><input id="ordering-text" value="consumer"><select><option>A</option><option selected>B</option></select></div><div data-scriptoscope-window data-scriptoscope-title="Second" data-scriptoscope-width="320" data-scriptoscope-height="90" style="width:320px">Second</div>`;
    const range = root.querySelector('input[type=range]'), text = root.querySelector('input:not([type])');
    const handle = await runtime.mountDeclarative({ root, themeBaseUrl: '/themes', pageThemeDefault: 'windows-95', bootAffordance: 'none', syncToUrlParam: 'ordering-theme', persistKey: 'ordering-test' });
    const f = window.ordering = { runtime, root, handle, range, text, events: [] };
    handle.addEventListener('retheme', event => f.events.push(event.detail.ref));
    f.snapshot = () => [...root.querySelectorAll('[data-scriptoscope-window-host]')].map(host => ({ ref: host.dataset.scriptoscopeTheme, state: host.shadowRoot.querySelector('.scriptoscope-window')?.dataset.scriptoscopeCurrentState, pixels: [...host.shadowRoot.querySelectorAll('canvas.scriptoscope-chrome')].map(c => { let hash = 2166136261; for (const b of c.getContext('2d').getImageData(0, 0, c.width, c.height).data) hash = Math.imul(hash ^ b, 16777619); return [c.width, c.height, hash >>> 0]; }) }));
    f.holdDecode = () => {
      const decode = HTMLImageElement.prototype.decode;
      f.held = 0;
      const barrier = new Promise((resolve, reject) => { f.release = resolve; f.reject = reject; });
      HTMLImageElement.prototype.decode = async function () {
        HTMLImageElement.prototype.decode = decode;
        f.held++; await barrier; return decode.call(this);
      };
    };
  }, mode);
}

for (const mode of ['source', 'built']) {
  test(`${mode}: latest real theme request owns every window after delayed chrome completes`, async ({ page, servers }) => {
    await setup(page, servers, mode);
    await page.evaluate(() => { const f = window.ordering; f.holdDecode(); f.old = f.handle.retheme('system7-nostalgia-silver'); });
    await page.waitForFunction(() => window.ordering.held === 1);
    await page.evaluate(async () => {
      const f = window.ordering; await f.handle.retheme('beos-r503'); f.expected = f.snapshot();
      f.range.value = '63'; f.range.setAttribute('aria-label', 'Consumer volume'); f.range.focus();
      f.text.value = 'edited while pending'; f.release(); await f.old;
    });
    expect(await page.evaluate(() => { const f = window.ordering; return { windows: f.snapshot(), expected: f.expected, events: f.events, value: f.range.value, name: f.range.getAttribute('aria-label'), focused: document.activeElement === f.range, text: f.text.value }; })).toEqual(expect.objectContaining({
      events: ['beos-r503'], value: '63', name: 'Consumer volume', focused: true, text: 'edited while pending',
    }));
    expect(await page.evaluate(() => { const f = window.ordering; return f.snapshot().map(w => w.pixels); })).toEqual(await page.evaluate(() => window.ordering.expected.map(w => w.pixels)));
    await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('scriptoscope:layout:ordering-test') ?? '{}').activeTheme)).toBe('beos-r503');
    await page.evaluate(() => window.ordering.handle.disconnect());
  });
  test(`${mode}: reordered archive loads cannot publish a superseded completion`, async ({ page, servers }) => {
    await setup(page, servers, mode);
    let release, held = false;
    const barrier = new Promise(resolve => release = resolve);
    await page.route('**/themes/system7-nostalgia-silver/scheme.*', async route => { held = true; await barrier; await route.continue(); });
    await page.evaluate(() => { const f = window.ordering; f.old = f.handle.retheme('system7-nostalgia-silver'); });
    await expect.poll(() => held).toBe(true);
    await page.evaluate(async () => { const f = window.ordering; await f.handle.retheme('beos-r503'); f.expected = f.snapshot(); });
    release();
    await page.evaluate(() => window.ordering.old);
    expect(await page.evaluate(() => { const f = window.ordering; return { same: JSON.stringify(f.snapshot()) === JSON.stringify(f.expected), events: f.events }; })).toEqual({ same: true, events: ['beos-r503'] });
    await page.evaluate(() => window.ordering.handle.disconnect());
  });

  test(`${mode}: a newer failed load invalidates held chrome without publishing its theme and can retry`, async ({ page, servers }) => {
    await setup(page, servers, mode);
    await page.evaluate(() => { const f = window.ordering; f.initial = f.snapshot(); f.holdDecode(); f.old = f.handle.retheme('system7-nostalgia-silver'); });
    await page.waitForFunction(() => window.ordering.held === 1);
    await page.route('**/themes/beos-r503/scheme.*', route => route.fulfill({ status: 503, body: 'Deliberate archive failure' }));
    expect(await page.evaluate(async () => { try { await window.ordering.handle.retheme('beos-r503'); return 'resolved'; } catch { return 'rejected'; } })).toBe('rejected');
    await page.evaluate(async () => { const f = window.ordering; f.release(); await f.old; });
    expect(await page.evaluate(() => { const f = window.ordering; return { same: JSON.stringify(f.snapshot()) === JSON.stringify(f.initial), events: f.events, url: new URL(location.href).searchParams.get('ordering-theme') }; })).toEqual({ same: true, events: [], url: null });
    // A newly inserted source follows the completed theme, never the failed slug.
    await page.evaluate(() => { const wrap = document.createElement('div'); wrap.innerHTML = '<div data-scriptoscope-window data-scriptoscope-title="After failure" style="width:200px">New</div>'; window.ordering.root.append(wrap); });
    await expect.poll(() => page.evaluate(() => window.ordering.handle.stats.windows)).toBe(3);
    expect(await page.evaluate(() => window.ordering.snapshot().map(w => w.ref))).toEqual(['windows-95', 'windows-95', 'windows-95']);
    await page.unroute('**/themes/beos-r503/scheme.*');
    await page.evaluate(() => window.ordering.handle.retheme('beos-r503'));
    expect(await page.evaluate(() => window.ordering.events)).toEqual(['beos-r503']);
    await page.evaluate(() => window.ordering.handle.disconnect());
  });

  test(`${mode}: disconnect invalidates held window preparation without repainting retained hosts`, async ({ page, servers }) => {
    await setup(page, servers, mode);
    await page.evaluate(() => {
      const f = window.ordering;
      f.hosts = [...f.root.querySelectorAll('[data-scriptoscope-window-host]')];
      f.oldCanvases = f.hosts.map(h => h.shadowRoot.querySelector('canvas'));
      f.oldPixels = f.oldCanvases.map(c => c.toDataURL());
      f.holdDecode(); f.old = f.handle.retheme('system7-nostalgia-silver');
    });
    await page.waitForFunction(() => window.ordering.held === 1);
    await page.evaluate(async () => { const f = window.ordering; f.handle.disconnect(); f.release(); await f.old; });
    expect(await page.evaluate(() => {
      const f = window.ordering;
      return { events: f.events, connected: f.hosts.some(h => h.isConnected), unchanged: f.oldCanvases.every((c, i) => c.toDataURL() === f.oldPixels[i]), native: f.range.isConnected, value: f.range.value, faces: f.root.querySelectorAll('.scriptoscope-slider,.scriptoscope-select').length };
    })).toEqual({ events: [], connected: false, unchanged: true, native: true, value: '37', faces: 0 });
  });

  test(`${mode}: direct manager orders batches, retries changed geometry, and retains pooled canvases`, async ({ page, servers }) => {
    await setup(page, servers, mode);
    await page.evaluate(async () => {
      const f = window.ordering; f.handle.disconnect(); f.root.replaceChildren();
      f.themes = await Promise.all(['windows-95', 'system7-nostalgia-silver', 'beos-r503'].map(s => f.runtime.loadTheme('/themes/' + s)));
      f.manager = new f.runtime.WindowManager();
      f.callerCanvas = document.createElement('canvas');
      f.hosts = [];
      for (const title of ['A', 'B']) { const h = await f.manager.add(f.themes[0], { title, width: 220, height: 90, ...(title === 'A' ? { reuseCanvas: f.callerCanvas } : {}) }); f.root.append(h); f.hosts.push(h); }
      f.canvases = f.hosts.map(h => h.shadowRoot.querySelector('canvas.scriptoscope-chrome'));
      f.callerBefore = f.callerCanvas.toDataURL();
      f.holdDecode(); f.old = f.manager.retheme(f.themes[1]);
    });
    await page.waitForFunction(() => window.ordering.held === 1);
    await page.evaluate(async () => {
      const f = window.ordering;
      await f.manager.retheme(f.themes[2]);
      f.expected = f.snapshot(); f.expectedCaller = f.callerCanvas.toDataURL(); f.release(); await f.old;
    });
    expect(await page.evaluate(() => {
      const f = window.ordering;
      return { unchanged: JSON.stringify(f.expected) === JSON.stringify(f.snapshot()), themes: f.hosts.every(h => f.manager.describe(h).theme === f.themes[2]), pooled: f.hosts.every((h, i) => h.shadowRoot.querySelector('canvas.scriptoscope-chrome') === f.canvases[i]), caller: f.canvases[0] === f.callerCanvas && f.callerCanvas.toDataURL() === f.expectedCaller };
    })).toEqual({ unchanged: true, themes: true, pooled: true, caller: true });
    // A fresh real archive gives uncached rasters; resize while its batch is held.
    await page.evaluate(async () => {
      const f = window.ordering; f.next = await f.runtime.loadTheme('/themes/1990');
      f.holdDecode(); f.old = f.manager.retheme(f.next);
    });
    await page.waitForFunction(() => window.ordering.held === 1);
    await page.evaluate(async () => {
      const f = window.ordering; await f.manager.setContentSize(f.hosts[0], 277, 133);
      f.manager.remove(f.hosts[1]); f.hosts[1].remove(); f.release(); await f.old;
    });
    expect(await page.evaluate(() => {
      const f = window.ordering, d = f.manager.describe(f.hosts[0]);
      return { width: d.width, height: d.height, theme: d.theme === f.next, removed: f.manager.describe(f.hosts[1]), connected: f.hosts[1].isConnected };
    })).toEqual({ width: 277, height: 133, theme: true, removed: null, connected: false });
    await page.evaluate(async () => { const f = window.ordering; f.hosts[0].remove(); await f.manager.retheme(f.themes[0]); });
    expect(await page.evaluate(() => window.ordering.manager.describe(window.ordering.hosts[0]))).toBeNull();
    await page.evaluate(() => { const f = window.ordering; f.manager.remove(f.hosts[0]); f.root.remove(); [...f.themes, f.next].forEach(t => t.dispose?.()); });
  });

  test(`${mode}: scans started before or during a switch join its completed window theme`, async ({ page, servers }) => {
    await setup(page, servers, mode);
    await page.evaluate(() => {
      const f = window.ordering;
      f.holdDecode();
      const wrap = document.createElement('div'); wrap.innerHTML = '<div data-scriptoscope-window data-scriptoscope-theme="1990" data-scriptoscope-width="200" data-scriptoscope-height="80">Already preparing</div>';
      f.root.append(wrap);
    });
    await page.waitForFunction(() => window.ordering.held === 1);
    await page.evaluate(() => {
      const f = window.ordering; f.next = f.handle.retheme('beos-r503');
      const wrap = document.createElement('div'); wrap.innerHTML = '<div data-scriptoscope-window data-scriptoscope-width="200" data-scriptoscope-height="80">Arrived during switch</div>';
      f.root.append(wrap); f.release();
    });
    await page.evaluate(() => window.ordering.next);
    await expect.poll(() => page.evaluate(() => window.ordering.handle.stats.windows)).toBe(4);
    expect(await page.evaluate(() => window.ordering.snapshot().map(w => w.ref))).toEqual(['beos-r503', 'beos-r503', 'beos-r503', 'beos-r503']);
    await page.evaluate(() => window.ordering.handle.disconnect());
  });

  test(`${mode}: a second-window decode failure leaves the whole manager batch unchanged`, async ({ page, servers }) => {
    await setup(page, servers, mode);
    await page.evaluate(async () => {
      const f = window.ordering; f.handle.disconnect(); f.root.replaceChildren();
      f.themes = await Promise.all(['windows-95', 'system7-nostalgia-silver'].map(s => f.runtime.loadTheme('/themes/' + s)));
      f.manager = new f.runtime.WindowManager(); f.hosts = [];
      for (const title of ['A', 'B']) { const h = await f.manager.add(f.themes[0], { title, width: 220, height: 90 }); f.root.append(h); f.hosts.push(h); }
      f.initial = f.snapshot();
      const inactive = f.runtime.assetUrl(f.themes[1], f.themes[1].manifest.windowTypes['document-window'].chrome.inactive);
      const decode = HTMLImageElement.prototype.decode; f.failed = 0;
      HTMLImageElement.prototype.decode = async function () {
        if (this.src === inactive) { f.failed++; throw new Error('Deliberate second-window image failure'); }
        return decode.call(this);
      };
      try { await f.manager.retheme(f.themes[1]); f.outcome = 'resolved'; } catch { f.outcome = 'rejected'; }
      finally { HTMLImageElement.prototype.decode = decode; }
    });
    expect(await page.evaluate(() => {
      const f = window.ordering;
      return { failed: f.failed, outcome: f.outcome, same: JSON.stringify(f.snapshot()) === JSON.stringify(f.initial), themes: f.hosts.every(h => f.manager.describe(h).theme === f.themes[0]) };
    })).toEqual({ failed: 1, outcome: 'rejected', same: true, themes: true });
    await page.evaluate(() => { const f = window.ordering; f.hosts.forEach(h => f.manager.remove(h)); f.root.remove(); f.themes.forEach(t => t.dispose?.()); });
  });

  test(`${mode}: superseded button and tab preparation cannot overwrite newer faces`, async ({ page, servers }) => {
    await setup(page, servers, mode);
    for (const heldKind of ['button', 'tabs']) {
      await page.evaluate(async heldKind => {
        const f = window.ordering; f.handle.disconnect();
        f.root.innerHTML = `${heldKind === 'button' ? '<button data-scriptoscope-button>Action</button>' : ''}<div data-scriptoscope-tabs><button data-scriptoscope-tab="one" data-scriptoscope-selected>One</button><button data-scriptoscope-tab="two">Two</button><section data-scriptoscope-panel="one">First</section><section data-scriptoscope-panel="two">Second</section></div><label>Volume<input type="range" value="43"></label>`;
        f.handle = await f.runtime.mountDeclarative({ root: f.root, pageThemeDefault: 'windows-95', bootAffordance: 'none' });
        f.events = []; f.handle.addEventListener('retheme', e => f.events.push(e.detail.ref));
        f.faceSnapshot = () => [...f.root.querySelectorAll('canvas')].map(c => c.toDataURL());
        f.holdDecode(); f.old = f.handle.retheme(heldKind === 'tabs' ? 'windows-31' : 'system7-nostalgia-silver');
      }, heldKind);
      await page.waitForFunction(() => window.ordering.held === 1);
      await page.evaluate(async () => { const f = window.ordering; await f.handle.retheme('beos-r503'); f.expectedFaces = f.faceSnapshot(); f.release(); await f.old; });
      expect(await page.evaluate(() => { const f = window.ordering; return { same: JSON.stringify(f.faceSnapshot()) === JSON.stringify(f.expectedFaces), tabs: f.root.querySelectorAll('[data-scriptoscope-tab-skinned]').length, events: f.events }; })).toEqual({ same: true, tabs: 2, events: ['beos-r503'] });
    }
    await page.evaluate(() => window.ordering.handle.disconnect());
  });

  test(`${mode}: current native focus and consumer state survive a completed switch`, async ({ page, servers }) => {
    await setup(page, servers, mode);
    for (const selector of ['select', 'input[type=range]']) {
      await page.locator(selector === 'select' ? 'section select' : '#ordering-range').last().focus();
      await page.evaluate(async selector => {
        const f = window.ordering, input = f.root.querySelector(selector);
        input.setAttribute('aria-label', 'Consumer name'); input.setAttribute('data-consumer', 'kept');
        f.focused = input;
        await f.handle.retheme(selector === 'select' ? 'system7-nostalgia-silver' : 'beos-r503');
      }, selector);
      expect(await page.evaluate(() => { const f = window.ordering; return { same: document.activeElement === f.focused, name: f.focused.getAttribute('aria-label'), custom: f.focused.getAttribute('data-consumer'), value: f.focused.value }; })).toEqual({ same: true, name: 'Consumer name', custom: 'kept', value: selector === 'select' ? 'B' : '37' });
    }
    await page.evaluate(() => window.ordering.handle.disconnect());
  });

  test(`${mode}: window metadata commits with chrome before a mutation observer can request another theme`, async ({ page, servers }) => {
    await setup(page, servers, mode);
    await page.evaluate(async () => {
      const f = window.ordering;
      const observer = new MutationObserver(() => {
        observer.disconnect();
        f.latest = f.handle.retheme('missing-ordering-theme').then(() => 'resolved', () => 'rejected');
      });
      observer.observe(f.root.querySelector('[data-scriptoscope-window-host]').shadowRoot, { childList: true });
      await f.handle.retheme('system7-nostalgia-silver');
      f.latestResult = await f.latest;
    });
    expect(await page.evaluate(() => { const f = window.ordering; return { refs: f.snapshot().map(w => w.ref), events: f.events, latest: f.latestResult }; })).toEqual({ refs: ['system7-nostalgia-silver', 'system7-nostalgia-silver'], events: [], latest: 'rejected' });
    await page.evaluate(() => window.ordering.handle.disconnect());
  });

  test(`${mode}: a delayed old title-widget paint cannot write into a reused newer chrome canvas`, async ({ page, servers }) => {
    await setup(page, servers, mode);
    await page.evaluate(async () => {
      const f = window.ordering; f.handle.disconnect(); f.root.replaceChildren();
      f.themes = await Promise.all(['windows-95', 'beos-r503'].map(s => f.runtime.loadTheme('/themes/' + s)));
      f.manager = new f.runtime.WindowManager();
      f.options = { title: 'Widget race', width: 240, height: 100, reuseCanvas: document.createElement('canvas') };
      f.host = await f.manager.add(f.themes[0], f.options, { onClose() {} }); f.root.append(f.host);
      f.button = f.host.shadowRoot.querySelector('.scriptoscope-titlewidget-zoom');
      f.holdFonts = () => {
        const load = document.fonts.load; f.held = 0;
        const barrier = new Promise(resolve => f.release = resolve);
        document.fonts.load = async function (...args) {
          document.fonts.load = load; f.held++; await barrier; return load.apply(this, args);
        };
      };
      f.holdFonts();
      f.button.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
    });
    await page.waitForFunction(() => window.ordering.held === 1);
    await page.evaluate(async () => {
      const f = window.ordering; await f.manager.retheme(f.themes[1]);
      f.expected = f.snapshot(); f.release();
      // Drain the same real pressed-render dependencies; no timer/raster stub.
      const { reuseCanvas, ...options } = f.options;
      await f.runtime.renderWindow(f.themes[0], { ...options, pressedWidget: 'zoom' });
      f.button.dispatchEvent(new PointerEvent('pointerup'));
    });
    expect(await page.evaluate(() => { const f = window.ordering; return { same: JSON.stringify(f.snapshot()) === JSON.stringify(f.expected), pooled: f.host.shadowRoot.querySelector('canvas.scriptoscope-chrome') === f.options.reuseCanvas }; })).toEqual({ same: true, pooled: true });
    // Releasing before the same chrome's pressed render finishes also invalidates
    // that paint; chrome identity alone cannot distinguish a released gesture.
    await page.evaluate(async () => {
      const f = window.ordering; await f.manager.retheme(f.themes[0]);
      f.expected = f.snapshot(); f.button = f.host.shadowRoot.querySelector('.scriptoscope-titlewidget-zoom');
      f.holdFonts(); f.button.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
    });
    await page.waitForFunction(() => window.ordering.held === 1);
    await page.evaluate(async () => {
      const f = window.ordering; f.button.dispatchEvent(new PointerEvent('pointerup')); f.release();
      const { reuseCanvas, ...options } = f.options;
      await f.runtime.renderWindow(f.themes[0], { ...options, pressedWidget: 'zoom' });
    });
    expect(await page.evaluate(() => { const f = window.ordering; return JSON.stringify(f.snapshot()) === JSON.stringify(f.expected); })).toBe(true);
    await page.evaluate(() => { const f = window.ordering; f.manager.remove(f.host); f.root.remove(); f.themes.forEach(t => t.dispose?.()); });
  });

}
