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
        R.isolateGlyphs(theme);
        for (const key of ['document-window', 'titled-utility-window']) {
          const wt = d.manifest.windowTypes[key];
          if (!wt) continue;
          const [l, , r] = wt.parts['part-0'].rect;
          for (const state of ['active', 'inactive']) {
            const a = d.assets.find(x => x.path === wt.chrome[state]), cicn = new api.PixelBuffer(a.width, a.height, new Uint8ClampedArray(a.rgba));
            const widths = PLATE.includes(slug) ? [r - l, r - l + 40, 240] : [240];
            for (const width of widths) for (const title of TITLES) {
              const calls = [], fillText = CanvasRenderingContext2D.prototype.fillText;
              CanvasRenderingContext2D.prototype.fillText = function (text, ...args) { calls.push(text); return fillText.call(this, text, ...args); };
              const win = await api.renderWindow(theme, { title, width, height: 120, windowType: key, state });
              CanvasRenderingContext2D.prototype.fillText = fillText;
              const displayed = calls.at(-1);
              const c = win._scriptoscopeComposed;
              const tf = R.textFreeChrome(api.composeWindowChrome, cicn, wt, c, { titleLength: title.length });
              const ink = tf ? R.inkPixels(c.buffer, tf.buffer) : null;
              out.push({ slug, key, state, width, title, displayed, matched: !!tf, t4p: c.titleRect, plate: R.plateOf(c), n: ink?.length ?? 0, box: ink && R.bbox(ink),
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
    // Ellipsis-only obeys TX4 even when the marker exceeds room; TF1 does not widen the clip.
    for (const row of plateRows.filter(r => r.displayed !== '…')) expect.soft(row.outsidePlate, `${row.slug} ${row.key} ${row.state} ${row.width} "${row.title}": ink outside the plate ${JSON.stringify(row.plate)} vs ${JSON.stringify(row.box)}`).toBe(0);
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

// D. A title that fits its title rect is drawn whole (TX5; DECISIONS #13 (1) as amended by #455:
// the truncation room is capped at the plate but never below the title rect's width). When the
// side has room, TT6/TT7 leave the remapped title rect exactly SW wide (window-widgets §5
// "Title rect"), so TX5's room t4p.w + 2 exceeds SW and nothing is truncated. On floppies (all
// titled types) and 1138 titled-utility the code-5 plate is 1–2 px narrower than t4p, which a
// plate-only cap turns into a room below SW. The whole title's ink width comes from a window
// that cannot truncate it: 1984's document window, whose plate ends at or past t4p (the
// runtime's title raster does not depend on the theme or the window type).
const WHOLE = SLICED.flatMap(slug => ['document-window', 'titled-utility-window'].map(key => [slug, key]));
const SHORT = ['Controls', 'Document', 'Tools'];
const REFERENCE = ['1984', 'document-window'];
for (const mode of ['source', 'built']) {
  test(`${mode}: titles that fit their title rect remain whole across all 13 sliced archives`, async ({ page, servers }, info) => {
    info.annotations.push({ type: 'fidelity-assertion', description: 'window.title-fit' });
    await openHarness(page, servers, mode);
    const rows = await page.evaluate(async ({ mode, archives, cases, titles }) => {
      const api = await import(mode === 'built' ? '/dist/scriptoscope.js' : '/src/index.ts');
      const R = await import('/tests/rendering-options/window-title-rules.mjs');
      const out = [], decoded = {}, themes = {};
      for (const [slug, key] of cases) {
        decoded[slug] ??= await api.loadKaleidoscopeScheme(new Uint8Array(await (await fetch(`/themes/${slug}/${archives[slug]}`)).arrayBuffer()), { encodeAssets: false });
        themes[slug] ??= await api.loadTheme(`/themes/${slug}`);
        R.isolateGlyphs(themes[slug]);
        const wt = decoded[slug].manifest.windowTypes[key];
        for (const state of ['active', 'inactive']) {
          const a = decoded[slug].assets.find(x => x.path === wt.chrome[state]), cicn = new api.PixelBuffer(a.width, a.height, new Uint8ClampedArray(a.rgba));
          for (const title of titles) {
            const calls = [], fillText = CanvasRenderingContext2D.prototype.fillText;
            CanvasRenderingContext2D.prototype.fillText = function (text, ...args) { calls.push(text); return fillText.call(this, text, ...args); };
            let c;
            try { c = (await api.renderWindow(themes[slug], { title, width: 240, height: 120, windowType: key, state }))._scriptoscopeComposed; }
            finally { CanvasRenderingContext2D.prototype.fillText = fillText; }
            const tf = R.textFreeChrome(api.composeWindowChrome, cicn, wt, c, { titleLength: title.length });
            const ink = tf ? R.inkPixels(c.buffer, tf.buffer) : [];
            out.push({ slug, key, state, title, displayed: calls.at(-1), SW: tf?.SW ?? null, t4p: c.titleRect, plate: R.plateOf(c), box: R.bbox(ink),
              outsideClip: c.titleRect ? R.inside(ink, R.decodedClip(c.titleRect)).length : null });
          }
        }
      }
      Object.values(themes).forEach(t => t.dispose?.());
      return out;
    }, { mode, archives, cases: [REFERENCE, ...WHOLE], titles: SHORT });
    await attachObservations(info, 'window-title', `${mode}-whole`, { mode, rows });
    const width = r => r.box ? r.box.r - r.box.l : 0;
    for (const title of SHORT) for (const state of ['active', 'inactive']) {
      const ref = rows.find(r => r.slug === REFERENCE[0] && r.key === REFERENCE[1] && r.state === state && r.title === title);
      // The reference cannot truncate: t4p is SW wide and the plate reaches past t4p.
      expect(ref.t4p.w, `reference ${title}`).toBe(ref.SW);
      expect(ref.plate.x + ref.plate.w >= ref.t4p.x + ref.t4p.w, `reference ${title}: plate reaches t4p`).toBe(true);
      expect(width(ref), `reference ${title}: ink`).toBeGreaterThan(0);
      for (const [slug, key] of WHOLE) {
        const row = rows.find(r => r.slug === slug && r.key === key && r.state === state && r.title === title);
        const label = `${slug} ${key} ${state} "${title}"`;
        expect.soft(row.displayed, `${label}: fitting title remains whole`).toBe(title);
        expect.soft(row.t4p.w, `${label}: t4p is SW wide (§5)`).toBe(row.SW);
        expect.soft(row.SW, `${label}: same measured width as the reference`).toBe(ref.SW);
        expect.soft(width(row), `${label}: drawn whole (ink ${JSON.stringify(row.box)}, plate ${JSON.stringify(row.plate)}, t4p ${JSON.stringify(row.t4p)})`).toBe(width(ref));
        expect.soft(row.outsideClip, `${label}: inside the decoded clip`).toBe(0);
      }
    }
  });
}
