import { test, expect, openHarness, attachObservations } from './fixtures.mjs';

// #637: full-request fallback ink, including faint nonzero-alpha cedilla rows.
// Independent rules remain unchanged; no platform-specific expected pixel size.
const TITLE = `Tools ${'WINDOW '.repeat(12)}Ç`;
for (const mode of ['source', 'built']) {
  test(`${mode}: cedilla full-request style preserves ink at the decoded baseline`, async ({ page, servers }, info) => {
    await openHarness(page, servers, mode);
    const rows = await page.evaluate(async ({ mode, title }) => {
      const api = await import(mode === 'built' ? '/dist/scriptoscope.js' : '/src/index.ts');
      const R = await import('/tests/rendering-options/window-title-rules.mjs');
      const decoded = await api.loadKaleidoscopeScheme(new Uint8Array(await (await fetch('/themes/1984/scheme.sit')).arrayBuffer()), { encodeAssets: false });
      const rows = [];
      for (const key of ['document-window', 'titled-utility-window']) for (const width of [240, 1200]) {
        const theme = await api.loadTheme('/themes/1984'); R.isolateGlyphs(theme);
        const wt = decoded.manifest.windowTypes[key], height = R.topTitleHeight(wt);
        const style = R.resolveTitleStyle(title, key, height);
        const calls = [], fill = CanvasRenderingContext2D.prototype.fillText;
        let win;
        try {
          CanvasRenderingContext2D.prototype.fillText = function (text, ...args) {
            calls.push({ text, font: this.font, args }); return fill.call(this, text, ...args);
          };
          win = await api.renderWindow(theme, { title, width, height: 120, windowType: key, state: 'active' });
        } finally { CanvasRenderingContext2D.prototype.fillText = fill; }
        const c = win._scriptoscopeComposed, plate = R.plateOf(c), t4p = c.titleRect;
        const a = decoded.assets.find(a => a.path === wt.chrome.active);
        const tf = R.textFreeChrome(api.composeWindowChrome, new api.PixelBuffer(a.width, a.height, new Uint8ClampedArray(a.rgba)), wt, c, { titleLength: title.length, maxSW: 2400 });
        const ink = tf ? R.inkPixels(c.buffer, tf.buffer) : [], drawn = calls.at(-1);
        const room = Math.min(t4p.w + 2, Math.max(plate.x + plate.w - t4p.x, t4p.w));
        const expected = R.fittedTitle(title, style, room), reference = R.titleReference(expected, style);
        const nominalContext = document.createElement('canvas').getContext('2d'); nominalContext.font = reference.font;
        const displayedMetrics = nominalContext.measureText(expected);
        const displayedNominalAscent = Math.max(1, Math.ceil(displayedMetrics.actualBoundingBoxAscent || style.size * .72));
        const publicationBaseline = Math.max(height - 4, displayedNominalAscent);
        // Actual painter font is diagnostic only, never an input to expected style.
        const actualReference = R.titleReference(title, R.titleFontStyle(drawn.font));
        rows.push({ key, width, title, height, style, drawn, observedStyle: R.titleFontStyle(drawn.font),
          expected, reference, actualReference, displayedNominalAscent, publicationBaseline,
          fitBaseline: style.baseline, t4p, plate, matched: !!tf, box: R.bbox(ink),
          outsideClip: R.inside(ink, R.decodedClip(t4p)).length, outsidePlate: R.inside(ink, plate).length,
          accessibleName: win.getAttribute('aria-label') });
        theme.dispose?.();
      }
      return rows;
    }, { mode, title: TITLE });
    await attachObservations(info, 'window-title-ink', mode, { mode, rows });
    expect(rows).toHaveLength(4);
    for (const row of rows) {
      const label = `${row.key} width=${row.width}`;
      expect.soft(row.matched, label).toBe(true);
      expect.soft(row.style.reference.unclipped, label).toBe(true);
      expect.soft(row.reference.unclipped, label).toBe(true);
      expect.soft(row.observedStyle, `${label}: full-request family/face/size`).toEqual(row.reference.fontStyle);
      expect.soft(row.drawn.text, `${label}: longest fitting prefix`).toBe(row.expected);
      expect.soft(row.t4p.h, `${label}: unchanged decoded clip`).toBe(row.height);
      expect.soft(row.box?.t, `${label}: every top ink row at unchanged publication baseline`).toBe(row.t4p.y + row.publicationBaseline + row.reference.box.t);
      expect.soft(row.box?.b, `${label}: every bottom ink row at unchanged publication baseline`).toBe(row.t4p.y + row.publicationBaseline + row.reference.box.b);
      const actualBaseline = Math.max(row.t4p.h - 4, row.actualReference.ascent);
      expect.soft(actualBaseline + row.actualReference.fullBox.t, `${label}: actual font retains faint full-request top row`).toBeGreaterThanOrEqual(0);
      expect.soft(actualBaseline + row.actualReference.fullBox.b, `${label}: actual font retains full-request bottom row`).toBeLessThanOrEqual(row.t4p.h);
      if (row.width === 1200) {
        expect.soft(row.drawn.text, `${label}: wide request remains whole`).toBe(TITLE);
        expect.soft(row.box?.r - row.box?.l, `${label}: complete glyph width`).toBe(row.reference.box.r - row.reference.box.l);
      }
      expect.soft(row.outsideClip, label).toBe(0);
      expect.soft(row.outsidePlate, label).toBe(0);
      expect.soft(row.accessibleName, label).toBe(TITLE);
    }
  });

  test(`${mode}: same cedilla request rejects prefix-only painter style`, async ({ page, servers }, info) => {
    const rows = [];
    for (const mutated of [false, true]) {
      await openHarness(page, servers, mode);
      rows.push(await page.evaluate(async ({ mode, title, mutated }) => {
        const api = await import(mode === 'built' ? '/dist/scriptoscope.js' : '/src/index.ts');
        const R = await import('/tests/rendering-options/window-title-rules.mjs');
        const theme = await api.loadTheme('/themes/1984'); R.isolateGlyphs(theme);
        const key = 'titled-utility-window', h = R.topTitleHeight(theme.manifest.windowTypes[key]);
        const required = R.resolveTitleStyle(title, key, h), calls = [];
        const fill = CanvasRenderingContext2D.prototype.fillText;
        let win;
        try {
          CanvasRenderingContext2D.prototype.fillText = function painter(text, ...args) {
            if (text !== title && text.endsWith('…')) {
              CanvasRenderingContext2D.prototype.fillText = fill;
              let prefix;
              try { prefix = R.resolveTitleStyle(text, key, h); }
              finally { CanvasRenderingContext2D.prototype.fillText = painter; }
              if (mutated) this.font = prefix.reference.font;
              calls.push({ text, style: R.titleFontStyle(this.font), prefix: prefix.reference.fontStyle });
            }
            return fill.call(this, text, ...args);
          };
          win = await api.renderWindow(theme, { title, width: 240, height: 120, windowType: key });
        } finally { CanvasRenderingContext2D.prototype.fillText = fill; theme.dispose?.(); }
        return { mutated, required: required.reference.fontStyle, draw: calls.at(-1),
          clip: win._scriptoscopeComposed.titleRect, plate: R.plateOf(win._scriptoscopeComposed), name: win.getAttribute('aria-label') };
      }, { mode, title: TITLE, mutated }));
    }
    await attachObservations(info, 'window-title-ink', `${mode}-prefix-only`, { mode, rows });
    for (const row of rows) {
      expect(row.draw, 'truncated painter reached').toBeDefined();
      expect(row.draw.prefix.size, 'mutation must discriminate full-request style').toBeGreaterThan(row.required.size);
      if (row.mutated) {
        expect(row.draw.style).toEqual(row.draw.prefix);
        expect(row.draw.style).not.toEqual(row.required);
      } else expect.soft(row.draw.style, 'unmutated full-request style').toEqual(row.required);
      expect(row.name).toBe(TITLE);
    }
    expect(rows[1].draw.text).toBe(rows[0].draw.text);
    expect(rows[1].clip).toEqual(rows[0].clip);
    expect(rows[1].plate).toEqual(rows[0].plate);
  });
}

// Adopted P1 (7f7c7c6a): finite samples can falsify, never prove, the host
// envelope and integer-translation premise. These direct browser rasters are
// independent of runtime output and do not alter window-title-rules.mjs.
for (const mode of ['source', 'built']) test(`${mode}: P1 signed envelope and whole-request tile phase controls`, async ({ page, servers }, info) => {
  await openHarness(page, servers, mode);
  const rows = await page.evaluate(() => {
    const rows = [];
    const titles = ['j---', 'Áj\u0323\u0301\u0308Ç', `j${'WINDOW '.repeat(96)}Ç\u0323`];
    for (const title of titles) for (const size of [10, 16]) for (const face of ['normal', 'bold']) for (const phase of [0, 0.5]) {
      const full = document.createElement('canvas'); full.width = 8192; full.height = 128;
      const c = full.getContext('2d'), penX = 64 + phase, baseline = 64 + phase;
      c.font = `${face} ${size}px "Charcoal 12", Charcoal, "Helvetica Neue", Arial, sans-serif`;
      c.textBaseline = 'alphabetic'; c.textAlign = 'left';
      const m = c.measureText(title), halo = size + 1;
      const envelope = { l: Math.floor(penX - m.actualBoundingBoxLeft - halo), r: Math.ceil(penX + m.actualBoundingBoxRight + halo),
        t: Math.floor(baseline - m.actualBoundingBoxAscent - halo), b: Math.ceil(baseline + m.actualBoundingBoxDescent + halo) };
      if (envelope.l < 1 || envelope.r >= full.width || envelope.t < 1 || envelope.b >= full.height) throw new Error('Independent P1 probe exceeds its fixed reference surface');
      c.fillText(title, penX, baseline);
      const image = c.getImageData(0, 0, full.width, full.height);
      let ink = 0, outside = 0, border = 0, mismatch = 0, seamInk = 0;
      for (let y = 0; y < full.height; y++) for (let x = 0; x < full.width; x++) {
        if (!image.data[(y * full.width + x) * 4 + 3]) continue;
        ink++;
        if (x < envelope.l || x >= envelope.r || y < envelope.t || y >= envelope.b) outside++;
        if (x === 0 || y === 0 || x === full.width - 1 || y === full.height - 1) border++;
        if (x >= 4094 && x <= 4097) seamInk++;
      }
      const tile = document.createElement('canvas'); tile.height = 32; tile.width = 4096;
      const ctx = tile.getContext('2d'); ctx.font = c.font; ctx.textAlign = c.textAlign; ctx.textBaseline = c.textBaseline;
      // Every tile shapes the identical complete input; subtract integer origins
      // only, including at the x=4096 seam and both sides of the baseline.
      for (let y = 0; y < full.height; y += 32) for (let x = 0; x < full.width; x += 4096) {
        ctx.clearRect(0, 0, tile.width, tile.height);
        ctx.fillText(title, penX - x, baseline - y);
        const data = ctx.getImageData(0, 0, tile.width, tile.height).data;
        for (let ty = 0; ty < 32; ty++) for (let tx = 0; tx < 4096; tx++) {
          if (data[(ty * 4096 + tx) * 4 + 3] !== image.data[((ty + y) * full.width + tx + x) * 4 + 3]) mismatch++;
        }
      }
      rows.push({ title, size, face, phase, font: c.font, envelope, ink, outside, border, mismatch, seamInk,
        metrics: { left: m.actualBoundingBoxLeft, right: m.actualBoundingBoxRight, ascent: m.actualBoundingBoxAscent, descent: m.actualBoundingBoxDescent } });
    }
    return rows;
  });
  await attachObservations(info, 'window-title-ink', `${mode}-P1`, { mode, rows });
  expect(rows).toHaveLength(24);
  for (const row of rows) {
    const label = `${row.face} ${row.size}px phase=${row.phase} length=${row.title.length}`;
    expect.soft(row.ink, label).toBeGreaterThan(0);
    expect.soft(row.border, `${label}: independent raster is unclipped`).toBe(0);
    expect.soft(row.outside, `${label}: P1 falsification`).toBe(0);
    expect.soft(row.mismatch, `${label}: whole-request integer tile translation`).toBe(0);
  }
  expect(rows.some(row => row.seamInk > 0), 'long control actually exercises the tile seam').toBe(true);
});

// TC4/TC5 replay from an independently placed raster: no assumption that a
// runtime scratch raster starts at the pen or that its row zero is baseline.
for (const mode of ['source', 'built']) test(`${mode}: coverage padding preserves title colour pass placement`, async ({ page, servers }, info) => {
  await openHarness(page, servers, mode);
  const rows = await page.evaluate(async mode => {
    const api = await import(mode === 'built' ? '/dist/scriptoscope.js' : '/src/index.ts');
    const R = await import('/tests/rendering-options/window-title-rules.mjs');
    const raw = await api.loadKaleidoscopeScheme(new Uint8Array(await (await fetch('/themes/1984/scheme.sit')).arrayBuffer()), { encodeAssets: false });
    const theme = await api.loadTheme('/themes/1984'), key = 'document-window', wt = theme.manifest.windowTypes[key], title = 'Hdgy';
    const style = R.resolveTitleStyle(title, key, R.topTitleHeight(wt));
    const fill = CanvasRenderingContext2D.prototype.fillText, out = [];
    try {
      for (const state of ['active', 'inactive']) for (const variant of ['equal-raw', 'raw-difference-display-equal', 'distinct-display']) {
        const text = { rgb16: [0x2101, 0x4301, 0x6501], displayRgb: [32, 80, 160] };
        const shadow = { rgb16: [...text.rgb16], displayRgb: [...text.displayRgb] };
        if (variant !== 'equal-raw') shadow.rgb16[0]++;
        if (variant === 'distinct-display') shadow.displayRgb = [180, 70, 20];
        wt.titleSamples = { [state]: { text, shadow, background: text } };
        const hex = sample => '#' + sample.displayRgb.map(n => n.toString(16).padStart(2, '0')).join('');
        const colours = [hex(text), hex(shadow)], calls = [], nativePaints = [];
        let win;
        try {
          CanvasRenderingContext2D.prototype.fillText = function (s, ...args) {
            if (colours.includes(this.fillStyle)) {
              this.globalAlpha = 0.5; calls.push({ text: s, font: this.font, colour: this.fillStyle, args });
            }
            const result = fill.call(this, s, ...args);
            if (colours.includes(this.fillStyle)) nativePaints.push({ args, width: this.canvas.width, height: this.canvas.height,
              rgba: this.getImageData(0, 0, this.canvas.width, this.canvas.height).data });
            return result;
          };
          win = await api.renderWindow(theme, { title, width: 240, height: 120, windowType: key, state });
        } finally { CanvasRenderingContext2D.prototype.fillText = fill; }
        const c = win._scriptoscopeComposed, rect = c.titleRect;
        const a = raw.assets.find(a => a.path === raw.manifest.windowTypes[key].chrome[state]);
        const tf = R.textFreeChrome(api.composeWindowChrome, new api.PixelBuffer(a.width, a.height, new Uint8ClampedArray(a.rgba)), wt, c, { titleLength: title.length });
        if (!tf) throw new Error('Independent colour replay has no matching text-free chrome');
        const baseline = Math.max(rect.y + rect.h - 4, rect.y + style.reference.ascent);
        const passes = variant === 'equal-raw' ? [[text, 0]] : [[shadow, 1], [text, 0]];
        const rasters = passes.map(([sample]) => {
          const canvas = document.createElement('canvas'); canvas.width = 256; canvas.height = 128;
          const ctx = canvas.getContext('2d'); ctx.font = style.reference.font; ctx.fillStyle = hex(sample); ctx.globalAlpha = 0.5;
          fill.call(ctx, title, 32, 64);
          return ctx.getImageData(0, 0, 256, 128).data;
        });
        // Diagnostic only: prove whether the separate reference agrees with
        // every captured native pixel inside its existing scratch surface.
        // Retain the pre-pen column separately; never clip it out of replay.
        const nativePositiveDifferences = nativePaints.map((paint, i) => {
          const ref = rasters[i]; if (!ref) return null;
          let differences = 0;
          for (let y = 0; y < paint.height; y++) for (let x = 0; x < paint.width; x++) {
            const rx = 32 + x - paint.args[0], ry = 64 + y - paint.args[1];
            for (let k = 0; k < 4; k++) if (paint.rgba[(y * paint.width + x) * 4 + k] !== (ref[(ry * 256 + rx) * 4 + k] ?? 0)) differences++;
          }
          return differences;
        });
        const prePenColumn = rasters.map(rgba => Array.from({ length: 128 }, (_, y) => ({ y: y - 64, rgba: Array.from(rgba.slice((y * 256 + 31) * 4, (y * 256 + 31) * 4 + 4)) })).filter(p => p.rgba[3]));
        const replay = ({ reverse = false, unshifted = false, mainOnly = false } = {}) => {
          const expected = new Uint8ClampedArray(tf.buffer.data);
          let fractional = 0, overlap = 0; const touched = new Set();
          const order = passes.map((_, i) => i); if (reverse) order.reverse();
          for (const i of order) {
            if (mainOnly && i < passes.length - 1) continue;
            const pixels = rasters[i], offset = unshifted ? 0 : passes[i][1];
            for (let y = 0; y < 128; y++) for (let x = 0; x < 256; x++) {
              const p = (y * 256 + x) * 4, alpha = pixels[p + 3];
              const dx = rect.x + x - 32 + offset, dy = baseline + y - 64 + offset;
              if (!alpha || dx < rect.x || dx >= rect.x + rect.w + 2 || dy < rect.y || dy >= rect.y + rect.h) continue;
              if (alpha < 255) fractional++;
              const d = (dy * c.buffer.width + dx) * 4;
              if (touched.has(d)) overlap++; touched.add(d);
              for (let k = 0; k < 3; k++) expected[d + k] = Math.round((pixels[p + k] * alpha + expected[d + k] * (255 - alpha)) / 255);
              expected[d + 3] = Math.round(alpha + expected[d + 3] * (255 - alpha) / 255);
            }
          }
          let mismatches = 0; const firstDifferences = [];
          for (let i = 0; i < expected.length; i++) if (expected[i] !== c.buffer.data[i]) {
            mismatches++; if (firstDifferences.length < 12) firstDifferences.push({ x: Math.floor(i / 4) % c.buffer.width, y: Math.floor(i / 4 / c.buffer.width), channel: i % 4, expected: expected[i], actual: c.buffer.data[i] });
          }
          return { mismatches, fractional, overlap, firstDifferences };
        };
        out.push({ state, variant, calls, nativePositiveDifferences, prePenColumn, style: style.reference.fontStyle, rect, baseline, ...replay(),
          reverseMismatch: replay({ reverse: true }).mismatches, unshiftedMismatch: replay({ unshifted: true }).mismatches,
          missingShadowMismatch: replay({ mainOnly: true }).mismatches, accessibleName: win.getAttribute('aria-label') });
      }
    } finally { CanvasRenderingContext2D.prototype.fillText = fill; theme.dispose?.(); }
    return out;
  }, mode);
  await attachObservations(info, 'window-title-ink', `${mode}-colour-origin`, { mode, rows });
  expect(rows).toHaveLength(6);
  for (const row of rows) {
    expect.soft(row.mismatches, `${row.state} ${row.variant}: independent colour/pen/baseline/clip replay`).toBe(0);
    expect.soft(row.fractional, row.variant).toBeGreaterThan(0);
    expect.soft(row.accessibleName).toBe('Hdgy');
    if (row.variant !== 'equal-raw') {
      expect.soft(row.overlap, row.variant).toBeGreaterThan(0);
      expect.soft(row.missingShadowMismatch, row.variant).toBeGreaterThan(0);
      expect.soft(row.unshiftedMismatch, row.variant).toBeGreaterThan(0);
    }
    if (row.variant === 'distinct-display') expect.soft(row.reverseMismatch, row.variant).toBeGreaterThan(0);
  }
});
