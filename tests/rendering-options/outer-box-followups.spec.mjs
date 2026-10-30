import { test, expect, openHarness } from './fixtures.mjs';

// #542 follow-ups to the #526 outer-box contract (measured and capped sizes bound
// the OUTER chrome; declared sizes are content). Read only from the public
// surface: the window host, its shadow canvas.scriptoscope-chrome and the
// light-DOM .scriptoscope-slot.
const TOL = 1;
const SHORT = '<p>Short body text.</p>';

async function boot(page, mode) {
  await page.evaluate(async ({ mode }) => {
    const api = await import(mode === 'source' ? '/src/index.ts' : '/dist/scriptoscope.js');
    const declarative = await import(mode === 'source' ? '/src/declarative/index.ts' : '/dist/declarative.js');
    const themes = new Map();
    const theme = slug => { if (!themes.has(slug)) themes.set(slug, api.loadTheme(`/themes/${slug}`)); return themes.get(slug); };
    const settle = async () => {
      await new Promise(r => setTimeout(r, 400));
      for (let i = 0; i < 3; i++) await new Promise(r => requestAnimationFrame(r));
    };
    const rect = el => { const r = el.getBoundingClientRect(); return { left: r.left, top: r.top, right: r.right, bottom: r.bottom, width: r.width, height: r.height }; };
    const measure = win => ({ host: rect(win.host), canvas: rect(win.host.shadowRoot.querySelector('canvas.scriptoscope-chrome')),
      slot: rect(win.host.querySelector(':scope > .scriptoscope-slot')) });
    const live = [];
    // Promote one source in a fresh container; `manager` lets two windows share or not share a manager.
    const promote = async (slug, source, { width = 400, manager = new api.WindowManager(), keep = false } = {}) => {
      if (!keep) for (const w of live.splice(0)) { w.win.unmount(); w.container.remove(); }
      const container = document.createElement('div');
      container.style.cssText = `width: ${width}px; margin: 24px;`;
      container.innerHTML = source;
      document.body.prepend(container);
      const win = await declarative.ScriptoscopeWindow.promote(container.querySelector('[data-scriptoscope-window]'), { manager, theme: await theme(slug) });
      const w = { win, container, manager };
      live.push(w);
      await settle();
      return w;
    };
    const zoom = async win => { win.host.shadowRoot.querySelector('.scriptoscope-titlewidget-zoom').click(); await settle(); };
    window.__obf = { api, theme, settle, measure, promote, zoom };
  }, { mode });
}

const AUTO = title => `<article data-scriptoscope-window data-scriptoscope-title="${title}">${SHORT}</article>`;
const expectHostIsChrome = (m, label) => {
  for (const k of ['left', 'top', 'width', 'height']) {
    expect.soft(Math.abs(m.host[k] - m.canvas[k]), `${label}: host.${k} ${m.host[k]} vs canvas.${k} ${m.canvas[k]}`).toBeLessThanOrEqual(TOL);
  }
};
const expectWithin = (m, width, label) =>
  expect.soft(m.canvas.width, `${label}: chrome width ${m.canvas.width} within ${width}px bound`).toBeLessThanOrEqual(width + TOL);

for (const mode of ['source', 'built']) {
  // Item 4: the host is pinned to the chrome for an AUTO window too, not only a
  // declared one. Auto-fit grows a wide-content window past its captured
  // in-flow box, a consumer class height does not cap auto-fit, and a collapsed
  // window is only a title bar tall. Without the pin the in-flow host keeps its
  // container's width or the class height instead of the chrome's.
  test(`${mode}: in-flow auto host stays the chrome box when auto-fit grows it and when collapsed (#542)`, async ({ page, servers }) => {
    await openHarness(page, servers, mode);
    await boot(page, mode);
    const r = await page.evaluate(async () => {
      const h = window.__obf;
      const wide = await h.promote('windows-95', `<article data-scriptoscope-window data-scriptoscope-title="Wide">
        <pre style="margin:0;width:560px">${'wide '.repeat(20)}</pre></article>`, { width: 300 });
      const grown = h.measure(wide.win);
      const fixed = await h.promote('windows-95', `<style>.obf-fixed { height: 120px; }</style>
        <article class="obf-fixed" data-scriptoscope-window data-scriptoscope-title="Tall">${'<p>Taller than the class height.</p>'.repeat(8)}</article>`);
      const tall = h.measure(fixed.win);
      const shut = await h.promote('windows-95', `<article data-scriptoscope-window data-scriptoscope-collapsed data-scriptoscope-title="Shut">${'<p>Body.</p>'.repeat(6)}</article>`);
      return { grown, tall, collapsed: h.measure(shut.win) };
    });
    expect.soft(r.grown.canvas.width, 'auto-fit grew past the 300px captured box').toBeGreaterThan(300 + TOL);
    expectHostIsChrome(r.grown, 'auto-fit grown');
    expect.soft(r.tall.canvas.height, 'auto-fit grew past the 120px class height').toBeGreaterThan(120 + TOL);
    expectHostIsChrome(r.tall, 'auto-fit past a class height');
    expect.soft(r.collapsed.canvas.height, 'collapsed chrome is only the title bar').toBeLessThan(60);
    expectHostIsChrome(r.collapsed, 'collapsed auto');
    // A window promoted collapsed honours its captured width bound (#542 item 1).
    expectWithin(r.collapsed, 400, 'collapsed auto');
  });

  // Item 1: a collapsed window keeps its outer WIDTH bound through a retheme
  // to a thicker frame, and expands to the direct-load box of the new scheme.
  test(`${mode}: a collapsed auto window rethemed apple-lisa -> dolphin-som stays inside its bound (#542)`, async ({ page, servers }) => {
    await openHarness(page, servers, mode);
    await boot(page, mode);
    const r = await page.evaluate(async ({ source }) => {
      const h = window.__obf;
      const direct = h.measure((await h.promote('dolphin-som', source)).win);
      const { win, manager } = await h.promote('apple-lisa', source);
      win.host.shadowRoot.querySelector('.scriptoscope-titlewidget-collapse').click();
      await h.settle();
      const collapsed = h.measure(win);
      await manager.retheme(await h.theme('dolphin-som'));
      await h.settle();
      const rethemed = h.measure(win);
      win.host.shadowRoot.querySelector('.scriptoscope-titlewidget-collapse').click();
      await h.settle();
      return { direct, collapsed, rethemed, expanded: h.measure(win) };
    }, { source: AUTO('Shade') });
    expect.soft(r.collapsed.canvas.height, 'collapsed').toBeLessThan(r.direct.canvas.height);
    expectWithin(r.rethemed, 400, 'collapsed after retheme');
    expectHostIsChrome(r.rethemed, 'collapsed after retheme');
    for (const k of ['width', 'height']) {
      expect.soft(Math.abs(r.expanded.canvas[k] - r.direct.canvas[k]), `expanded ${k} ${r.expanded.canvas[k]} vs direct ${r.direct.canvas[k]}`).toBeLessThanOrEqual(TOL);
    }
  });

  // Item 2: zoom toggles between the user state and the standard (zoomed)
  // state. Auto-fit growth while zoomed updates the user state, so unzoom
  // shows the grown window; the zoomed window keeps the standard state it was
  // zoomed to. The growth is measured while the zoomed window scrolls (its
  // slot reserves a scrollbar gutter, so text wraps a little taller), so the
  // restored window must show all the grown content rather than match an
  // unzoomed growth to the pixel.
  test(`${mode}: content growth while zoomed is kept by unzoom (#542)`, async ({ page, servers }) => {
    await openHarness(page, servers, mode);
    await boot(page, mode);
    const r = await page.evaluate(async ({ source }) => {
      const h = window.__obf;
      const { win } = await h.promote('windows-95', source);
      const before = h.measure(win);
      await h.zoom(win);
      const zoomed = h.measure(win);
      win.host.querySelector('p').insertAdjacentHTML('afterend', `<p>${'Grown content. '.repeat(40)}</p>`);
      await h.settle();
      const zoomedGrown = h.measure(win);
      await h.zoom(win);
      const slot = win.host.querySelector(':scope > .scriptoscope-slot');
      return { before, zoomed, zoomedGrown, unzoomed: h.measure(win), overflow: slot.scrollHeight - slot.clientHeight };
    }, { source: AUTO('Zoom') });
    for (const k of ['width', 'height']) {
      expect.soft(Math.abs(r.zoomedGrown.canvas[k] - r.zoomed.canvas[k]), `zoomed ${k} keeps its standard state: ${r.zoomed.canvas[k]} -> ${r.zoomedGrown.canvas[k]}`).toBeLessThanOrEqual(TOL);
    }
    expect.soft(r.unzoomed.canvas.height, `unzoom keeps the growth: ${r.before.canvas.height} -> ${r.unzoomed.canvas.height}`).toBeGreaterThan(r.before.canvas.height + 100);
    expect.soft(r.overflow, 'unzoomed window shows all the grown content').toBeLessThanOrEqual(TOL);
    expectWithin(r.unzoomed, 400, 'unzoomed');
    expectHostIsChrome(r.unzoomed, 'unzoomed');
  });

  // Item 3: the demo's persistence helper restores another tab's window by its
  // OUTER width, so a window saved on a thin frame and restored on a thick one
  // stays inside the same container width instead of adding the thicker frame.
  // Height restores as content: in flow the page absorbs it, and a short saved
  // box can be smaller than a thick scheme's vertical frame alone.
  test(`${mode}: cross-tab layout restore keeps the saved outer width on a thicker theme (#542)`, async ({ page, servers }) => {
    await openHarness(page, servers, mode);
    await boot(page, mode);
    const r = await page.evaluate(async ({ source }) => {
      const h = window.__obf;
      const { ownLayout } = await import('/demo/explicit-layout.mjs');
      localStorage.removeItem('scriptoscope:layout:obf542');
      const tabA = new AbortController();
      const a = await h.promote('apple-lisa', source, { width: 400 });
      const layoutA = ownLayout({ persistKey: 'obf542' }, tabA.signal);
      layoutA.add(a.container.firstElementChild ?? a.container, 0, a.win, a.manager);
      const saved = layoutA.snapshot();
      const savedBox = h.measure(a.win);
      tabA.abort();
      const tabB = new AbortController();
      const b = await h.promote('dolphin-som', source, { width: 400 });
      const layoutB = ownLayout({ persistKey: 'obf542' }, tabB.signal);
      layoutB.add(b.container.firstElementChild ?? b.container, 0, b.win, b.manager);
      dispatchEvent(new StorageEvent('storage', { key: 'scriptoscope:layout:obf542', newValue: JSON.stringify(saved) }));
      await h.settle();
      const restored = h.measure(b.win);
      tabB.abort();
      localStorage.removeItem('scriptoscope:layout:obf542');
      return { savedBox, restored };
    }, { source: AUTO('Persisted') });
    expectWithin(r.savedBox, 400, 'saved on apple-lisa');
    expectWithin(r.restored, 400, 'restored on dolphin-som');
    expect.soft(Math.abs(r.restored.canvas.width - r.savedBox.canvas.width), `restored outer width ${r.restored.canvas.width} vs saved ${r.savedBox.canvas.width}`).toBeLessThanOrEqual(TOL);
    expect.soft(Math.abs(r.restored.slot.height - r.savedBox.slot.height), `restored content height ${r.restored.slot.height} vs saved ${r.savedBox.slot.height}`).toBeLessThanOrEqual(TOL);
    expectHostIsChrome(r.restored, 'restored');
  });
}
