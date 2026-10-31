import { test, expect, openHarness } from './fixtures.mjs';

// #589: a disposed eager theme must reject every renderer with AbortError in every
// browser. Firefox serves revoked blob: URLs it already decoded, and a custom factory's
// data: URLs are never revoked, so only the theme lifetime can stop composition.
for (const mode of ['source', 'built']) for (const factory of ['default', 'custom']) {
  test(`${mode}: eager ${factory}-factory theme rejects composition after dispose`, async ({ page, servers }) => {
    await openHarness(page, servers, mode);
    const result = await page.evaluate(async ({ mode, factory }) => {
      const api = await import(mode === 'source' ? '/src/index.ts' : '/dist/scriptoscope.js');
      const theme = factory === 'default' ? await api.loadTheme('/themes/windows-95')
        : await api.loadKaleidoscopeScheme(new Uint8Array(await (await fetch('/themes/windows-95/scheme.sit')).arrayBuffer()), {
          assetUrlFactory: (rgba, w, h) => {
            const c = document.createElement('canvas'); c.width = w; c.height = h;
            c.getContext('2d').putImageData(new ImageData(new Uint8ClampedArray(rgba), w, h), 0, 0);
            return c.toDataURL();
          },
        });
      const copy = { ...theme };
      const opts = { label: 'OK', minWidth: 60, height: 20 };
      const manager = new api.WindowManager();
      const paths = {
        composeButton: t => api.composeButton(t, opts),
        renderWindow: t => api.renderWindow(t, { title: 'Disposed', width: 80, height: 40 }),
        interactiveButton: t => api.interactiveButton(t, opts),
        windowManager: async t => { const host = await manager.add(t, { title: 'Disposed', width: 80, height: 40 }); manager.remove(host); return host; },
        spreadCopy: t => api.composeButton(copy, opts),
      };
      const before = {};
      for (const [name, run] of Object.entries(paths)) before[name] = !!(await run(theme));
      theme.dispose();
      const after = {};
      for (const [name, run] of Object.entries(paths)) after[name] = await run(theme).then(() => 'resolved', e => e?.name ?? String(e));
      return { before, after };
    }, { mode, factory });
    for (const value of Object.values(result.before)) expect(value).toBe(true);
    expect(result.after).toEqual({ composeButton: 'AbortError', renderWindow: 'AbortError', interactiveButton: 'AbortError', windowManager: 'AbortError', spreadCopy: 'AbortError' });
  });
}
