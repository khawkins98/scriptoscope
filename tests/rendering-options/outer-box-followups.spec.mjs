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

  // Review of #564: the built-in frame draws a collapsed side utility as a bare
  // bar with no content width, so its footprint says nothing about the bound.
  // Collapsing must keep the last expanded content width (public describe()),
  // prepare once like an unbounded collapse, expand back inside the column, and
  // a persisted collapsed layout must restore inside it. evolution is the wnd# control.
  for (const slug of ['platinum-8', 'apple-platinum-2', 'evolution']) {
    test(`${mode}: ${slug} collapsed side utility keeps its content width and prepares once (#542)`, async ({ page, servers }) => {
      await openHarness(page, servers, mode);
      await boot(page, mode);
      const r = await page.evaluate(async ({ slug }) => {
        const h = window.__obf;
        const src = (title, attrs = '') => `<article data-scriptoscope-window data-scriptoscope-window-type="side-floating-utility-window" data-scriptoscope-title="${title}" ${attrs}>${'<p>Utility body.</p>'.repeat(3)}</article>`;
        // Prepared windows are detached; each preparation creates its chrome canvas.
        const counted = async run => {
          const create = document.createElement;
          let n = 0;
          document.createElement = function (tag, ...rest) { if (String(tag).toLowerCase() === 'canvas') n++; return create.call(this, tag, ...rest); };
          try { await run(); } finally { document.createElement = create; }
          return n;
        };
        const declared = await h.promote(slug, src('Declared', 'data-scriptoscope-width="300" data-scriptoscope-height="80"'));
        const unbounded = await counted(() => declared.manager.applyState(declared.win.host, { collapsed: true }));
        const { win, manager } = await h.promote(slug, src('Auto'));
        const expanded = manager.describe(win.host).width;
        const bounded = await counted(() => manager.applyState(win.host, { collapsed: true }));
        await h.settle();
        const collapsedWidth = manager.describe(win.host).width;
        const { ownLayout } = await import('/demo/explicit-layout.mjs');
        const tabA = new AbortController();
        const layoutA = ownLayout({ persistKey: 'obf542u' }, tabA.signal);
        layoutA.add(win.host, 0, win, manager);
        const saved = layoutA.snapshot();
        tabA.abort();
        await manager.applyState(win.host, { collapsed: false });
        await h.settle();
        const reexpanded = h.measure(win);
        const b = await h.promote(slug, src('Restored'));
        const tabB = new AbortController();
        const layoutB = ownLayout({ persistKey: 'obf542u' }, tabB.signal);
        layoutB.add(b.win.host, 0, b.win, b.manager);
        dispatchEvent(new StorageEvent('storage', { key: 'scriptoscope:layout:obf542u', newValue: JSON.stringify(saved) }));
        await h.settle();
        tabB.abort();
        await b.manager.applyState(b.win.host, { collapsed: false });
        await h.settle();
        localStorage.removeItem('scriptoscope:layout:obf542u');
        return { unbounded, bounded, expanded, collapsedWidth, saved: saved.windows['0'], reexpanded, restored: h.measure(b.win) };
      }, { slug });
      expect.soft(r.collapsedWidth, `${slug}: describe().width while collapsed`).toBe(r.expanded);
      expect.soft(r.bounded, `${slug}: preparations for a bounded collapse vs an unbounded one (${r.unbounded})`).toBe(r.unbounded);
      expect.soft(r.saved.w, `${slug}: persisted content width`).toBe(r.expanded);
      expectWithin(r.reexpanded, 400, `${slug} re-expanded`);
      expectWithin(r.restored, 400, `${slug} restored from a collapsed snapshot and expanded`);
      expectHostIsChrome(r.restored, `${slug} restored`);
    });
  }
}

// #566: the built-in frame hides the content box of a collapsed DOCUMENT
// window, but its title bar still spans the full width, so the collapsed
// window must fit the outer bound from the theme's expanded frame extent rather
// than keep the last expanded content width. Collapsed at promote and collapsed
// on apple-lisa then rethemed both used to overhang a 400px column (413/410).
// Preparations: an uncached theme costs one hidden expanded preparation, which
// the next expand reuses (one preparation instead of a guess plus a correction);
// a collapse after an expanded render on the same theme prepares once.
for (const mode of ['source', 'built']) {
  for (const slug of ['apple-platinum-2', 'platinum-8', 'black-platinum', 'slimes', 'system7-nostalgia-silver']) {
    test(`${mode}: ${slug} collapsed document stays inside its outer bound (#566)`, async ({ page, servers }) => {
      await openHarness(page, servers, mode);
      await boot(page, mode);
      const r = await page.evaluate(async ({ slug }) => {
        const h = window.__obf;
        // Each preparation names its root .scriptoscope-window once (a titled document
        // window also creates title and widget canvases, so canvases are not a count).
        const counted = async run => {
          const desc = Object.getOwnPropertyDescriptor(Element.prototype, 'className');
          let n = 0;
          Object.defineProperty(Element.prototype, 'className', { ...desc, set(v) { if (v === 'scriptoscope-window') n++; desc.set.call(this, v); } });
          try { await run(); } finally { Object.defineProperty(Element.prototype, 'className', desc); }
          return n;
        };
        const body = '<p>Short body text.</p>';
        const shut = await h.promote(slug, `<article data-scriptoscope-window data-scriptoscope-collapsed data-scriptoscope-title="Shut">${body}</article>`);
        const atPromote = h.measure(shut.win);
        const direct = h.measure((await h.promote(slug, `<article data-scriptoscope-window data-scriptoscope-title="Shade">${body}</article>`)).win);
        const { win, manager } = await h.promote('apple-lisa', `<article data-scriptoscope-window data-scriptoscope-title="Shade">${body}</article>`);
        await manager.applyState(win.host, { collapsed: true });
        const target = await h.theme(slug);
        const retheme = await counted(() => manager.retheme(target));
        await h.settle();
        const rethemed = h.measure(win);
        const expand = await counted(() => manager.applyState(win.host, { collapsed: false }));
        await h.settle();
        const expanded = h.measure(win);
        const recollapse = await counted(() => manager.applyState(win.host, { collapsed: true }));
        await h.settle();
        return { atPromote, direct, rethemed, expanded, retheme, expand, recollapse, recollapsed: h.measure(win) };
      }, { slug });
      expectWithin(r.atPromote, 400, `${slug} collapsed at promote`);
      expectHostIsChrome(r.atPromote, `${slug} collapsed at promote`);
      expectWithin(r.rethemed, 400, `${slug} collapsed after retheme`);
      expectHostIsChrome(r.rethemed, `${slug} collapsed after retheme`);
      for (const [label, m] of [['at promote', r.atPromote], ['after retheme', r.rethemed], ['recollapsed', r.recollapsed]]) {
        expect.soft(Math.abs(m.canvas.width - r.direct.canvas.width), `${slug} collapsed ${label} width ${m.canvas.width} vs expanded ${r.direct.canvas.width}`).toBeLessThanOrEqual(TOL);
      }
      for (const k of ['width', 'height']) {
        expect.soft(Math.abs(r.expanded.canvas[k] - r.direct.canvas[k]), `${slug} expanded ${k} ${r.expanded.canvas[k]} vs direct ${r.direct.canvas[k]}`).toBeLessThanOrEqual(TOL);
      }
      expect.soft(r.retheme, `${slug}: collapsed retheme preparations (collapsed, one expanded measure, refit)`).toBe(3);
      expect.soft(r.expand, `${slug}: the expand reuses the measured extent and prepares once`).toBe(1);
      expect.soft(r.recollapse, `${slug}: collapse with the extent cached prepares once`).toBe(1);
    });
  }

  // #566 at scale 2: the bound and the frame extent are unscaled px while the
  // rendered footprint is scaled, so a collapsed document added at scale 2 with
  // a stale content width must still match an expanded one inside the same bound.
  for (const slug of ['platinum-8', 'black-platinum']) {
    test(`${mode}: ${slug} collapsed document at scale 2 fits its outer bound (#566)`, async ({ page, servers }) => {
      await openHarness(page, servers, mode);
      await boot(page, mode);
      const r = await page.evaluate(async ({ slug }) => {
        const h = window.__obf;
        const theme = await h.theme(slug);
        const box = async collapsed => {
          const manager = new h.api.WindowManager();
          const host = await manager.add(theme, { title: 'Scaled', width: 300, height: 80, scale: 2 }, {}, { collapsed, outerSize: { width: 400 } });
          document.body.append(host);
          await h.settle();
          const r = host.shadowRoot.querySelector('canvas.scriptoscope-chrome').getBoundingClientRect();
          const out = { width: r.width, height: r.height, content: manager.describe(host).width };
          host.remove();
          return out;
        };
        return { collapsed: await box(true), expanded: await box(false) };
      }, { slug });
      expect.soft(r.expanded.width, `${slug}: expanded scale-2 chrome fills the 400px bound`).toBe(800);
      expect.soft(r.collapsed.height, `${slug}: collapsed is only the title bar`).toBeLessThan(r.expanded.height);
      expect.soft(r.collapsed.width, `${slug}: collapsed scale-2 width ${r.collapsed.width} vs expanded ${r.expanded.width}`).toBe(r.expanded.width);
      expect.soft(r.collapsed.content, `${slug}: collapsed content width`).toBe(r.expanded.content);
    });
  }

  // #566 guard: a side utility rethemed from a wnd# scheme while collapsed is a
  // bare bar whose footprint does not follow its content width, so the refit
  // must not touch it: it keeps its last expanded content width (describe())
  // and costs only the collapsed preparation plus the one expanded measure.
  for (const slug of ['platinum-8', 'slimes']) {
    test(`${mode}: ${slug} collapsed side utility rethemed from evolution keeps its content width (#566)`, async ({ page, servers }) => {
      await openHarness(page, servers, mode);
      await boot(page, mode);
      const r = await page.evaluate(async ({ slug }) => {
        const h = window.__obf;
        const counted = async run => {
          const desc = Object.getOwnPropertyDescriptor(Element.prototype, 'className');
          let n = 0;
          Object.defineProperty(Element.prototype, 'className', { ...desc, set(v) { if (v === 'scriptoscope-window') n++; desc.set.call(this, v); } });
          try { await run(); } finally { Object.defineProperty(Element.prototype, 'className', desc); }
          return n;
        };
        const { win, manager } = await h.promote('evolution', `<article data-scriptoscope-window data-scriptoscope-window-type="side-floating-utility-window" data-scriptoscope-title="Side">${'<p>Utility body.</p>'.repeat(3)}</article>`);
        await manager.applyState(win.host, { collapsed: true });
        const before = manager.describe(win.host).width;
        const target = await h.theme(slug);
        const retheme = await counted(() => manager.retheme(target));
        await h.settle();
        const after = manager.describe(win.host).width;
        await manager.applyState(win.host, { collapsed: false });
        await h.settle();
        return { before, after, retheme, expanded: h.measure(win) };
      }, { slug });
      expect.soft(r.after, `${slug}: describe().width across the collapsed retheme`).toBe(r.before);
      expect.soft(r.retheme, `${slug}: collapsed side-utility retheme preparations (collapsed, one expanded measure)`).toBe(2);
      expectWithin(r.expanded, 400, `${slug} side utility expanded after retheme`);
      expectHostIsChrome(r.expanded, `${slug} side utility expanded after retheme`);
    });
  }
}
