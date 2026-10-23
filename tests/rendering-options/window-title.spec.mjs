import { existsSync } from 'node:fs';
import { test, expect, openHarness, attachObservations } from './fixtures.mjs';
import { SLICED } from './window-chrome-rules.mjs';

// Title text of wnd# windows through public renderWindow (source and built), against the
// decoded title rect and clip (window-widgets TX3, TX4, TX8) and DECISIONS #13 / F11:
//   A. the plate fits the text as drawn (TT2a default SWc = SW): ink inside the code-5 plate;
//   B. the baseline moves down by the font overflow: no glyph row is clipped at the top and
//      no ink falls below the title rect, on the short titled-utility bars;
//   C. the decoded clip is kept (not widened): no ink outside t4p widened by 2 on the right.
// Ink is measured with window-title-rules.mjs against the recomposed text-free chrome.
const archives = Object.fromEntries(SLICED.map(slug => [slug, ['scheme.sit', 'scheme.rsrc']
  .find(f => existsSync(new URL(`../../themes/${slug}/${f}`, import.meta.url)))]));
const PLATE = ['evolution', 'dolphin-som', 'beos-r503'];
const TOPS = ['1990', 'windows-95', '1984', 'floppies', 'windows-31'];
const TITLES = ['Tools', 'Hdgy Window Title', 'A much longer window title that will not fit'];
for (const mode of ['source', 'built']) {
  test(`${mode}: title ink stays in its plate, keeps every glyph row and never leaves the decoded clip`, async ({ page, servers }, info) => {
    test.setTimeout(300_000);
    info.annotations.push({ type: 'fidelity-assertion', description: 'window.title-fit' });
    await openHarness(page, servers, mode);
    const rows = await page.evaluate(async ({ mode, archives, TITLES, PLATE, TOPS }) => {
      const api = await import(mode === 'built' ? '/dist/scriptoscope.js' : '/src/index.ts');
      const R = await import('/tests/rendering-options/window-title-rules.mjs');
      const out = [];
      for (const [slug, file] of Object.entries(archives)) {
        const d = await api.loadKaleidoscopeScheme(new Uint8Array(await (await fetch(`/themes/${slug}/${file}`)).arrayBuffer()), { encodeAssets: false });
        const theme = await api.loadTheme(`/themes/${slug}`);
        for (const key of ['document-window', 'titled-utility-window']) {
          const wt = d.manifest.windowTypes[key];
          if (!wt) continue;
          const [l, , r] = wt.parts['part-0'].rect;
          for (const state of ['active', 'inactive']) {
            const a = d.assets.find(x => x.path === wt.chrome[state]), cicn = new api.PixelBuffer(a.width, a.height, new Uint8ClampedArray(a.rgba));
            const widths = PLATE.includes(slug) ? [r - l, r - l + 40, 240] : [240];
            for (const width of widths) for (const title of TITLES) {
              const win = await api.renderWindow(theme, { title, width, height: 120, windowType: key, state });
              const c = win._scriptoscopeComposed;
              const tf = R.textFreeChrome(api.composeWindowChrome, cicn, wt, c, { titleLength: title.length });
              const ink = tf ? R.inkPixels(c.buffer, tf.buffer) : null;
              out.push({ slug, key, state, width, title, matched: !!tf, t4p: c.titleRect, plate: R.plateOf(c), n: ink?.length ?? 0, box: ink && R.bbox(ink),
                outsideClip: ink && c.titleRect ? R.inside(ink, R.decodedClip(c.titleRect)).length : null,
                // DECISIONS #13 (1): the plate fits the text as drawn, so no ink lands past the
                // code-5 cell (the decoded TX4 clip is 2 px wider than t4p; it must not carry the
                // text onto the bezel).
                outsidePlate: ink && R.plateOf(c) ? R.inside(ink, R.plateOf(c)).length : null });
            }
          }
        }
        theme.dispose?.();
      }
      return out;
    }, { mode, archives, TITLES, PLATE, TOPS });
    await attachObservations(info, 'window-title', mode, { mode, rows });
    // Every rendered title was isolated and drew ink.
    for (const row of rows) {
      const label = `${row.slug} ${row.key} ${row.state} ${row.width} "${row.title}"`;
      expect.soft(row.matched, `${label}: text-free chrome`).toBe(true);
      // At 240 px every sampled window has room; narrower plates may drop the title (TT3).
      if (row.width === 240) expect.soft(row.n, `${label}: ink`).toBeGreaterThan(0);
      // C: TX4's clip is the decoded one.
      expect.soft(row.outsideClip, `${label}: ink outside t4p widened by 2 (${JSON.stringify(row.t4p)} vs ${JSON.stringify(row.box)})`).toBe(0);
    }
    expect(rows.filter(r => r.n > 0).length).toBeGreaterThan(rows.length * 0.8);
    // A: the plate fits the drawn text.
    const plateRows = rows.filter(r => PLATE.includes(r.slug));
    expect(plateRows.length).toBe(PLATE.length * 2 * 2 * 3 * TITLES.length);
    for (const row of plateRows) expect.soft(row.outsidePlate, `${row.slug} ${row.key} ${row.state} ${row.width} "${row.title}": ink outside the plate ${JSON.stringify(row.plate)} vs ${JSON.stringify(row.box)}`).toBe(0);
    // B: every glyph row is drawn on the short titled-utility bars. The reference is the same
    // title in the same theme's document window, whose title rect is taller than the glyphs
    // (the runtime's title raster does not depend on the window type).
    for (const slug of TOPS) for (const state of ['active', 'inactive']) for (const title of TITLES) {
      const ref = rows.find(r => r.slug === slug && r.key === 'document-window' && r.state === state && r.title === title);
      const row = rows.find(r => r.slug === slug && r.key === 'titled-utility-window' && r.state === state && r.title === title);
      const label = `${slug} ${state} "${title}"`;
      expect.soft(ref.box.t > ref.t4p.y && ref.box.b < ref.t4p.y + ref.t4p.h, `${label}: the reference is unclipped`).toBe(true);
      expect.soft(row.box.b - row.box.t, `${label}: glyph rows drawn`).toBe(ref.box.b - ref.box.t);
      expect.soft(row.box.t >= row.t4p.y && row.box.b <= row.t4p.y + row.t4p.h, `${label}: ink inside the title rect rows`).toBe(true);
    }
  });
}
