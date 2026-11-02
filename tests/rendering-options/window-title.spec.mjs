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
// The final descender is beyond the truncated prefix: TF3 must resolve the full
// requested title, rather than choosing a larger style after truncation.
const DESCENDER_TAIL = `Tools ${'WINDOW '.repeat(12)}g`;
const TITLES = ['Tools', 'Hdgy Window Title', 'A much longer window title that will not fit', DESCENDER_TAIL];
for (const mode of ['source', 'built']) {
  test(`${mode}: title ink stays in its plate, keeps every glyph row and never leaves the decoded clip`, async ({ page, servers }, info) => {
    test.setTimeout(300_000);
    info.annotations.push({ type: 'fidelity-assertion', description: 'window.title-fit' });
    await openHarness(page, servers, mode);
    const rows = await page.evaluate(async ({ mode, archives, TITLES, PLATE }) => {
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
              CanvasRenderingContext2D.prototype.fillText = function (text, ...args) { calls.push({ text, font: this.font }); return fillText.call(this, text, ...args); };
              let win;
              try { win = await api.renderWindow(theme, { title, width, height: 120, windowType: key, state }); }
              finally { CanvasRenderingContext2D.prototype.fillText = fillText; }
              const displayed = calls.at(-1)?.text;
              const c = win._scriptoscopeComposed;
              const tf = R.textFreeChrome(api.composeWindowChrome, cicn, wt, c, { titleLength: title.length });
              const ink = tf ? R.inkPixels(c.buffer, tf.buffer) : null;
              const clipHeight = R.topTitleHeight(wt);
              const style = R.resolveTitleStyle(title, key, clipHeight);
              const reference = displayed ? R.titleReference(displayed, style) : null;
              const plate = R.plateOf(c), room = c.titleRect && plate ? Math.min(c.titleRect.w + 2, Math.max(plate.x + plate.w - c.titleRect.x, c.titleRect.w)) : 0;
              out.push({ slug, key, state, width, title, displayed, font: calls.at(-1)?.font, observedStyle: R.titleFontStyle(calls.at(-1)?.font), style, reference,
                expectedDisplayed: R.fittedTitle(title, style, room), expectedHeight: clipHeight,
                prefixOnlySize: displayed ? R.resolveTitleStyle(displayed, key, clipHeight).size : null,
                matched: !!tf, t4p: c.titleRect, plate, n: ink?.length ?? 0, box: ink && R.bbox(ink),
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
    }, { mode, archives, TITLES, PLATE });
    await attachObservations(info, 'window-title', mode, { mode, rows });
    // Every rendered title was isolated and drew ink.
    for (const row of rows) {
      const label = `${row.slug} ${row.key} ${row.state} ${row.width} "${row.title}"`;
      expect.soft(row.matched, `${label}: text-free chrome`).toBe(true);
      if (row.n > 0) {
        expect.soft(row.t4p.h, `${label}: unchanged recipe title height`).toBe(row.expectedHeight);
        expect.soft(row.observedStyle, `${label}: independently resolved face and size`).toEqual(row.reference.fontStyle);
        expect.soft(row.displayed, `${label}: TF1 longest fitting title at the resolved style`).toBe(row.expectedDisplayed);
      }
      // At 240 px every sampled window has room; narrower plates may drop the title (TT3).
      if (row.width === 240) expect.soft(row.n, `${label}: ink`).toBeGreaterThan(0);
      // C: TX4's clip is the decoded one.
      expect.soft(row.outsideClip, `${label}: ink outside t4p widened by 2 (${JSON.stringify(row.t4p)} vs ${JSON.stringify(row.box)})`).toBe(0);
    }
    expect(rows.filter(r => r.n > 0).length).toBeGreaterThan(rows.length * 0.8);
    expect(rows.some(r => r.title === DESCENDER_TAIL && r.key === 'titled-utility-window' && r.displayed !== r.title && r.style.size < r.prefixOnlySize),
      'TF3 calibration: resolving only the truncated prefix would select a larger, wrong style').toBe(true);
    // A: the plate fits the drawn text.
    const plateRows = rows.filter(r => PLATE.includes(r.slug));
    expect(plateRows.length).toBe(PLATE.length * 2 * 2 * 3 * TITLES.length);
    // Ellipsis-only obeys TX4 even when the marker exceeds room; TF1 does not widen the clip.
    for (const row of plateRows.filter(r => r.displayed !== '…')) expect.soft(row.outsidePlate, `${row.slug} ${row.key} ${row.state} ${row.width} "${row.title}": ink outside the plate ${JSON.stringify(row.plate)} vs ${JSON.stringify(row.box)}`).toBe(0);
    // B: preserve every glyph row on ordinary and short utility bars, against an
    // unclipped browser raster with the face required by PM1 + TT2/TX5/TX9.
    for (const row of rows.filter(r => TOPS.includes(r.slug))) {
      const ref = row.reference;
      const label = `${row.slug} ${row.key} ${row.state} "${row.title}"`;
      expect(ref?.unclipped, `${label}: independent reference is unclipped`).toBe(true);
      expect.soft(row.box.b - row.box.t, `${label}: ${ref.face} glyph rows drawn`).toBe(ref.box.b - ref.box.t);
      expect.soft(row.box.t >= row.t4p.y && row.box.b <= row.t4p.y + row.t4p.h, `${label}: ink inside the title rect rows`).toBe(true);
    }
  });
}

// Negative calibration at the browser font boundary, with no runtime edits.
// Reload between cases so a cached glyph cannot conceal the forced wrong face.
for (const mode of ['source', 'built']) {
  test(`${mode}: title references reject the opposite face for utility and ordinary windows`, async ({ page, servers }, info) => {
    const rows = [];
    for (const key of ['document-window', 'titled-utility-window']) for (const mutated of [false, true]) {
      await openHarness(page, servers, mode);
      rows.push(await page.evaluate(async ({ mode, file, key, mutated }) => {
        const api = await import(mode === 'built' ? '/dist/scriptoscope.js' : '/src/index.ts');
        const R = await import('/tests/rendering-options/window-title-rules.mjs');
        const theme = await api.loadTheme('/themes/1984');
        const decoded = await api.loadKaleidoscopeScheme(new Uint8Array(await (await fetch(`/themes/1984/${file}`)).arrayBuffer()), { encodeAssets: false });
        R.isolateGlyphs(theme);
        const wt = decoded.manifest.windowTypes[key], title = 'Tools';
        const clipHeight = R.topTitleHeight(wt);
        const required = R.resolveTitleStyle(title, key, clipHeight);
        const opposite = required.face === 'bold' ? 'normal' : 'bold';
        const wrong = R.resolveTitleStyle(title, key, clipHeight, { face: opposite });
        const reference = R.titleReference(title, required), wrongReference = R.titleReference(title, wrong);
        // README declares Virtue fallback; the harness loads it as Charcoal.
        // The marker is absent from Charcoal 12's cmap (font-coverage receipt).
        const marker = R.titleReference('…', required);
        const markerContext = document.createElement('canvas').getContext('2d');
        markerContext.font = `${required.face} ${required.size}px Charcoal`;
        const fallbackMarkerAdvance = Math.ceil(markerContext.measureText('…').width);
        const fontDescriptor = Object.getOwnPropertyDescriptor(CanvasRenderingContext2D.prototype, 'font');
        const fillText = CanvasRenderingContext2D.prototype.fillText;
        let observedFont, c;
        try {
          CanvasRenderingContext2D.prototype.fillText = function (text, ...args) {
            observedFont = this.font;
            return fillText.call(this, text, ...args);
          };
          if (mutated) Object.defineProperty(CanvasRenderingContext2D.prototype, 'font', {
            ...fontDescriptor,
            set(value) {
              const sizeAndFamily = value.match(/\d+(?:\.\d+)?px\s+.+$/)?.[0];
              fontDescriptor.set.call(this, sizeAndFamily ? `${opposite} ${sizeAndFamily}` : value);
            },
          });
          c = (await api.renderWindow(theme, { title, width: 240, height: 120, windowType: key }))._scriptoscopeComposed;
        } finally {
          Object.defineProperty(CanvasRenderingContext2D.prototype, 'font', fontDescriptor);
          CanvasRenderingContext2D.prototype.fillText = fillText;
          theme.dispose?.();
        }
        const a = decoded.assets.find(x => x.path === wt.chrome.active);
        const cicn = new api.PixelBuffer(a.width, a.height, new Uint8ClampedArray(a.rgba));
        const tf = R.textFreeChrome(api.composeWindowChrome, cicn, wt, c, { titleLength: title.length });
        if (!tf) throw new Error('Negative calibration has no matching text-free chrome');
        const box = R.bbox(R.inkPixels(c.buffer, tf.buffer));
        const extent = ref => [ref.advance, ref.box.r - ref.box.l, ref.box.b - ref.box.t];
        return { key, mutated, observedFont, observedStyle: R.titleFontStyle(observedFont), reference, wrongReference,
          marker, fallbackMarkerAdvance,
          actual: [tf.SW, box.r - box.l, box.b - box.t], required: extent(reference), opposite: extent(wrongReference) };
      }, { mode, file: archives['1984'], key, mutated }));
    }
    await attachObservations(info, 'window-title', `${mode}-wrong-face`, { mode, rows });
    expect(rows).toHaveLength(4);
    for (const row of rows) {
      const label = `${row.key} mutated=${row.mutated}`;
      expect(row.reference.unclipped, label).toBe(true);
      expect(row.wrongReference.unclipped, label).toBe(true);
      expect(row.marker.advance, `${label}: ellipsis uses the declared Virtue fallback`).toBe(row.fallbackMarkerAdvance);
      expect(row.required, `${label}: references discriminate opposite faces`).not.toEqual(row.opposite);
      if (row.mutated) {
        expect(row.observedStyle, `${label}: face mutation reached the painter`).toEqual(row.wrongReference.fontStyle);
        expect(row.actual, `${label}: wrong-face mutant rejected`).not.toEqual(row.required);
        expect(row.actual, `${label}: mutant actually draws the opposite face`).toEqual(row.opposite);
      } else {
        expect(row.observedStyle, `${label}: required face accepted`).toEqual(row.reference.fontStyle);
        expect(row.actual, `${label}: required glyph extent accepted`).toEqual(row.required);
        expect(row.actual, `${label}: wrong reference rejected`).not.toEqual(row.opposite);
      }
    }
  });
}

// D. A title that fits its title rect is drawn whole (TX5; DECISIONS #13 (1) as amended by #455:
// the truncation room is capped at the plate but never below the title rect's width). When the
// side has room, TT6/TT7 leave the remapped title rect exactly SW wide (window-widgets §5
// "Title rect"), so TX5's room t4p.w + 2 exceeds SW and nothing is truncated. On floppies (all
// titled types) and 1138 titled-utility the code-5 plate is 1–2 px narrower than t4p, which a
// plate-only cap turns into a room below SW. Whole-title widths and glyph rows come
// from an unclipped browser raster, independently set to bold for utility types
// and plain for ordinary types (PM1 + TT2/TX5/TX9).
const WHOLE = SLICED.flatMap(slug => ['document-window', 'titled-utility-window'].map(key => [slug, key]));
const SHORT = ['Controls', 'Document', 'Tools'];
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
            CanvasRenderingContext2D.prototype.fillText = function (text, ...args) { calls.push({ text, font: this.font }); return fillText.call(this, text, ...args); };
            let c;
            try { c = (await api.renderWindow(themes[slug], { title, width: 240, height: 120, windowType: key, state }))._scriptoscopeComposed; }
            finally { CanvasRenderingContext2D.prototype.fillText = fillText; }
            const tf = R.textFreeChrome(api.composeWindowChrome, cicn, wt, c, { titleLength: title.length });
            const ink = tf ? R.inkPixels(c.buffer, tf.buffer) : [];
            const clipHeight = R.topTitleHeight(wt);
            const style = R.resolveTitleStyle(title, key, clipHeight);
            const reference = R.titleReference(title, style);
            out.push({ slug, key, state, title, displayed: calls.at(-1)?.text, font: calls.at(-1)?.font, observedStyle: R.titleFontStyle(calls.at(-1)?.font), style, reference,
              expectedHeight: clipHeight, SW: tf?.SW ?? null, t4p: c.titleRect, plate: R.plateOf(c), box: R.bbox(ink),
              outsideClip: c.titleRect ? R.inside(ink, R.decodedClip(c.titleRect)).length : null });
          }
        }
      }
      Object.values(themes).forEach(t => t.dispose?.());
      return out;
    }, { mode, archives, cases: WHOLE, titles: SHORT });
    await attachObservations(info, 'window-title', `${mode}-whole`, { mode, rows });
    const width = r => r.box ? r.box.r - r.box.l : 0;
    expect(rows).toHaveLength(WHOLE.length * 2 * SHORT.length);
    for (const row of rows) {
      const ref = row.reference;
      const label = `${row.slug} ${row.key} ${row.state} "${row.title}"`;
      expect(ref.unclipped, `${label}: independent reference is unclipped`).toBe(true);
      expect(width(ref), `${label}: reference ink`).toBeGreaterThan(0);
      expect.soft(row.t4p.h, `${label}: unchanged recipe title height`).toBe(row.expectedHeight);
      expect.soft(row.observedStyle, `${label}: independently resolved face and size`).toEqual(ref.fontStyle);
      expect.soft(row.displayed, `${label}: fitting title remains whole`).toBe(row.title);
      expect.soft(row.t4p.w, `${label}: t4p is SW wide (§5)`).toBe(row.SW);
      expect.soft(row.SW, `${label}: ${ref.face} measured width`).toBe(ref.advance);
      expect.soft(width(row), `${label}: drawn whole (ink ${JSON.stringify(row.box)}, plate ${JSON.stringify(row.plate)}, t4p ${JSON.stringify(row.t4p)})`).toBe(width(ref));
      expect.soft(row.box.b - row.box.t, `${label}: ${ref.face} glyph rows drawn`).toBe(ref.box.b - ref.box.t);
      expect.soft(row.outsideClip, `${label}: inside the decoded clip`).toBe(0);
    }
  });
}
