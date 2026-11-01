import { test, expect, openHarness, attachObservations } from './fixtures.mjs';

const pairs = [
  { id: -14300, canonical: 'collapsed-titled-utility-window', legacy: 'collapsed-titled-utility', base: 'titled-utility-window' },
  { id: -14292, canonical: 'collapsed-side-floating-utility-window', legacy: 'collapsed-side-utility', base: 'side-floating-utility-window' },
  { id: -14284, canonical: 'collapsed-no-title-utility-window', legacy: 'collapsed-no-title-utility', base: 'no-title-utility-window' },
];
async function setup(page, servers, mode) {
  await openHarness(page, servers, mode);
  await page.evaluate(async mode => {
    const runtime = await import(mode === 'source' ? '/src/index.ts' : '/dist/scriptoscope.js');
    const themes = await Promise.all(['beos-r503', 'system7-nostalgia-silver', '1138'].map(slug => runtime.loadTheme('/themes/' + slug)));
    const selection = [];
    for (let i = 0; i < themes.length; i++) for (const [key, type] of Object.entries(themes[i].manifest.windowTypes)) {
      const model = type.model;
      // Observe the actual object entering the public renderer's model branch.
      // Preserve its original value, loader, archive, assets and composition.
      Object.defineProperty(type, 'model', { configurable: true, get() { selection.push({ owner: ['beos-r503', 'system7-nostalgia-silver', '1138'][i], key, model: model ?? 'sliced' }); return model; } });
    }
    // #617: the collapsed content rect is emptied on the rendered type's title axis (window-widgets
    // §2.1 C, CN2; hit-regions HP8/HP48): zero width for side-titled types (height kept), zero
    // height otherwise. Frame-policy independent check: growing the expanded size by (dw, dh)
    // must grow a collapsed side-titled window by (0, dh) and a top-titled one by (dw, 0).
    const SIDE = new Set(['collapsed-side-utility', 'collapsed-side-floating-utility-window']);
    const axisGrowth = async (theme, key) => {
      if (theme.manifest.windowTypes[key].model) return null; // the built-in frame keeps its zero-height collapse
      const size = async (w, h) => { const win = await runtime.renderWindow(theme, { width: w, height: h, title: 'Tools', windowType: key, collapsed: true }); const c = win.querySelector('canvas.scriptoscope-chrome'); return [c.width, c.height]; };
      const [a, b] = [await size(180, 75), await size(220, 115)];
      return { growth: [b[0] - a[0], b[1] - a[1]], expected: SIDE.has(key) ? [0, 40] : [40, 0] };
    };
    window.aliases = { runtime, themes, selection, axisGrowth, snapshot(win) {
      const canvas = win.querySelector('canvas.scriptoscope-chrome'), composed = win._scriptoscopeComposed;
      return { selected: selection.at(-1), width: canvas?.width, height: canvas?.height, frame: composed?.frame,
        pixels: canvas?.toDataURL(), background: win.querySelector('.scriptoscope-content')?.style.cssText };
    } };
  }, mode);
}
for (const mode of ['source', 'built']) {
  test(`${mode}: canonical and raw collapsed identities select authored legacy windows before degradation`, async ({ page, servers }, testInfo) => {
    await setup(page, servers, mode);
    const observations = await page.evaluate(async pairs => {
      const f = window.aliases, results = [];
      for (const theme of f.themes) for (const pair of pairs) {
        if (!theme.manifest.windowTypes[pair.legacy]) continue;
        for (const state of ['active', 'inactive']) {
          const options = { width: 180, height: 0, title: 'Tools', state };
          const expected = f.snapshot(await f.runtime.renderWindow(theme, { ...options, windowType: pair.legacy }));
          for (const requested of [pair.canonical, `wnd-${pair.id}`]) {
            const actual = f.snapshot(await f.runtime.renderWindow(theme, { ...options, windowType: requested }));
            results.push({ owner: expected.selected.owner, requested, state, expectedKey: pair.legacy, actualKey: actual.selected.key, model: actual.selected.model,
              actualSize: [actual.width, actual.height], expectedSize: [expected.width, expected.height], samePixels: actual.pixels === expected.pixels,
              sameFrame: JSON.stringify(actual.frame) === JSON.stringify(expected.frame), sameBackground: actual.background === expected.background });
          }
        }
      }
      f.themes.forEach(t => t.dispose?.()); return results;
    }, pairs);
    await attachObservations(testInfo, 'window-aliases', `${mode}-direct`, { mode, observations });
    expect(observations).toHaveLength(36); // Nine variants: three types × three themes × two states × two spellings (#423).
    expect(observations.filter(r => r.actualKey !== r.expectedKey || !r.samePixels || !r.sameFrame || !r.sameBackground || String(r.actualSize) !== String(r.expectedSize))).toEqual([]);
  });

  test(`${mode}: WindowManager collapse preserves authored sliced and corner-sprite identities`, async ({ page, servers }, testInfo) => {
    await setup(page, servers, mode);
    const observations = await page.evaluate(async pairs => {
      const f = window.aliases, results = [];
      for (const theme of f.themes) for (const pair of pairs) {
        if (!theme.manifest.windowTypes[pair.legacy]) continue;
        // #617: the reference is the legacy collapsed type rendered collapsed at the expanded size.
        const expected = f.snapshot(await f.runtime.renderWindow(theme, { width: 180, height: 75, title: 'Tools', windowType: pair.legacy, collapsed: true }));
        const decoded = await f.axisGrowth(theme, pair.legacy);
        for (const base of [pair.base, `wnd-${pair.id - 4}`]) {
          const manager = new f.runtime.WindowManager();
          const host = await manager.add(theme, { width: 180, height: 75, title: 'Tools', windowType: base }, {}, { collapsed: true }); document.body.append(host);
          const actual = f.snapshot(host.shadowRoot.querySelector('.scriptoscope-window'));
          results.push({ owner: expected.selected.owner, base, expectedKey: pair.legacy, actualKey: actual.selected.key, model: actual.selected.model,
            collapsed: manager.describe(host).collapsed, actualSize: [actual.width, actual.height], expectedSize: [expected.width, expected.height], samePixels: actual.pixels === expected.pixels,
            decodedSize: decoded });
          manager.remove(host);
        }
      }
      f.themes.forEach(t => t.dispose?.()); return results;
    }, pairs);
    await attachObservations(testInfo, 'window-aliases', `${mode}-manager`, { mode, observations });
    expect(observations).toHaveLength(18);
    expect(observations.filter(r => r.actualKey !== r.expectedKey || !r.collapsed || !r.samePixels || String(r.actualSize) !== String(r.expectedSize))).toEqual([]);
    // Independent of the renderer: sliced collapsed sizes follow the title-axis rule from the decode.
    // Sliced collapsed windows empty the title axis's cross dimension only (window-widgets §2.1 C, HP48).
    expect(observations.filter(r => r.decodedSize && String(r.decodedSize.growth) !== String(r.decodedSize.expected))).toEqual([]);
    expect(observations.filter(r => r.decodedSize).length, 'sliced rows checked').toBeGreaterThan(0);
    expect(observations.filter(r => r.decodedSize && r.expectedKey === 'collapsed-side-utility').length, 'side-titled rows checked').toBeGreaterThan(0);
  });

  test(`${mode}: actual frame collapse and expansion restore authored geometry`, async ({ page, servers }, testInfo) => {
    await setup(page, servers, mode);
    const observations = await page.evaluate(async pairs => {
      const f = window.aliases, results = [];
      for (const theme of f.themes) for (const pair of pairs) {
        if (!theme.manifest.windowTypes[pair.legacy]) continue;
        const manager = new f.runtime.WindowManager();
        const host = await manager.add(theme, { width: 180, height: 75, title: 'Tools', windowType: pair.base });
        document.body.append(host);
        const expanded = f.snapshot(host.shadowRoot.querySelector('.scriptoscope-window'));
        const gesture = async () => {
          const win = host.shadowRoot.querySelector('.scriptoscope-window'), rect = win.getBoundingClientRect();
          const committed = new Promise(resolve => manager.setChangeListener(resolve));
          win.dispatchEvent(new MouseEvent('dblclick', { bubbles: true, clientX: rect.left + .25, clientY: rect.top + .25 }));
          await committed;
        };
        await gesture();
        const collapsed = f.snapshot(host.shadowRoot.querySelector('.scriptoscope-window'));
        const expected = f.snapshot(await f.runtime.renderWindow(theme, { width: 180, height: 75, title: 'Tools', windowType: pair.legacy, collapsed: true }));
        const decoded = await f.axisGrowth(theme, pair.legacy);
        const isCollapsed = manager.describe(host).collapsed;
        await gesture();
        const restored = f.snapshot(host.shadowRoot.querySelector('.scriptoscope-window'));
        results.push({ owner: expected.selected.owner, type: pair.base, collapsedKey: collapsed.selected.key,
          expectedKey: pair.legacy, isCollapsed, sameCollapsedPixels: collapsed.pixels === expected.pixels,
          sameExpandedPixels: restored.pixels === expanded.pixels, restoredHeight: manager.describe(host).height,
          decodedSize: decoded,
          restoredExpanded: !manager.describe(host).collapsed });
        manager.remove(host);
      }
      f.themes.forEach(t => t.dispose?.()); return results;
    }, pairs);
    await attachObservations(testInfo, 'window-aliases', `${mode}-gesture`, { mode, observations });
    expect(observations).toHaveLength(9);
    expect(observations.filter(r => r.collapsedKey !== r.expectedKey || !r.isCollapsed || !r.sameCollapsedPixels || !r.sameExpandedPixels || !r.restoredExpanded || r.restoredHeight !== 75)).toEqual([]);
    expect(observations.filter(r => r.decodedSize && String(r.decodedSize.growth) !== String(r.decodedSize.expected))).toEqual([]);
  });

  test(`${mode}: expanded-owner selection and exact conflicting aliases remain authoritative`, async ({ page, servers }, testInfo) => {
    await setup(page, servers, mode);
    const observations = await page.evaluate(async () => {
      const f = window.aliases, [beos, system7, childSource] = f.themes;
      const options = { width: 180, height: 0, title: 'Tools' }, results = [];
      const variants = {
        'collapsed-titled-utility-window': beos.manifest.windowTypes['collapsed-titled-utility'],
        'collapsed-titled-utility': system7.manifest.windowTypes['collapsed-titled-utility'],
        'wnd--14300': childSource.manifest.windowTypes['collapsed-titled-utility'],
      };
      // Keep owners' original absolute asset URLs; only the explicit window map
      // is synthetic here. The exact-key oracle is independently selected art.
      const conflict = { ...beos, manifest: { ...beos.manifest, windowTypes: variants } };
      for (const [key, value] of Object.entries(variants)) {
        const isolated = { ...conflict, manifest: { ...conflict.manifest, windowTypes: { 'collapsed-titled-utility': value } } };
        const expected = f.snapshot(await f.runtime.renderWindow(isolated, { ...options, windowType: 'collapsed-titled-utility' }));
        const actual = f.snapshot(await f.runtime.renderWindow(conflict, { ...options, windowType: key }));
        results.push({ case: key, selected: actual.selected.owner, expected: expected.selected.owner, samePixels: actual.pixels === expected.pixels });
      }
      for (const hasChildFrame of [true, false]) {
        const child = { ...childSource, base: system7, manifest: { ...childSource.manifest,
          windowTypes: hasChildFrame ? { 'document-window': childSource.manifest.windowTypes['document-window'] } : {} } };
        const expectedOwner = hasChildFrame ? childSource : system7;
        const expectedKey = hasChildFrame ? 'document-window' : 'collapsed-titled-utility';
        // #617: the manager collapses at the expanded size; the reference renders collapsed too.
        const collapsedOpts = { ...options, height: 75, collapsed: true };
        const expected = f.snapshot(await f.runtime.renderWindow(expectedOwner, { ...collapsedOpts, windowType: hasChildFrame ? 'titled-utility-window' : expectedKey }));
        // Reference child's retained fallback through the same public API, with
        // no base that could accidentally supply its collapsed art.
        if (hasChildFrame) Object.assign(expected, f.snapshot(await f.runtime.renderWindow({ ...child, base: undefined }, { ...collapsedOpts, windowType: 'titled-utility-window' })));
        const manager = new f.runtime.WindowManager();
        const host = await manager.add(child, { ...options, height: 75, windowType: 'titled-utility-window' }, {}, { collapsed: true });
        document.body.append(host);
        const actual = f.snapshot(host.shadowRoot.querySelector('.scriptoscope-window'));
        results.push({ case: hasChildFrame ? 'child-fallback-before-base' : 'empty-child-defers-to-base', selected: actual.selected.owner, expected: expected.selected.owner, samePixels: actual.pixels === expected.pixels, actualKey: actual.selected.key, expectedKey });
        manager.remove(host);
      }
      f.themes.forEach(t => t.dispose?.()); return results;
    });
    await attachObservations(testInfo, 'window-aliases', `${mode}-precedence`, { mode, observations });
    expect(observations).toHaveLength(5);
    expect(observations.filter(r => r.selected !== r.expected || !r.samePixels || (r.expectedKey && r.actualKey !== r.expectedKey))).toEqual([]);
  });


  test(`${mode}: raw utility identities retain titled and body-background policy`, async ({ page, servers }, testInfo) => {
    await setup(page, servers, mode);
    const observations = await page.evaluate(async pairs => {
      const f = window.aliases, results = [];
      for (const theme of f.themes) for (const pair of pairs) for (const state of ['active', 'inactive']) {
        const options = { width: 180, height: 75, title: 'Alias Title', state };
        const expected = f.snapshot(await f.runtime.renderWindow(theme, { ...options, windowType: pair.base }));
        const actual = f.snapshot(await f.runtime.renderWindow(theme, { ...options, windowType: `wnd-${pair.id - 4}` }));
        results.push({ owner: expected.selected.owner, type: pair.base, state,
          sameSelection: actual.selected.key === expected.selected.key, samePixels: actual.pixels === expected.pixels,
          sameBackground: actual.background === expected.background });
      }
      f.themes.forEach(t => t.dispose?.()); return results;
    }, pairs);
    await attachObservations(testInfo, 'window-aliases', `${mode}-utility-policy`, { mode, observations });
    expect(observations).toHaveLength(18);
    expect(observations.filter(r => !r.sameSelection || !r.samePixels || !r.sameBackground)).toEqual([]);
  });


  test(`${mode}: inactive-only authored windows retain public widget lookup and manager overlays`, async ({ page, servers }) => {
    await setup(page, servers, mode);
    const result = await page.evaluate(async () => {
      const f = window.aliases, theme = f.themes[0], original = theme.manifest.windowTypes['document-window'];
      const inactiveType = { ...original, chrome: { inactive: original.chrome.inactive } };
      const inactive = { ...theme, manifest: { ...theme.manifest, windowTypes: { 'document-window': inactiveType } } };
      const options = { width: 180, height: 75, state: 'inactive' };
      const rendered = await f.runtime.renderWindow(inactive, options), composed = rendered._scriptoscopeComposed;
      const expected = f.runtime.titleWidgetHits(theme, 'document-window', composed, 1);
      const implicit = f.runtime.titleWidgetHits(inactive, 'document-window', composed, 1);
      const explicit = f.runtime.titleWidgetHits(inactive, 'wnd--14336', composed, 1, 'inactive');
      const manager = new f.runtime.WindowManager();
      const host = await manager.add(inactive, options, { onClose() {}, onZoom() {}, onCollapse() {} });
      document.body.append(host);
      const overlays = [...host.shadowRoot.querySelectorAll('.scriptoscope-titlewidget')].map(el => el.className.match(/scriptoscope-titlewidget-(\w+)/)[1]);
      manager.remove(host); f.themes.forEach(t => t.dispose?.());
      return { expected, implicit, explicit, overlays };
    });
    expect(result.expected.length).toBeGreaterThan(0);
    expect(result.implicit).toEqual(result.expected);
    expect(result.explicit).toEqual(result.expected);
    expect(result.overlays.sort()).toEqual(result.expected.map(hit => hit.role).sort());
  });

}
