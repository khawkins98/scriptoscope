import { test, expect, openHarness, attachObservations } from './fixtures.mjs';

// TC4/TC5 replay from an independently placed raster: no assumption that a
// runtime scratch raster starts at the pen or that its row zero is baseline.
for (const mode of ['source', 'built']) test(`${mode}: raw RGB16 title equality and shadow/foreground alpha-over`, async ({ page, servers }, info) => {
  await openHarness(page, servers, mode);
  const rows = await page.evaluate(async mode => {
    const api = await import(mode === 'built' ? '/dist/scriptoscope.js' : '/src/index.ts');
    const R = await import('/tests/rendering-options/window-title-rules.mjs');
    const raw = await api.loadKaleidoscopeScheme(new Uint8Array(await (await fetch('/themes/1984/scheme.sit')).arrayBuffer()), { encodeAssets: false });
    const theme = await api.loadTheme('/themes/1984'), key = 'document-window', wt = theme.manifest.windowTypes[key], title = 'Hdgy';
    const style = R.resolveTitleStyle(title, key, R.topTitleHeight(wt));
    const fill = CanvasRenderingContext2D.prototype.fillText, out = [];
    try {
      for (const state of ['active', 'inactive']) for (const channel of [-1, 0, 1, 2, 3]) {
        const variant = channel < 0 ? 'equal-raw' : channel === 3 ? 'distinct-display' : `raw-channel-${channel}-display-equal`;
        const text = { rgb16: [0x2101, 0x4301, 0x6501], displayRgb: [32, 80, 160] };
        const shadow = { rgb16: [...text.rgb16], displayRgb: [...text.displayRgb] };
        if (channel >= 0) shadow.rgb16[channel % 3]++;
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
        const replay = ({ reverse = false, unshifted = false, mainOnly = false, missing, opaque = false } = {}) => {
          const expected = new Uint8ClampedArray(tf.buffer.data);
          let fractional = 0, overlap = 0; const touched = new Set();
          const order = passes.map((_, i) => i); if (reverse) order.reverse();
          for (const i of order) {
            if ((mainOnly && i < passes.length - 1) || i === missing) continue;
            const pixels = rasters[i], offset = unshifted ? 0 : passes[i][1];
            for (let y = 0; y < 128; y++) for (let x = 0; x < 256; x++) {
              const p = (y * 256 + x) * 4, coverage = pixels[p + 3], alpha = opaque && coverage ? 255 : coverage;
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
        out.push({ state, channel, variant, calls, wantedStyles: passes.map(([sample]) => hex(sample)), nativePositiveDifferences, prePenColumn, style: style.reference.fontStyle, rect, baseline, ...replay(),
          opaqueMutation: replay({ opaque: true }).mismatches, missingPaintMutations: passes.map((_, i) => replay({ missing: i }).mismatches),
          reverseMismatch: replay({ reverse: true }).mismatches, unshiftedMismatch: replay({ unshifted: true }).mismatches,
          missingShadowMismatch: replay({ mainOnly: true }).mismatches, accessibleName: win.getAttribute('aria-label') });
      }
    } finally { CanvasRenderingContext2D.prototype.fillText = fill; theme.dispose?.(); }
    return out;
  }, mode);
  await attachObservations(info, 'window-title-colors', mode, { mode, rows });
  expect(rows).toHaveLength(10);
  for (const row of rows) {
    expect.soft(row.mismatches, `${row.state} ${row.variant}: independent colour/pen/baseline/clip replay`).toBe(0);
    expect.soft(row.fractional, row.variant).toBeGreaterThan(0);
    expect.soft(row.opaqueMutation, row.variant).toBeGreaterThan(0);
    for (const differences of row.missingPaintMutations) expect.soft(differences, row.variant).toBeGreaterThan(0);
    expect.soft(row.accessibleName).toBe('Hdgy');
    if (row.variant !== 'equal-raw') {
      expect.soft(row.overlap, row.variant).toBeGreaterThan(0);
      expect.soft(row.missingShadowMismatch, row.variant).toBeGreaterThan(0);
      expect.soft(row.unshiftedMismatch, row.variant).toBeGreaterThan(0);
    }
    if (row.variant === 'distinct-display') expect.soft(row.reverseMismatch, row.variant).toBeGreaterThan(0);
  }
});
